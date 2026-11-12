import postgres from "npm:postgres@3.4.7";
import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import { createClassMembershipEnrollmentStore } from "../_shared/class-membership-enrollment.ts";

const databaseUrl = Deno.env.get("SUPABASE_DB_URL") ?? "";
const isLocalDatabase = (() => {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(
      new URL(databaseUrl).hostname,
    );
  } catch {
    return false;
  }
})();
const startDate = "2030-01-10";

interface Fixture {
  actorUserId: string;
  classId: string;
  conflictClassId: string;
  studentId: string;
  existingStudentId: string;
  sessionIds: string[];
  otherUserIds: string[];
  subjectId: string;
  gradeId: string;
}

function uuid(): string {
  return crypto.randomUUID();
}

async function createFixture(
  sql: Sql,
  includeConflict: boolean,
): Promise<Fixture> {
  const actorUserId = uuid();
  const existingUserId = uuid();
  const studentUserId = uuid();
  const suffix = uuid().slice(0, 8).toUpperCase();
  const classId = uuid();
  const conflictClassId = uuid();
  const studentId = uuid();
  const existingStudentId = uuid();
  const subjectId = uuid();
  const gradeId = uuid();
  const sessionIds = Array.from({ length: includeConflict ? 6 : 5 }, uuid);
  const otherUserIds = [actorUserId, existingUserId, studentUserId];

  await sql.begin(async (tx) => {
    await insertUsers(tx, [
      {
        id: actorUserId,
        email: `qa-membership-admin-${suffix}@example.invalid`,
      },
      {
        id: existingUserId,
        email: `qa-membership-existing-${suffix}@example.invalid`,
      },
      {
        id: studentUserId,
        email: `qa-membership-new-${suffix}@example.invalid`,
      },
    ]);
    await tx`
      insert into public.profiles(user_id, role, username, display_name, status, force_password_change)
      values (${actorUserId}::uuid, 'ROOT_ADMIN', ${`QA-MEMBERSHIP-ADMIN-${suffix}`}, 'QA Membership Admin', 'ACTIVE', false)
    `;
    await tx`
      insert into public.students(id, user_id, student_code, full_name, status)
      values
        (${existingStudentId}::uuid, ${existingUserId}::uuid, ${`QA-EXISTING-${suffix}`}, 'QA Membership Existing', 'ACTIVE'),
        (${studentId}::uuid, ${studentUserId}::uuid, ${`QA-NEW-${suffix}`}, 'QA Membership New', 'ACTIVE')
    `;
    await tx`
      insert into public.subjects(id, code, name, status)
      values (${subjectId}::uuid, ${`QA-MEMBERSHIP-SUB-${suffix}`}, 'QA Membership Subject', 'ACTIVE')
    `;
    await tx`
      insert into public.grades(id, code, name, status)
      values (${gradeId}::uuid, ${`QA-MEMBERSHIP-GRADE-${suffix}`}, 'QA Membership Grade', 'ACTIVE')
    `;
    await tx`
      insert into public.classes(id, code, name, subject_id, grade_id, status)
      values
        (${classId}::uuid, ${`QA-MEMBERSHIP-CLASS-${suffix}`}, 'QA Membership Class', ${subjectId}::uuid, ${gradeId}::uuid, 'ACTIVE'),
        (${conflictClassId}::uuid, ${`QA-MEMBERSHIP-OTHER-${suffix}`}, 'QA Membership Other Class', ${subjectId}::uuid, ${gradeId}::uuid, 'ACTIVE')
    `;
    await tx`
      insert into public.class_memberships(class_id, student_id, start_date, status)
      values
        (${classId}::uuid, ${existingStudentId}::uuid, '2020-01-01', 'ACTIVE'),
        (${conflictClassId}::uuid, ${studentId}::uuid, '2020-01-01', 'ACTIVE')
    `;

    const sessionDates = [
      ["2030-01-10T10:00:00+07:00", "2030-01-10T11:00:00+07:00"],
      ["2030-01-20T10:00:00+07:00", "2030-01-20T11:00:00+07:00"],
      ["2030-01-31T10:00:00+07:00", "2030-01-31T11:00:00+07:00"],
      ["2030-01-09T10:00:00+07:00", "2030-01-09T11:00:00+07:00"],
      ["2030-02-01T10:00:00+07:00", "2030-02-01T11:00:00+07:00"],
    ];
    for (const [index, [start, end]] of sessionDates.entries()) {
      await tx`
        insert into public.sessions(id, class_id, scheduled_start_at, scheduled_end_at, status)
        values (${
        sessionIds[index]
      }::uuid, ${classId}::uuid, ${start}::timestamptz, ${end}::timestamptz, 'SCHEDULED')
      `;
      await tx`
        insert into public.session_students(session_id, student_id)
        values (${sessionIds[index]}::uuid, ${existingStudentId}::uuid)
      `;
    }
    if (!includeConflict) {
      await tx`
        insert into public.student_attendances(session_id, student_id, status)
        values (${sessionIds[1]}::uuid, ${existingStudentId}::uuid, 'PRESENT')
      `;
    }

    if (includeConflict) {
      await tx`
        insert into public.sessions(id, class_id, scheduled_start_at, scheduled_end_at, status)
        values (${
        sessionIds[5]
      }::uuid, ${conflictClassId}::uuid, '2030-01-20T10:00:00+07:00', '2030-01-20T11:00:00+07:00', 'SCHEDULED')
      `;
      await tx`
        insert into public.session_students(session_id, student_id)
        values (${sessionIds[5]}::uuid, ${studentId}::uuid)
      `;
    }
  });

  return {
    actorUserId,
    classId,
    conflictClassId,
    studentId,
    existingStudentId,
    sessionIds,
    otherUserIds,
    subjectId,
    gradeId,
  };
}

