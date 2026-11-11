import postgres from "npm:postgres@3.4.7";
import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import type {
  RoomRentalConflict,
  RoomRentalOccurrence,
  RoomRentalResult,
} from "./types.ts";

interface CodedError extends Error {
  code?: string;
  details?: unknown;
}

interface IdRow {
  id: string;
}

interface RentalRow {
  id: string;
  staff_id: string;
  room: string;
  starts_at: string;
  ends_at: string;
  status: "BOOKED" | "CANCELLED";
  cancelled_at: string | null;
  cancelled_by: string | null;
}

interface ConflictRow {
  reason: string | null;
}

function codedError(code: string, details?: unknown): CodedError {
  return Object.assign(new Error(code), { code, details });
}

function databaseUrl(): string {
  const value = Deno.env.get("SUPABASE_DB_URL");
  if (!value) throw codedError("SUPABASE_DB_URL_MISSING");
  return value;
}

async function setActorContext(tx: TransactionSql, actorUserId: string) {
  await tx`
    select
      set_config('request.jwt.claim.sub', ${actorUserId}, true),
      set_config('request.jwt.claim.role', 'authenticated', true)
  `;
}

async function authorize(tx: TransactionSql, actorUserId: string) {
  await setActorContext(tx, actorUserId);
  const rows = await tx<{ allowed: boolean }[]>`
    select
      exists (
        select 1 from public.profiles p
        where p.user_id = ${actorUserId}::uuid
          and p.status = 'ACTIVE'
          and p.role in ('ADMIN', 'ROOT_ADMIN')
      ) as allowed
  `;
  if (rows[0]?.allowed !== true) throw codedError("FORBIDDEN");
}

async function lockScheduling(tx: TransactionSql) {
  await tx`select pg_advisory_xact_lock(hashtext('continuous-class-session-generator'))`;
}

async function assertActiveTeacher(tx: TransactionSql, staffId: string) {
  const rows = await tx<{ id: string }[]>`
    select id from public.staff
    where id = ${staffId}::uuid and staff_type = 'TEACHER' and status = 'ACTIVE'
    for key share
  `;
  if (!rows[0]) throw codedError("TEACHER_NOT_ACTIVE");
}

async function conflictReason(
  tx: TransactionSql,
  rentalId: string | null,
  occurrence: RoomRentalOccurrence,
): Promise<string | null> {
  const rows = await tx<ConflictRow[]>`
    select public.room_rental_conflict_reason(
      ${rentalId}::uuid,
      ${occurrence.starts_at}::timestamptz,
      ${occurrence.ends_at}::timestamptz,
      ${occurrence.room}
    ) as reason
  `;
  return rows[0]?.reason ?? null;
}

async function assertNoConflicts(
  tx: TransactionSql,
  occurrences: RoomRentalOccurrence[],
  rentalId: string | null = null,
) {
  const conflicts: RoomRentalConflict[] = [];
  for (const occurrence of occurrences) {
    const reason = await conflictReason(tx, rentalId, occurrence);
    if (reason) conflicts.push({ date: occurrence.date, room: occurrence.room, reason });
  }
  if (conflicts.length) throw codedError("ROOM_RENTAL_CONFLICT", conflicts);
}

async function writeAudit(
  tx: TransactionSql,
  actorUserId: string,
  action: string,
  rentalId: string,
  oldData: unknown,
  newData: unknown,
  reason: string,
) {
  const oldJson = oldData == null ? null : tx.json(oldData as Parameters<typeof tx.json>[0]);
  const newJson = newData == null ? null : tx.json(newData as Parameters<typeof tx.json>[0]);
  await tx`
    select public.write_audit(
      ${actorUserId}::uuid,
      ${action},
      'room_rentals',
      ${rentalId}::uuid,
      ${oldJson}::jsonb,
      ${newJson}::jsonb,
      ${reason}
    )
  `;
}

function rentalData(staffId: string, occurrence: RoomRentalOccurrence) {
  return {
    staff_id: staffId,
    room: occurrence.room.trim(),
    starts_at: occurrence.starts_at,
    ends_at: occurrence.ends_at,
  };
}

