import postgres from "npm:postgres@3.4.7";
import type { Sql, TransactionSql } from "npm:postgres@3.4.7";

export type MembershipPermission = "CLASS_MANAGE" | "STUDENTS_MANAGE";

export interface MembershipSyncResult {
  membership_id: string;
  sessions_updated: number;
  students_added: number;
  sessions_skipped_with_attendance: number;
}

export interface MembershipAccountAudit {
  profile_id: string;
  username: string;
}

export interface MembershipEnrollmentInput {
  class_id: string;
  student_id: string;
  start_date: string;
  actor_user_id: string;
  account_audit?: MembershipAccountAudit;
}

export interface ClassMembershipEnrollmentStore {
  hasPermission(
    userId: string,
    permission: MembershipPermission,
  ): Promise<boolean>;
  isActiveClass(classId: string): Promise<boolean>;
  enroll(input: MembershipEnrollmentInput): Promise<MembershipSyncResult>;
  close(): Promise<void>;
}

interface CodedError extends Error {
  code?: string;
  details?: unknown;
}

interface IdRow {
  id: string;
}

interface SessionRow {
  id: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  session_date: string;
  room: string | null;
}

interface ConflictRow {
  reason: string | null;
}

interface StudentIdsRow {
  student_ids: string[];
}

function codedError(code: string, details?: unknown): CodedError {
  return Object.assign(new Error(code), { code, details });
}

function databaseUrl(): string {
  const value = Deno.env.get("SUPABASE_DB_URL");
  if (!value) throw codedError("SUPABASE_DB_URL_MISSING");
  return value;
}