async function insertUsers(
  tx: TransactionSql,
  users: Array<{ id: string; email: string }>,
) {
  for (const user of users) {
    await tx`
      insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
      values (${user.id}::uuid, 'authenticated', 'authenticated', ${user.email}, '', now(), '{}'::jsonb, '{}'::jsonb)
    `;
  }
}

async function cleanupFixture(sql: Sql, fixture: Fixture) {
  await sql.begin(async (tx) => {
    await tx`delete from public.audit_logs where actor_user_id = ${fixture.actorUserId}::uuid`;
    await tx`delete from public.student_attendances where session_id = any(${fixture.sessionIds}::uuid[])`;
    await tx`delete from public.session_students where session_id = any(${fixture.sessionIds}::uuid[])`;
    await tx`delete from public.sessions where id = any(${fixture.sessionIds}::uuid[])`;
    await tx`
      delete from public.class_memberships
      where class_id = any(array[${fixture.classId}::uuid, ${fixture.conflictClassId}::uuid])
    `;
    await tx`delete from public.students where id = any(array[${fixture.studentId}::uuid, ${fixture.existingStudentId}::uuid])`;
    await tx`delete from public.classes where id = any(array[${fixture.classId}::uuid, ${fixture.conflictClassId}::uuid])`;
    await tx`delete from public.subjects where id = ${fixture.subjectId}::uuid`;
    await tx`delete from public.grades where id = ${fixture.gradeId}::uuid`;
    await tx`delete from public.profiles where user_id = any(${fixture.otherUserIds}::uuid[])`;
    await tx`delete from auth.users where id = any(${fixture.otherUserIds}::uuid[])`;
  });
}