async function insertRental(
  tx: TransactionSql,
  staffId: string,
  occurrence: RoomRentalOccurrence,
  actorUserId: string,
): Promise<string> {
  const rows = await tx<IdRow[]>`
    insert into public.room_rentals (staff_id, room, starts_at, ends_at, created_by)
    values (
      ${staffId}::uuid,
      ${occurrence.room.trim()},
      ${occurrence.starts_at}::timestamptz,
      ${occurrence.ends_at}::timestamptz,
      ${actorUserId}::uuid
    )
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw codedError("ROOM_RENTAL_WRITE_FAILED");
  await writeAudit(
    tx,
    actorUserId,
    "ROOM_RENTAL_CREATE",
    id,
    null,
    rentalData(staffId, occurrence),
    "Admin created a room rental.",
  );
  return id;
}

export function createRoomRentalsStore(): {
  create(input: RoomRentalOccurrence, staffId: string, actorUserId: string): Promise<RoomRentalResult>;
  createMonth(occurrences: RoomRentalOccurrence[], staffId: string, actorUserId: string): Promise<RoomRentalResult>;
  reschedule(input: RoomRentalOccurrence, rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
  cancel(rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
} {
  const sql: Sql = postgres(databaseUrl(), {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return {
    async create(input, staffId, actorUserId) {
      return await sql.begin(async (tx) => {
        await authorize(tx, actorUserId);
        await lockScheduling(tx);
        await assertActiveTeacher(tx, staffId);
        await assertNoConflicts(tx, [input]);
        const id = await insertRental(tx, staffId, input, actorUserId);
        return { rental_id: id, status: "BOOKED" };
      });
    },

    async createMonth(occurrences, staffId, actorUserId) {
      return await sql.begin(async (tx) => {
        await authorize(tx, actorUserId);
        await lockScheduling(tx);
        await assertActiveTeacher(tx, staffId);
        await assertNoConflicts(tx, occurrences);
        for (const occurrence of occurrences) {
          await insertRental(tx, staffId, occurrence, actorUserId);
        }
        return { created_count: occurrences.length, status: "BOOKED" };
      });
    },

    async reschedule(input, rentalId, actorUserId) {
      return await sql.begin(async (tx) => {
        await authorize(tx, actorUserId);
        await lockScheduling(tx);
        const rows = await tx<RentalRow[]>`
          select id, staff_id, room, starts_at, ends_at, status, cancelled_at, cancelled_by
          from public.room_rentals where id = ${rentalId}::uuid for update
        `;
        const existing = rows[0];
        if (!existing) throw codedError("ROOM_RENTAL_NOT_FOUND");
        if (existing.status !== "BOOKED") throw codedError("ROOM_RENTAL_NOT_BOOKED");
        if (new Date(existing.starts_at) <= new Date()) throw codedError("ROOM_RENTAL_CANNOT_CHANGE_STARTED");
        await assertNoConflicts(tx, [input], rentalId);
        const updated = await tx<RentalRow[]>`
          update public.room_rentals
          set room = ${input.room.trim()},
            starts_at = ${input.starts_at}::timestamptz,
            ends_at = ${input.ends_at}::timestamptz
          where id = ${rentalId}::uuid
          returning id, staff_id, room, starts_at, ends_at, status, cancelled_at, cancelled_by
        `;
        if (!updated[0]) throw codedError("ROOM_RENTAL_WRITE_FAILED");
        await writeAudit(
          tx,
          actorUserId,
          "ROOM_RENTAL_RESCHEDULE",
          rentalId,
          existing,
          updated[0],
          "Admin rescheduled a room rental.",
        );
        return { rental_id: rentalId, status: "BOOKED" };
      });
    },

    async cancel(rentalId, actorUserId) {
      return await sql.begin(async (tx) => {
        await authorize(tx, actorUserId);
        await lockScheduling(tx);
        const rows = await tx<RentalRow[]>`
          select id, staff_id, room, starts_at, ends_at, status, cancelled_at, cancelled_by
          from public.room_rentals where id = ${rentalId}::uuid for update
        `;
        const existing = rows[0];
        if (!existing) throw codedError("ROOM_RENTAL_NOT_FOUND");
        if (existing.status !== "BOOKED") throw codedError("ROOM_RENTAL_NOT_BOOKED");
        if (new Date(existing.starts_at) <= new Date()) throw codedError("ROOM_RENTAL_CANNOT_CHANGE_STARTED");
        const updated = await tx<RentalRow[]>`
          update public.room_rentals
          set status = 'CANCELLED', cancelled_at = now(), cancelled_by = ${actorUserId}::uuid
          where id = ${rentalId}::uuid
          returning id, staff_id, room, starts_at, ends_at, status, cancelled_at, cancelled_by
        `;
        if (!updated[0]) throw codedError("ROOM_RENTAL_WRITE_FAILED");
        await writeAudit(
          tx,
          actorUserId,
          "ROOM_RENTAL_CANCEL",
          rentalId,
          existing,
          updated[0],
          "Admin cancelled a room rental.",
        );
        return { rental_id: rentalId, status: "CANCELLED" };
      });
    },
  };
}
