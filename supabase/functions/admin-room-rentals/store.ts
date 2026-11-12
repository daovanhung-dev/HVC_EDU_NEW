import postgres from "npm:postgres@3.4.7";
import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import type {
  RoomRentalConflict,
  RoomRentalMonthRange,
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
  created_by?: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ConflictRow {
  reason: string | null;
}

interface SessionConflictRow {
  id: string;
  class_id: string;
  class_name: string;
  room: string | null;
  starts_at: string;
  ends_at: string;
  teacher_names: string[];
  teacher_ids: string[];
  teacher_matches: boolean;
}

interface RecurringConflictRow {
  id: string;
  class_id: string;
  class_name: string;
  room: string | null;
  starts_at: string;
  ends_at: string;
  teacher_names: string[];
  teacher_ids: string[];
  teacher_matches: boolean;
}

interface RentalConflictRow {
  id: string;
  room: string;
  starts_at: string;
  ends_at: string;
  staff_id: string;
  renter_name: string;
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

async function lockMonthTeacherAssignments(tx: TransactionSql) {
  // This relation is writable through the Admin Data API and its legacy audit
  // trigger does not take the scheduling advisory lock. Hold a read lock so a
  // teacher cannot be reassigned between conflict confirmation and the write.
  await tx`lock table public.class_schedule_staff in share mode`;
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
    if (reason) {
      conflicts.push({
        key: `UNKNOWN:${encodeURIComponent(occurrenceKey(occurrence))}`,
        type: "UNKNOWN",
        date: occurrence.date,
        start_time: occurrence.start_time,
        end_time: occurrence.end_time,
        starts_at: occurrence.starts_at,
        ends_at: occurrence.ends_at,
        room: occurrence.room,
        reason,
        action: null,
        can_override: false,
      });
    }
  }
  if (conflicts.length) throw codedError("ROOM_RENTAL_CONFLICT", conflicts);
}

function normalizedRoom(value: string): string {
  return value.trim().toLowerCase();
}

function occurrenceKey(occurrence: RoomRentalOccurrence): string {
  return [occurrence.date, occurrence.start_time, occurrence.end_time, normalizedRoom(occurrence.room)].join("|");
}

async function conflictKey(
  type: string,
  id: string,
  occurrence: RoomRentalOccurrence,
  state: {
    startsAt: string;
    endsAt: string;
    room: string | null;
    classId?: string | null;
    teacherIds?: string[];
    renterId?: string | null;
    reason: string;
    action: RoomRentalConflict["action"];
  },
): Promise<string> {
  const data = JSON.stringify({
    type,
    id,
    occurrence: occurrenceKey(occurrence),
    startsAt: state.startsAt,
    endsAt: state.endsAt,
    room: state.room,
    classId: state.classId ?? null,
    teacherIds: (state.teacherIds ?? []).slice().sort(),
    renterId: state.renterId ?? null,
    reason: state.reason,
    action: state.action,
  });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data)));
  const fingerprint = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${type}:${fingerprint}`;
}

async function toConflict(
  occurrence: RoomRentalOccurrence,
  input: {
    type: RoomRentalConflict["type"];
    id: string;
    room: string | null;
    startsAt: string;
    endsAt: string;
    reason: string;
    action: RoomRentalConflict["action"];
    canOverride: boolean;
    className?: string | null;
    classId?: string | null;
    teacherNames?: string[];
    teacherIds?: string[];
    renterId?: string | null;
    renterName?: string | null;
  },
): Promise<RoomRentalConflict> {
  return {
    key: await conflictKey(input.type, input.id, occurrence, {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      room: input.room,
      classId: input.classId,
      teacherIds: input.teacherIds,
      renterId: input.renterId,
      reason: input.reason,
      action: input.action,
    }),
    type: input.type,
    date: occurrence.date,
    start_time: occurrence.start_time,
    end_time: occurrence.end_time,
    starts_at: occurrence.starts_at,
    ends_at: occurrence.ends_at,
    room: occurrence.room,
    reason: input.reason,
    action: input.action,
    can_override: input.canOverride,
    conflict_id: input.id,
    conflict_starts_at: input.startsAt,
    conflict_ends_at: input.endsAt,
    conflict_room: input.room,
    class_id: input.classId ?? null,
    class_name: input.className ?? null,
    teacher_names: input.teacherNames ?? [],
    renter_name: input.renterName ?? null,
  };
}

async function findMonthConflicts(
  tx: TransactionSql,
  occurrences: RoomRentalOccurrence[],
  staffId: string,
): Promise<RoomRentalConflict[]> {
  const conflicts: RoomRentalConflict[] = [];
  const rentalRows: Array<{ occurrence: RoomRentalOccurrence; row: RentalConflictRow }> = [];

  for (const occurrence of occurrences) {
    const sessions = await tx<SessionConflictRow[]>`
      select
        s.id::text as id,
        s.class_id::text as class_id,
        c.name as class_name,
        s.room,
        s.scheduled_start_at::text as starts_at,
        s.scheduled_end_at::text as ends_at,
        coalesce(
          array_agg(distinct assigned.full_name) filter (where assigned.id is not null),
          array[]::text[]
        ) as teacher_names,
        coalesce(
          array_agg(distinct ss.staff_id::text) filter (where ss.staff_id is not null),
          array[]::text[]
        ) as teacher_ids,
        coalesce(bool_or(ss.staff_id = ${staffId}::uuid), false) as teacher_matches
      from public.sessions s
      join public.classes c on c.id = s.class_id
      left join public.session_staff ss
        on ss.session_id = s.id and ss.assignment_role = 'TEACHER'
      left join public.staff assigned on assigned.id = ss.staff_id
      where s.status in ('SCHEDULED', 'IN_PROGRESS')
         or (${occurrence.starts_at}::timestamptz <= now() and s.status = 'COMPLETED')
      group by s.id, c.name
      having s.scheduled_start_at < ${occurrence.ends_at}::timestamptz
         and s.scheduled_end_at > ${occurrence.starts_at}::timestamptz
         and (
           s.room is null or btrim(s.room) = ''
           or lower(btrim(s.room)) = lower(btrim(${occurrence.room}))
         )
      order by s.scheduled_start_at, s.id
    `;
    for (const row of sessions) {
      const hasRoom = !!row.room?.trim();
      const canOverride = hasRoom && row.teacher_matches;
      conflicts.push(await toConflict(occurrence, {
        type: "SESSION",
        id: row.id,
        room: row.room,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        className: row.class_name,
        classId: row.class_id,
        teacherNames: row.teacher_names,
        teacherIds: row.teacher_ids,
        reason: !hasRoom ? "ROOM_UNSPECIFIED" : row.teacher_matches ? "SAME_CLASS_TEACHER" : "DIFFERENT_CLASS_TEACHER",
        action: canOverride ? "ALLOW_CLASS_OVERLAP" : null,
        canOverride,
      }));
    }

    const recurring = await tx<RecurringConflictRow[]>`
      select
        cs.id::text as id,
        cs.class_id::text as class_id,
        c.name as class_name,
        cs.room,
        ((${occurrence.date}::date + cs.start_time) at time zone 'Asia/Ho_Chi_Minh')::text as starts_at,
        ((${occurrence.date}::date + cs.end_time) at time zone 'Asia/Ho_Chi_Minh')::text as ends_at,
        coalesce(
          array_agg(distinct assigned.full_name) filter (where assigned.id is not null),
          array[]::text[]
        ) as teacher_names,
        coalesce(
          array_agg(distinct css.staff_id::text) filter (where css.staff_id is not null),
          array[]::text[]
        ) as teacher_ids,
        coalesce(bool_or(css.staff_id = ${staffId}::uuid), false) as teacher_matches
      from public.class_schedules cs
      join public.classes c on c.id = cs.class_id
      left join public.class_schedule_staff css on css.schedule_id = cs.id
      left join public.staff assigned on assigned.id = css.staff_id
      where cs.status = 'ACTIVE'
        and cs.reviewed_at is not null
        and c.status = 'ACTIVE'
        and cs.day_of_week = extract(isodow from ${occurrence.date}::date)::integer
        and cs.start_time < ${occurrence.end_time}::time
        and cs.end_time > ${occurrence.start_time}::time
        and not exists (
          select 1 from public.class_schedule_month_overrides mo
          where mo.month_start = date_trunc('month', ${occurrence.date}::date)::date
        )
        and not exists (
          select 1 from public.deleted_session_occurrences dso
          where dso.class_schedule_id = cs.id
            and dso.occurrence_date = ${occurrence.date}::date
        )
        and not exists (
          select 1 from public.sessions existing
          where existing.recurrence_schedule_id = cs.id
            and existing.recurrence_occurrence_date = ${occurrence.date}::date
        )
      group by cs.id, c.name
      having cs.room is null or btrim(cs.room) = ''
        or lower(btrim(cs.room)) = lower(btrim(${occurrence.room}))
      order by cs.id
    `;
    for (const row of recurring) {
      const hasRoom = !!row.room?.trim();
      const canOverride = hasRoom && row.teacher_matches;
      conflicts.push(await toConflict(occurrence, {
        type: "RECURRING_SCHEDULE",
        id: row.id,
        room: row.room,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        className: row.class_name,
        classId: row.class_id,
        teacherNames: row.teacher_names,
        teacherIds: row.teacher_ids,
        reason: !hasRoom ? "ROOM_UNSPECIFIED" : row.teacher_matches ? "SAME_CLASS_TEACHER" : "DIFFERENT_CLASS_TEACHER",
        action: canOverride ? "ALLOW_CLASS_OVERLAP" : null,
        canOverride,
      }));
    }

    const rentals = await tx<RentalConflictRow[]>`
      select
        r.id::text as id,
        r.staff_id::text as staff_id,
        r.room,
        r.starts_at::text as starts_at,
        r.ends_at::text as ends_at,
        s.full_name as renter_name
      from public.room_rentals r
      join public.staff s on s.id = r.staff_id
      where r.status = 'BOOKED'
        and lower(btrim(r.room)) = lower(btrim(${occurrence.room}))
        and r.starts_at < ${occurrence.ends_at}::timestamptz
        and r.ends_at > ${occurrence.starts_at}::timestamptz
      order by r.starts_at, r.id
    `;
    for (const row of rentals) rentalRows.push({ occurrence, row });
  }

  const rentalToOccurrences = new Map<string, Set<string>>();
  const occurrenceToRentals = new Map<string, Set<string>>();
  for (const { occurrence, row } of rentalRows) {
    const target = occurrenceKey(occurrence);
    const targetSet = rentalToOccurrences.get(row.id) ?? new Set<string>();
    targetSet.add(target);
    rentalToOccurrences.set(row.id, targetSet);
    const rentalSet = occurrenceToRentals.get(target) ?? new Set<string>();
    rentalSet.add(row.id);
    occurrenceToRentals.set(target, rentalSet);
  }
  for (const { occurrence, row } of rentalRows) {
    const unique = rentalToOccurrences.get(row.id)?.size === 1
      && occurrenceToRentals.get(occurrenceKey(occurrence))?.size === 1;
    conflicts.push(await toConflict(occurrence, {
      type: "RENTAL",
      id: row.id,
      room: row.room,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      renterId: row.staff_id,
      renterName: row.renter_name,
      reason: unique ? "BOOKED_RENTAL" : "AMBIGUOUS_RENTAL_MAPPING",
      action: unique ? "REPLACE_RENTAL" : null,
      canOverride: unique,
    }));
  }

  return conflicts.sort((left, right) => left.date.localeCompare(right.date)
    || left.starts_at.localeCompare(right.starts_at)
    || left.type.localeCompare(right.type)
    || left.key.localeCompare(right.key));
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

async function overwriteRental(
  tx: TransactionSql,
  rentalId: string,
  staffId: string,
  occurrence: RoomRentalOccurrence,
  actorUserId: string,
): Promise<void> {
  const existingRows = await tx<RentalRow[]>`
    select id, staff_id, room, starts_at, ends_at, status, cancelled_at, cancelled_by
    from public.room_rentals
    where id = ${rentalId}::uuid
    for update
  `;
  const existing = existingRows[0];
  if (!existing || existing.status !== "BOOKED") {
    throw codedError("ROOM_RENTAL_CONFLICT");
  }
  const updatedRows = await tx<RentalRow[]>`
    update public.room_rentals
    set staff_id = ${staffId}::uuid,
      room = ${occurrence.room.trim()},
      starts_at = ${occurrence.starts_at}::timestamptz,
      ends_at = ${occurrence.ends_at}::timestamptz
    where id = ${rentalId}::uuid
    returning id, staff_id, room, starts_at, ends_at, status, cancelled_at, cancelled_by
  `;
  const updated = updatedRows[0];
  if (!updated) throw codedError("ROOM_RENTAL_WRITE_FAILED");
  await writeAudit(
    tx,
    actorUserId,
    "ROOM_RENTAL_OVERWRITE",
    rentalId,
    existing,
    updated,
    "Admin confirmed replacing a conflicting room rental.",
  );
}

export function createRoomRentalsStore(sql: Sql = postgres(databaseUrl(), {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
})): {
  create(input: RoomRentalOccurrence, staffId: string, actorUserId: string): Promise<RoomRentalResult>;
  createMonth(
    occurrences: RoomRentalOccurrence[],
    staffId: string,
    actorUserId: string,
    range: RoomRentalMonthRange,
    confirmedConflictKeys?: string[],
  ): Promise<RoomRentalResult>;
  reschedule(input: RoomRentalOccurrence, rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
  cancel(rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
  delete(rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
} {
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

    async createMonth(occurrences, staffId, actorUserId, range, confirmedConflictKeys) {
      return await sql.begin(async (tx) => {
        await authorize(tx, actorUserId);
        await lockScheduling(tx);
        await assertActiveTeacher(tx, staffId);
        await lockMonthTeacherAssignments(tx);
        const conflicts = await findMonthConflicts(tx, occurrences, staffId);
        if (conflicts.length) {
          const canOverrideAll = conflicts.every((conflict) => conflict.can_override);
          const currentKeys = conflicts.map((conflict) => conflict.key).sort();
          const confirmedKeys = confirmedConflictKeys?.slice().sort();
          const matchesCurrentConflicts = !!confirmedKeys
            && currentKeys.length === confirmedKeys.length
            && currentKeys.every((key, index) => key === confirmedKeys[index]);
          if (!canOverrideAll || !matchesCurrentConflicts) {
            throw codedError("ROOM_RENTAL_CONFLICT", conflicts);
          }
        }

        const hasConfirmedClassOverlap = conflicts.some((conflict) => conflict.action === "ALLOW_CLASS_OVERLAP");
        await tx`
          select
            set_config('hvc.room_rental_allow_past', ${range === "FULL_MONTH" ? "true" : "false"}, true),
            set_config('hvc.room_rental_allow_class_overlap', ${hasConfirmedClassOverlap ? "true" : "false"}, true)
        `;

        const replacements = new Map<string, string>();
        for (const conflict of conflicts) {
          if (conflict.type === "RENTAL" && conflict.conflict_id) {
            const target = occurrenceKey({
              date: conflict.date,
              start_time: conflict.start_time,
              end_time: conflict.end_time,
              room: conflict.room,
              starts_at: conflict.starts_at,
              ends_at: conflict.ends_at,
            });
            replacements.set(target, conflict.conflict_id);
          }
        }

        let createdCount = 0;
        let overwrittenCount = 0;
        for (const occurrence of occurrences) {
          const replacementId = replacements.get(occurrenceKey(occurrence));
          if (replacementId) {
            await overwriteRental(tx, replacementId, staffId, occurrence, actorUserId);
            overwrittenCount += 1;
          } else {
            await insertRental(tx, staffId, occurrence, actorUserId);
            createdCount += 1;
          }
        }
        return { created_count: createdCount, overwritten_count: overwrittenCount, status: "BOOKED" };
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

    async delete(rentalId, actorUserId) {
      return await sql.begin(async (tx) => {
        await authorize(tx, actorUserId);
        await lockScheduling(tx);
        const rows = await tx<RentalRow[]>`
          select id, staff_id, room, starts_at, ends_at, status, created_by,
            cancelled_at, cancelled_by, created_at, updated_at
          from public.room_rentals where id = ${rentalId}::uuid for update
        `;
        const existing = rows[0];
        if (!existing) throw codedError("ROOM_RENTAL_NOT_FOUND");

        const deletedRows = await tx<IdRow[]>`
          delete from public.room_rentals where id = ${rentalId}::uuid returning id
        `;
        if (!deletedRows[0]) throw codedError("ROOM_RENTAL_WRITE_FAILED");

        await writeAudit(
          tx,
          actorUserId,
          "ROOM_RENTAL_DELETE",
          rentalId,
          existing,
          null,
          "Admin permanently deleted a room rental.",
        );
        return { rental_id: rentalId, status: "DELETED" };
      });
    },
  };
}
