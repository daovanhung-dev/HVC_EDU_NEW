import postgres from "npm:postgres@3.4.7";
import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import type {
  FinalizeSessionInput,
  FinalizeSessionResult,
  TeacherDecisionInput,
} from "./types.ts";

interface SessionRow {
  id: string;
  status: string;
  scheduled_end_at: string;
  scheduled_end_is_future?: boolean;
  session_note: string | null;
  lesson_youtube_url: string | null;
  ended_at: string | null;
  ended_by: string | null;
}

interface PermissionRow {
  academic_manage: boolean;
  timesheet_approve: boolean;
}

interface IdRow {
  id: string;
}

interface StaffRow {
  staff_id: string;
  timesheet_eligible: boolean | null;
}

interface TimesheetRow {
  id: string;
  status: string;
}

interface CodedError extends Error {
  code?: string;
}

const NO_PAY_REASON = "Admin xác nhận buổi học không tính công.";

function codedError(code: string): CodedError {
  const error = new Error(code) as CodedError;
  error.code = code;
  return error;
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

async function setActorContext(tx: TransactionSql, actorUserId: string) {
  await tx`
    select
      set_config('request.jwt.claim.sub', ${actorUserId}, true),
      set_config('request.jwt.claim.role', 'authenticated', true)
  `;
}

async function hasPermission(
  tx: TransactionSql,
  actorUserId: string,
): Promise<boolean> {
  const rows = await tx<PermissionRow[]>`
    select
      public.actor_has_permission(${actorUserId}::uuid, 'ACADEMIC_MANAGE') as academic_manage,
      public.actor_has_permission(${actorUserId}::uuid, 'TIMESHEET_APPROVE') as timesheet_approve
  `;
  return rows[0]?.academic_manage === true &&
    rows[0]?.timesheet_approve === true;
}

async function readAttendance(
  tx: TransactionSql,
  sessionId: string,
): Promise<unknown[]> {
  const rows = await tx<{ data: unknown[] }[]>`
    select coalesce(jsonb_agg(to_jsonb(sa) order by sa.student_id), '[]'::jsonb) as data
    from public.student_attendances sa
    where sa.session_id = ${sessionId}::uuid
  `;
  return rows[0]?.data ?? [];
}

async function readTeacherDecisions(
  tx: TransactionSql,
  sessionId: string,
): Promise<unknown[]> {
  const rows = await tx<{ data: unknown[] }[]>`
    select coalesce(
      jsonb_agg(jsonb_build_object('staff_id', ss.staff_id, 'timesheet_eligible', ss.timesheet_eligible) order by ss.staff_id),
      '[]'::jsonb
    ) as data
    from public.session_staff ss
    where ss.session_id = ${sessionId}::uuid and ss.assignment_role = 'TEACHER'
  `;
  return rows[0]?.data ?? [];
}

async function writeAudit(
  tx: TransactionSql,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldData: unknown,
  newData: unknown,
  reason: string | null = null,
) {
  const oldJson = oldData === null
    ? null
    : tx.json(oldData as Parameters<typeof tx.json>[0]);
  const newJson = newData === null
    ? null
    : tx.json(newData as Parameters<typeof tx.json>[0]);
  await tx`
    select public.write_audit(
      ${actorUserId}::uuid,
      ${action},
      ${entityType},
      ${entityId}::uuid,
      ${oldJson}::jsonb,
      ${newJson}::jsonb,
      ${reason}
    )
  `;
}

function jsonValue<T>(tx: TransactionSql, value: T) {
  return tx.json(value as Parameters<typeof tx.json>[0]);
}

async function applyTeacherDecisions(
  tx: TransactionSql,
  sessionId: string,
  decisions: TeacherDecisionInput[],
  actorUserId: string,
): Promise<{ approved: number; notEligible: number }> {
  let approved = 0;
  let notEligible = 0;

  for (
    const decision of [...decisions].sort((a, b) =>
      a.staff_id.localeCompare(b.staff_id)
    )
  ) {
    const staffRows = await tx<StaffRow[]>`
      select ss.staff_id, ss.timesheet_eligible
      from public.session_staff ss
      where ss.session_id = ${sessionId}::uuid
        and ss.staff_id = ${decision.staff_id}::uuid
        and ss.assignment_role = 'TEACHER'
      for update
    `;
    const staff = staffRows[0];
    if (!staff) throw codedError("SESSION_TEACHER_DECISION_REQUIRED");
    const oldEligible = staff.timesheet_eligible;

    await tx`
      update public.session_staff
      set timesheet_eligible = ${decision.eligible}
      where session_id = ${sessionId}::uuid
        and staff_id = ${decision.staff_id}::uuid
        and assignment_role = 'TEACHER'
    `;

    const timesheetRows = await tx<TimesheetRow[]>`
      select t.id, t.status
      from public.timesheets t
      where t.session_id = ${sessionId}::uuid and t.staff_id = ${decision.staff_id}::uuid
      for update
    `;
    const timesheet = timesheetRows[0];
    const oldStatus = timesheet?.status ?? null;

    if (decision.eligible) {
      approved += 1;
      if (!timesheet) {
        const inserted = await tx<IdRow[]>`
          insert into public.timesheets(session_id, staff_id, status, approved_at, approved_by)
          values (${sessionId}::uuid, ${decision.staff_id}::uuid, 'APPROVED', now(), ${actorUserId}::uuid)
          returning id
        `;
        if (!inserted[0]?.id) throw codedError("TIMESHEET_WRITE_FAILED");
        await writeAudit(
          tx,
          actorUserId,
          "TIMESHEET_ADMIN_APPROVE",
          "timesheets",
          inserted[0].id,
          null,
          {
            status: "APPROVED",
            session_id: sessionId,
            staff_id: decision.staff_id,
          },
        );
      } else if (oldStatus !== "APPROVED" || oldEligible !== true) {
        await tx`
          update public.timesheets
          set status = 'APPROVED', approved_at = now(), approved_by = ${actorUserId}::uuid,
            rejection_reason = null, revoked_at = null, revoked_by = null, revoked_reason = null
          where id = ${timesheet.id}::uuid
        `;
        await writeAudit(
          tx,
          actorUserId,
          "TIMESHEET_ADMIN_APPROVE",
          "timesheets",
          timesheet.id,
          { status: oldStatus, timesheet_eligible: oldEligible },
          {
            status: "APPROVED",
            timesheet_eligible: true,
            session_id: sessionId,
            staff_id: decision.staff_id,
          },
        );
      }
      continue;
    }

    notEligible += 1;
    if (timesheet && oldStatus === "APPROVED") {
      await tx`
        update public.timesheets
        set status = 'REVOKED', revoked_at = now(), revoked_by = ${actorUserId}::uuid,
          revoked_reason = ${NO_PAY_REASON}, rejection_reason = null
        where id = ${timesheet.id}::uuid
      `;
      await writeAudit(
        tx,
        actorUserId,
        "TIMESHEET_ADMIN_REVOKE",
        "timesheets",
        timesheet.id,
        { status: oldStatus, timesheet_eligible: oldEligible },
        {
          status: "REVOKED",
          timesheet_eligible: false,
          session_id: sessionId,
          staff_id: decision.staff_id,
        },
        NO_PAY_REASON,
      );
    } else if (
      timesheet &&
      (oldStatus === "PENDING" ||
        oldStatus === "REJECTED" && oldEligible !== false)
    ) {
      await tx`
        update public.timesheets
        set status = 'REJECTED', approved_at = null, approved_by = null,
          rejection_reason = ${NO_PAY_REASON}, revoked_at = null, revoked_by = null, revoked_reason = null
        where id = ${timesheet.id}::uuid
      `;
      await writeAudit(
        tx,
        actorUserId,
        "TIMESHEET_ADMIN_NOT_ELIGIBLE",
        "timesheets",
        timesheet.id,
        { status: oldStatus, timesheet_eligible: oldEligible },
        {
          status: "REJECTED",
          timesheet_eligible: false,
          session_id: sessionId,
          staff_id: decision.staff_id,
        },
        NO_PAY_REASON,
      );
    }
  }

  return { approved, notEligible };
}

export async function finalizeInTransaction(
  tx: TransactionSql,
  input: FinalizeSessionInput,
  actorUserId: string,
): Promise<FinalizeSessionResult> {
  await setActorContext(tx, actorUserId);
  if (!(await hasPermission(tx, actorUserId))) throw codedError("FORBIDDEN");

  const sessionRows = await tx<SessionRow[]>`
    select id, status, scheduled_end_at, scheduled_end_at > now() as scheduled_end_is_future,
      session_note, lesson_youtube_url, ended_at, ended_by
    from public.sessions
    where id = ${input.session_id}::uuid
    for update
  `;
  const session = sessionRows[0];
  if (!session) throw codedError("SESSION_NOT_FOUND");
  if (session.status === "CANCELLED") throw codedError("SESSION_CANCELLED");
  if (
    session.status === "SCHEDULED" && session.scheduled_end_is_future
  ) {
    throw codedError("ADMIN_SESSION_NOT_FINISHED");
  }

  const url = input.lesson_youtube_url?.trim() || null;
  if (
    url && !(
      /^https?:\/\/(www\.)?youtu\.be\/[A-Za-z0-9_-]{11}([?#].*)?$/i.test(url) ||
      /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtube-nocookie\.com)\/(watch\?[^#]*v=[A-Za-z0-9_-]{11}(&[^#]*)?|embed\/[A-Za-z0-9_-]{11}([?#].*)?|shorts\/[A-Za-z0-9_-]{11}([?#].*)?|live\/[A-Za-z0-9_-]{11}([?#].*)?)$/i
        .test(url)
    )
  ) throw codedError("INVALID_YOUTUBE_URL");

  const rosterRows = await tx<{ student_id: string }[]>`
    select student_id from public.session_students
    where session_id = ${input.session_id}::uuid
    order by student_id
    for update
  `;
  const submittedStudentIds = input.students.map((student) =>
    student.student_id
  );
  if (new Set(submittedStudentIds).size !== submittedStudentIds.length) {
    throw codedError("DUPLICATE_STUDENT");
  }
  const rosterIds = rosterRows.map((row) => row.student_id).sort();
  if (
    rosterIds.length !== submittedStudentIds.length ||
    rosterIds.some((id, index) => id !== [...submittedStudentIds].sort()[index])
  ) throw codedError("SESSION_ROSTER_MISMATCH");

  const teacherRows = await tx<StaffRow[]>`
    select staff_id, timesheet_eligible from public.session_staff
    where session_id = ${input.session_id}::uuid and assignment_role = 'TEACHER'
    order by staff_id
    for update
  `;
  if (teacherRows.length === 0) {
    throw codedError("ADMIN_SESSION_TEACHER_REQUIRED");
  }
  const decisionIds = input.teacher_decisions.map((decision) =>
    decision.staff_id
  );
  if (new Set(decisionIds).size !== decisionIds.length) {
    throw codedError("DUPLICATE_TEACHER_DECISION");
  }
  const sortedDecisionIds = [...decisionIds].sort();
  if (
    teacherRows.length !== decisionIds.length ||
    teacherRows.some((teacher, index) =>
      teacher.staff_id !== sortedDecisionIds[index]
    )
  ) throw codedError("SESSION_TEACHER_DECISION_REQUIRED");

  for (const student of input.students) {
    if (!student.status) throw codedError("ATTENDANCE_STATUS_REQUIRED");
    if (student.late_minutes !== null && student.late_minutes < 0) {
      throw codedError("INVALID_LATE_MINUTES");
    }
    if (
      student.homework_score !== null &&
      (student.homework_score < 0 || student.homework_score > 10)
    ) {
      throw codedError("INVALID_HOMEWORK_SCORE");
    }
    if (
      student.understanding_score !== null &&
      (student.understanding_score < 1 || student.understanding_score > 5)
    ) {
      throw codedError("INVALID_UNDERSTANDING_SCORE");
    }
    if (
      student.attitude_score !== null &&
      (student.attitude_score < 1 || student.attitude_score > 5)
    ) {
      throw codedError("INVALID_ATTITUDE_SCORE");
    }
    if (
      student.positive_feedback_count !== null &&
      student.positive_feedback_count < 0
    ) {
      throw codedError("INVALID_FEEDBACK_COUNT");
    }
    if (student.comment !== null && student.comment.length > 2000) {
      throw codedError("INVALID_COMMENT");
    }
  }

  const oldAttendance = await readAttendance(tx, input.session_id);
  const oldDecisions = await readTeacherDecisions(tx, input.session_id);
  const sessionNote = input.session_note?.trim() || null;
  const updatedSessionRows = await tx<SessionRow[]>`
    update public.sessions
    set session_note = ${sessionNote},
      lesson_youtube_url = ${url},
      status = 'COMPLETED',
      ended_at = coalesce(ended_at, now()),
      ended_by = case when ended_at is null then ${actorUserId}::uuid else ended_by end
    where id = ${input.session_id}::uuid
    returning id, status, scheduled_end_at, session_note, lesson_youtube_url, ended_at, ended_by
  `;
  const updatedSession = updatedSessionRows[0];
  if (!updatedSession?.ended_at) throw codedError("SESSION_FINALIZE_FAILED");

  if (input.students.length > 0) {
    const studentsJson = jsonValue(tx, input.students);
    await tx`
      insert into public.student_attendances(
        session_id, student_id, status, late_minutes, absence_reason, homework_score,
        homework_note, understanding_score, attitude_score, positive_feedback_count,
        positive_feedback_raw, comment, updated_by
      )
      select ${input.session_id}::uuid, x.student_id, x.status::public.attendance_status,
        x.late_minutes, nullif(btrim(x.absence_reason), ''), x.homework_score,
        nullif(btrim(x.homework_note), ''), x.understanding_score, x.attitude_score,
        x.positive_feedback_count, nullif(btrim(x.positive_feedback_raw), ''),
        nullif(btrim(x.comment), ''), ${actorUserId}::uuid
      from jsonb_to_recordset(${studentsJson}::jsonb) as x(
        student_id uuid, status text, late_minutes integer, absence_reason text,
        homework_score numeric, homework_note text, understanding_score smallint,
        attitude_score smallint, positive_feedback_count integer,
        positive_feedback_raw text, comment text
      )
      on conflict (session_id, student_id) do update set
        status = excluded.status,
        late_minutes = excluded.late_minutes,
        absence_reason = excluded.absence_reason,
        homework_score = excluded.homework_score,
        homework_note = excluded.homework_note,
        understanding_score = excluded.understanding_score,
        attitude_score = excluded.attitude_score,
        positive_feedback_count = excluded.positive_feedback_count,
        positive_feedback_raw = excluded.positive_feedback_raw,
        comment = excluded.comment,
        updated_by = excluded.updated_by
    `;
  }

  const teacherResult = await applyTeacherDecisions(
    tx,
    input.session_id,
    input.teacher_decisions,
    actorUserId,
  );
  const newAttendance = await readAttendance(tx, input.session_id);
  const newDecisions = await readTeacherDecisions(tx, input.session_id);
  await writeAudit(
    tx,
    actorUserId,
    "SESSION_ADMIN_ATTENDANCE_AND_TIMESHEETS",
    "sessions",
    input.session_id,
    {
      status: session.status,
      session_note: session.session_note,
      lesson_youtube_url: session.lesson_youtube_url,
      attendance: oldAttendance,
      teacher_decisions: oldDecisions,
    },
    {
      status: "COMPLETED",
      session_note: sessionNote,
      lesson_youtube_url: url,
      attendance: newAttendance,
      teacher_decisions: newDecisions,
      students_updated: input.students.length,
      timesheets_approved: teacherResult.approved,
      teachers_not_eligible: teacherResult.notEligible,
    },
  );

  return {
    session_id: input.session_id,
    status: "COMPLETED",
    students_updated: input.students.length,
    timesheets_approved: teacherResult.approved,
    teachers_not_eligible: teacherResult.notEligible,
    ended_at: updatedSession.ended_at,
    ended_by: updatedSession.ended_by,
  };
}

export function createSessionAttendanceFinalizeStore(
  database = createDatabase(),
) {
  return {
    async finalize(
      input: FinalizeSessionInput,
      actorUserId: string,
    ): Promise<FinalizeSessionResult> {
      return await database.begin((tx) =>
        finalizeInTransaction(tx, input, actorUserId)
      );
    },
    async close() {
      await database.end();
    },
  };
}