Deno.test({
  name:
    "enrollment includes the start day, stops at month end, and skips attendance history",
  ignore: !isLocalDatabase,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sql = postgres(databaseUrl!, { max: 1, prepare: false });
    const store = createClassMembershipEnrollmentStore();
    let fixture: Fixture | null = null;
    try {
      fixture = await createFixture(sql, false);
      const result = await store.enroll({
        class_id: fixture.classId,
        student_id: fixture.studentId,
        start_date: startDate,
        actor_user_id: fixture.actorUserId,
      });
      const rows = await sql<{
        counts: number[];
        existing_roster_count: number;
      }[]>`
        select array[
          (select count(*)::int from public.session_students where session_id = ${
        fixture.sessionIds[0]
      }::uuid and student_id = ${fixture.studentId}::uuid),
          (select count(*)::int from public.session_students where session_id = ${
        fixture.sessionIds[1]
      }::uuid and student_id = ${fixture.studentId}::uuid),
          (select count(*)::int from public.session_students where session_id = ${
        fixture.sessionIds[2]
      }::uuid and student_id = ${fixture.studentId}::uuid),
          (select count(*)::int from public.session_students where session_id = ${
        fixture.sessionIds[3]
      }::uuid and student_id = ${fixture.studentId}::uuid),
          (select count(*)::int from public.session_students where session_id = ${
        fixture.sessionIds[4]
      }::uuid and student_id = ${fixture.studentId}::uuid)
        ] as counts,
        (select count(*)::int from public.session_students
          where session_id = any(${fixture.sessionIds.slice(0, 5)}::uuid[])
            and student_id = ${fixture.existingStudentId}::uuid) as existing_roster_count
      `;
      const counts = rows[0]?.counts ?? [];
      if (
        result.sessions_updated !== 2 || result.students_added !== 2 ||
        result.sessions_skipped_with_attendance !== 1
      ) {
        throw new Error(
          "the store should add the student to two eligible sessions and skip attendance history",
        );
      }
      if (counts.join(",") !== "1,0,1,0,0") {
        throw new Error(
          "the store should include the start date, stop at month end, and ignore dates before enrollment",
        );
      }
      if (rows[0]?.existing_roster_count !== 5) {
        throw new Error(
          "existing students should remain in every planned session",
        );
      }
    } finally {
      if (fixture) await cleanupFixture(sql, fixture);
      await store.close();
      await sql.end();
    }
  },
});

Deno.test({
  name:
    "a roster conflict rolls back the membership and earlier session additions",
  ignore: !isLocalDatabase,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sql = postgres(databaseUrl!, { max: 1, prepare: false });
    const store = createClassMembershipEnrollmentStore();
    let fixture: Fixture | null = null;
    try {
      fixture = await createFixture(sql, true);
      let caught:
        | { code?: string; details?: { session_date?: string } }
        | null = null;
      try {
        await store.enroll({
          class_id: fixture.classId,
          student_id: fixture.studentId,
          start_date: startDate,
          actor_user_id: fixture.actorUserId,
        });
      } catch (error) {
        caught = error as {
          code?: string;
          details?: { session_date?: string };
        };
      }
      if (
        caught?.code !== "MEMBERSHIP_ROSTER_SYNC_CONFLICT" ||
        caught.details?.session_date !== "2030-01-20"
      ) {
        throw new Error("the conflict should include its local business date");
      }
      const rows = await sql<{
        membership_count: number;
        roster_count: number;
        audit_count: number;
      }[]>`
        select
          (select count(*)::int from public.class_memberships where class_id = ${fixture.classId}::uuid and student_id = ${fixture.studentId}::uuid) as membership_count,
          (select count(*)::int from public.session_students where session_id = ${
        fixture.sessionIds[0]
      }::uuid and student_id = ${fixture.studentId}::uuid) as roster_count,
          (select count(*)::int from public.audit_logs where actor_user_id = ${fixture.actorUserId}::uuid and action = 'SESSION_ROSTER_SYNC' and entity_id = any(${fixture.sessionIds}::uuid[])) as audit_count
      `;
      if (
        rows[0]?.membership_count !== 0 || rows[0]?.roster_count !== 0 ||
        rows[0]?.audit_count !== 0
      ) {
        throw new Error(
          "membership, earlier roster writes, and their audit should roll back",
        );
      }
    } finally {
      if (fixture) await cleanupFixture(sql, fixture);
      await store.close();
      await sql.end();
    }
  },
});