function createDatabase(): Sql {
  return postgres(databaseUrl(), {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

async function setActorContext(tx: TransactionSql, actorUserId: string) {
  await tx`
    select
      set_config('request.jwt.claim.sub', ${actorUserId}, true),
      set_config('request.jwt.claim.role', 'authenticated', true)
  `;
}

async function hasPermission(
  sql: Sql,
  userId: string,
  permission: MembershipPermission,
): Promise<boolean> {
  const rows = await sql<{ allowed: boolean }[]>`
    select public.actor_has_permission(${userId}::uuid, ${permission}) as allowed
  `;
  return rows[0]?.allowed === true;
}

async function writeSessionRosterAudit(
  tx: TransactionSql,
  actorUserId: string,
  sessionId: string,
  before: string[],
  after: string[],
) {
  await tx`
    select public.write_audit(
      ${actorUserId}::uuid,
      'SESSION_ROSTER_SYNC',
      'sessions',
      ${sessionId}::uuid,
      ${tx.json({ student_ids: before })}::jsonb,
      ${
    tx.json({
      student_ids: after,
      added: 1,
      removed: 0,
      retained_with_history: 0,
    })
  }::jsonb,
      'Admin enrolled a student and synchronized the remaining scheduled sessions in the start month.'
    )
  `;
}

async function writeAccountAudit(
  tx: TransactionSql,
  actorUserId: string,
  classId: string,
  audit: MembershipAccountAudit,
) {
  await tx`
    select public.write_audit(
      ${actorUserId}::uuid,
      'ACCOUNT_CREATE',
      'profiles',
      ${audit.profile_id}::uuid,
      null,
      ${
    tx.json({ role: "STUDENT", username: audit.username, class_id: classId })
  }::jsonb,
      null
    )
  `;
}

export function createClassMembershipEnrollmentStore(): ClassMembershipEnrollmentStore {
  const sql = createDatabase();

  return {
    hasPermission: (userId, permission) =>
      hasPermission(sql, userId, permission),

    async isActiveClass(classId) {
      const rows = await sql<IdRow[]>`
        select id from public.classes where id = ${classId}::uuid and status = 'ACTIVE'
      `;
      return rows.length === 1;
    },

    async enroll(input) {
      if (!validDate(input.start_date)) throw codedError("INVALID_INPUT");

      return await sql.begin(async (tx) => {
        await setActorContext(tx, input.actor_user_id);

        const permissions = await tx<{ allowed: boolean }[]>`
          select public.actor_has_permission(${input.actor_user_id}::uuid, 'CLASS_MANAGE') as allowed
        `;
        if (permissions[0]?.allowed !== true) throw codedError("FORBIDDEN");

        await tx`select pg_advisory_xact_lock(hashtext('continuous-class-session-generator'))`;
        await tx`lock table public.class_memberships in share row exclusive mode`;

        const classes = await tx<IdRow[]>`
          select id from public.classes
          where id = ${input.class_id}::uuid and status = 'ACTIVE'
          for share
        `;
        if (!classes.length) throw codedError("CLASS_NOT_ACTIVE");

        const students = await tx<IdRow[]>`
          select id from public.students
          where id = ${input.student_id}::uuid and status = 'ACTIVE'
          for share
        `;
        if (!students.length) throw codedError("STUDENT_NOT_ACTIVE");

        const existingMembership = await tx<IdRow[]>`
          select id from public.class_memberships
          where class_id = ${input.class_id}::uuid
            and student_id = ${input.student_id}::uuid
            and status = 'ACTIVE'
            and (end_date is null or end_date >= ${input.start_date}::date)
          limit 1
          for update
        `;
        if (existingMembership.length) {
          throw codedError("STUDENT_ALREADY_IN_CLASS");
        }

        const membershipRows = await tx<IdRow[]>`
          insert into public.class_memberships (
            class_id, student_id, start_date, status, created_by
          ) values (
            ${input.class_id}::uuid,
            ${input.student_id}::uuid,
            ${input.start_date}::date,
            'ACTIVE',
            ${input.actor_user_id}::uuid
          )
          returning id
        `;
        const membershipId = membershipRows[0]?.id;
        if (!membershipId) throw codedError("MEMBERSHIP_CREATE_FAILED");

        const sessions = await tx<SessionRow[]>`
          select
            s.id,
            s.scheduled_start_at,
            s.scheduled_end_at,
            (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date::text as session_date,
            s.room
          from public.sessions s
          where s.class_id = ${input.class_id}::uuid
            and s.status = 'SCHEDULED'
            and s.scheduled_start_at > now()
            and s.started_at is null
            and s.ended_at is null
            and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
              between ${input.start_date}::date
                and (date_trunc('month', ${input.start_date}::date)::date + interval '1 month - 1 day')::date
          order by s.scheduled_start_at, s.id
          for update of s
        `;

        let sessionsUpdated = 0;
        let studentsAdded = 0;
        let sessionsSkippedWithAttendance = 0;

        for (const session of sessions) {
          const attendance = await tx<{ present: boolean }[]>`
            select exists (
              select 1 from public.student_attendances where session_id = ${session.id}::uuid
            ) as present
          `;
          if (attendance[0]?.present) {
            sessionsSkippedWithAttendance += 1;
            continue;
          }

          const existingRosterRow = await tx<IdRow[]>`
            select student_id as id from public.session_students
            where session_id = ${session.id}::uuid and student_id = ${input.student_id}::uuid
          `;
          if (existingRosterRow.length) continue;

          const conflicts = await tx<ConflictRow[]>`
            select public.session_schedule_conflict_reason(
              ${session.id}::uuid,
              ${input.class_id}::uuid,
              ${session.scheduled_start_at}::timestamptz,
              ${session.scheduled_end_at}::timestamptz,
              ${session.room},
              array[${input.student_id}::uuid]
            ) as reason
          `;
          const reason = conflicts[0]?.reason;
          if (reason) {
            throw codedError("MEMBERSHIP_ROSTER_SYNC_CONFLICT", {
              session_date: session.session_date,
              reason,
            });
          }

          const beforeRows = await tx<StudentIdsRow[]>`
            select coalesce(array_agg(student_id order by student_id), '{}'::uuid[]) as student_ids
            from public.session_students
            where session_id = ${session.id}::uuid
          `;
          const inserted = await tx<IdRow[]>`
            insert into public.session_students(session_id, student_id)
            values (${session.id}::uuid, ${input.student_id}::uuid)
            on conflict (session_id, student_id) do nothing
            returning session_id as id
          `;
          if (!inserted.length) continue;

          const afterRows = await tx<StudentIdsRow[]>`
            select coalesce(array_agg(student_id order by student_id), '{}'::uuid[]) as student_ids
            from public.session_students
            where session_id = ${session.id}::uuid
          `;
          await writeSessionRosterAudit(
            tx,
            input.actor_user_id,
            session.id,
            beforeRows[0]?.student_ids ?? [],
            afterRows[0]?.student_ids ?? [],
          );
          sessionsUpdated += 1;
          studentsAdded += 1;
        }

        if (input.account_audit) {
          await writeAccountAudit(
            tx,
            input.actor_user_id,
            input.class_id,
            input.account_audit,
          );
        }

        return {
          membership_id: membershipId,
          sessions_updated: sessionsUpdated,
          students_added: studentsAdded,
          sessions_skipped_with_attendance: sessionsSkippedWithAttendance,
        };
      });
    },

    close: () => sql.end(),
  };
}
