import postgres from "npm:postgres@3.4.7";
import { createMonthTemplateAdditionHandler } from "./handler.ts";
import { createMonthTemplateAdditionStore } from "./store.ts";
import type { TemplateInput } from "./types.ts";

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");

interface Fixture {
  userId: string;
  authUserIds: string[];
  teacherOne: string;
  teacherTwo: string;
  studentId: string;
  subjectId: string;
  gradeId: string;
  classId: string;
  scheduleId: string;
  monthStart: string;
  mondayDates: string[];
  fridayDates: string[];
  safeDuplicateId: string;
  cancelledDuplicateId: string;
  protectedDuplicateId: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function addUtcDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function monthStartAfterCurrentHcmcMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function datesForWeekday(monthStart: string, isoWeekday: number): string[] {
  const [year, month] = monthStart.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(
    0,
    10,
  );
  const result: string[] = [];
  for (let date = monthStart; date < monthEnd; date = addUtcDays(date, 1)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    if (weekday === isoWeekday) result.push(date);
  }
  return result;
}

function timestamp(date: string, time: string): string {
  return `${date}T${time}:00+07:00`;
}

async function seedFixture(sql: ReturnType<typeof postgres>): Promise<Fixture> {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10)
    .toUpperCase();
  const userId = crypto.randomUUID();
  const teacherOneUserId = crypto.randomUUID();
  const teacherTwoUserId = crypto.randomUUID();
  const studentUserId = crypto.randomUUID();
  const teacherOne = crypto.randomUUID();
  const teacherTwo = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const subjectId = crypto.randomUUID();
  const gradeId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  const scheduleId = crypto.randomUUID();
  const monthStart = monthStartAfterCurrentHcmcMonth();
  const mondayDates = datesForWeekday(monthStart, 1);
  const fridayDates = datesForWeekday(monthStart, 5);
  const safeDuplicateId = crypto.randomUUID();
  const cancelledDuplicateId = crypto.randomUUID();
  const protectedDuplicateId = crypto.randomUUID();

  await sql.begin(async (tx) => {
    await tx`
      insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data
      ) values
        (${userId}::uuid, 'authenticated', 'authenticated', ${`qa-template-edge-admin-${suffix}@example.invalid`}, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
        (${teacherOneUserId}::uuid, 'authenticated', 'authenticated', ${`qa-template-edge-teacher-1-${suffix}@example.invalid`}, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
        (${teacherTwoUserId}::uuid, 'authenticated', 'authenticated', ${`qa-template-edge-teacher-2-${suffix}@example.invalid`}, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
        (${studentUserId}::uuid, 'authenticated', 'authenticated', ${`qa-template-edge-student-${suffix}@example.invalid`}, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
    `;
    await tx`
      insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
        (${userId}::uuid, 'ROOT_ADMIN', ${`QA-TEMPLATE-EDGE-ADMIN-${suffix}`}, 'QA Template Edge Admin', 'ACTIVE', false),
        (${teacherOneUserId}::uuid, 'TEACHER', ${`QA-TEMPLATE-EDGE-T1-${suffix}`}, 'QA Template Edge Teacher 1', 'ACTIVE', false),
        (${teacherTwoUserId}::uuid, 'TEACHER', ${`QA-TEMPLATE-EDGE-T2-${suffix}`}, 'QA Template Edge Teacher 2', 'ACTIVE', false),
        (${studentUserId}::uuid, 'STUDENT', ${`QA-TEMPLATE-EDGE-S1-${suffix}`}, 'QA Template Edge Student', 'ACTIVE', false)
    `;
    await tx`
      insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
        (${teacherOne}::uuid, ${teacherOneUserId}::uuid, ${`QA-EDGE-T1-${suffix}`}, 'TEACHER', 'QA Template Edge Teacher 1', 'ACTIVE'),
        (${teacherTwo}::uuid, ${teacherTwoUserId}::uuid, ${`QA-EDGE-T2-${suffix}`}, 'TEACHER', 'QA Template Edge Teacher 2', 'ACTIVE')
    `;
    await tx`
      insert into public.students (id, user_id, student_code, full_name, status)
      values (${studentId}::uuid, ${studentUserId}::uuid, ${`QA-EDGE-S1-${suffix}`}, 'QA Template Edge Student', 'ACTIVE')
    `;
    await tx`insert into public.subjects (id, code, name, status) values (${subjectId}::uuid, ${`QA-EDGE-SUB-${suffix}`}, 'QA Edge Subject', 'ACTIVE')`;
    await tx`insert into public.grades (id, code, name, status) values (${gradeId}::uuid, ${`QA-EDGE-GRADE-${suffix}`}, 'QA Edge Grade', 'ACTIVE')`;
    await tx`
      insert into public.classes (id, code, name, subject_id, grade_id, status)
      values (${classId}::uuid, ${`QA-EDGE-CLASS-${suffix}`}, 'QA Edge Class', ${subjectId}::uuid, ${gradeId}::uuid, 'ACTIVE')
    `;
    await tx`
      insert into public.class_memberships (class_id, student_id, start_date, status)
      values (${classId}::uuid, ${studentId}::uuid, ${
      addUtcDays(monthStart, -30)
    }::date, 'ACTIVE')
    `;
    await tx`
      insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at, reviewed_by)
      values (${scheduleId}::uuid, ${classId}::uuid, 5, '14:00', '15:00', 'QA-EDGE-FRIDAY', 'ACTIVE', now(), ${userId}::uuid)
    `;
    await tx`insert into public.class_schedule_staff (schedule_id, staff_id) values (${scheduleId}::uuid, ${teacherOne}::uuid)`;

    for (
      const [index, sessionId] of [
        safeDuplicateId,
        cancelledDuplicateId,
        protectedDuplicateId,
      ].entries()
    ) {
      const date = mondayDates[index];
      await tx`
        insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, manual_schedule, room)
        values (
          ${sessionId}::uuid, ${classId}::uuid,
          ${timestamp(date, "08:00")}::timestamptz, ${
        timestamp(date, "09:00")
      }::timestamptz,
          ${index === 1 ? "CANCELLED" : "SCHEDULED"}, true,
          ${
        index === 0
          ? "QA-EDGE-OLD-ROOM"
          : index === 1
          ? "QA-EDGE-CANCELLED-ROOM"
          : "QA-EDGE-HISTORY-ROOM"
      }
        )
      `;
      await tx`insert into public.session_students (session_id, student_id) values (${sessionId}::uuid, ${studentId}::uuid)`;
      if (index === 0) {
        await tx`insert into public.session_staff (session_id, staff_id, assignment_role) values (${sessionId}::uuid, ${teacherOne}::uuid, 'TEACHER')`;
      }
      if (index === 2) {
        await tx`update public.session_students set assessment_snapshot = '{"homework_score":8}'::jsonb where session_id = ${sessionId}::uuid`;
      }
    }
  });

  return {
    userId,
    authUserIds: [userId, teacherOneUserId, teacherTwoUserId, studentUserId],
    teacherOne,
    teacherTwo,
    studentId,
    subjectId,
    gradeId,
    classId,
    scheduleId,
    monthStart,
    mondayDates,
    fridayDates,
    safeDuplicateId,
    cancelledDuplicateId,
    protectedDuplicateId,
  };
}

async function cleanupFixture(
  sql: ReturnType<typeof postgres>,
  fixture: Fixture,
) {
  await sql.begin(async (tx) => {
    await tx`delete from public.audit_logs where actor_user_id = ${fixture.userId}::uuid and action like 'SESSION_MONTH_TEMPLATE_ADD%'`;
    await tx`delete from public.session_staff where session_id in (select id from public.sessions where class_id = ${fixture.classId}::uuid)`;
    await tx`delete from public.session_students where session_id in (select id from public.sessions where class_id = ${fixture.classId}::uuid)`;
    await tx`delete from public.sessions where class_id = ${fixture.classId}::uuid`;
    await tx`delete from public.deleted_session_occurrences where class_schedule_id = ${fixture.scheduleId}::uuid`;
    await tx`delete from public.class_schedule_staff where schedule_id = ${fixture.scheduleId}::uuid`;
    await tx`delete from public.class_schedules where id = ${fixture.scheduleId}::uuid`;
    await tx`delete from public.class_memberships where class_id = ${fixture.classId}::uuid`;
    await tx`delete from public.classes where id = ${fixture.classId}::uuid`;
    await tx`delete from public.subjects where id = ${fixture.subjectId}::uuid`;
    await tx`delete from public.grades where id = ${fixture.gradeId}::uuid`;
    await tx`delete from public.students where id = ${fixture.studentId}::uuid`;
    await tx`delete from public.staff where id = any(${[
      fixture.teacherOne,
      fixture.teacherTwo,
    ]}::uuid[])`;
    await tx`delete from public.profiles where user_id = any(${fixture.authUserIds}::uuid[])`;
    await tx`delete from auth.users where id = any(${fixture.authUserIds}::uuid[])`;
  });
}

async function invoke(
  handler: (request: Request) => Promise<Response>,
  input: TemplateInput,
) {
  const response = await handler(
    new Request(
      "https://local.test/functions/v1/admin-month-week-template-addition",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
  );
  return { response, body: await response.json() };
}

if (!databaseUrl) {
  Deno.test({
    name: "database integration requires SUPABASE_DB_URL",
    ignore: true,
    fn() {},
  });
} else {
  Deno.test("runs seeded preview/apply, preserves history, respects recurrence, and rolls back blockers", async () => {
    const seedSql = postgres(databaseUrl, { max: 1, prepare: false });
    const applicationSql = postgres(databaseUrl, { max: 1, prepare: false });
    let fixture: Fixture | null = null;
    const store = createMonthTemplateAdditionStore(applicationSql);

    try {
      fixture = await seedFixture(seedSql);
      const handler = createMonthTemplateAdditionHandler({
        getCaller: async () => ({
          user: { id: fixture!.userId },
          profile: { role: "ROOT_ADMIN", status: "ACTIVE" },
        }),
        getStore: () => store,
      });
      const mondayTemplate = [{
        day_of_week: 1,
        class_id: fixture.classId,
        start_time: "08:00",
        end_time: "09:00",
        room: "QA-EDGE-NEW-ROOM",
        staff_ids: [fixture.teacherTwo],
      }];
      const skipPreview = await invoke(handler, {
        operation: "preview",
        month_start: fixture.monthStart,
        template: mondayTemplate,
        range: "FULL_MONTH",
        duplicate_action: "SKIP",
      });
      assert(
        skipPreview.response.status === 200,
        `seeded preview should succeed: ${JSON.stringify(skipPreview.body)}`,
      );
      assert(
        skipPreview.body.data.overwriteable_duplicate_count === 1,
        "preview should find the safe duplicate",
      );
      assert(
        skipPreview.body.data.protected_duplicate_count === 2,
        "preview should retain cancelled and history-bearing duplicates",
      );
      assert(
        skipPreview.body.data.skipped_duplicate_count === 1,
        "SKIP should skip the safe duplicate",
      );

      const skipApply = await invoke(handler, {
        operation: "apply",
        month_start: fixture.monthStart,
        template: mondayTemplate,
        range: "FULL_MONTH",
        duplicate_action: "SKIP",
      });
      assert(skipApply.response.status === 200, "SKIP apply should succeed");
      assert(
        skipApply.body.data.created_sessions === fixture.mondayDates.length - 3,
        "SKIP should create only missing Mondays",
      );
      assert(
        skipApply.body.data.skipped_duplicates === 1,
        "SKIP should leave the safe duplicate untouched",
      );
      assert(
        skipApply.body.data.protected_duplicates === 2,
        "SKIP should retain protected duplicates",
      );
      const skippedRows = await seedSql`
        select s.room, ss.staff_id
        from public.sessions s
        join public.session_staff ss on ss.session_id = s.id and ss.assignment_role = 'TEACHER'
        where s.id = ${fixture.safeDuplicateId}::uuid
      `;
      assert(
        skippedRows[0]?.room === "QA-EDGE-OLD-ROOM",
        "SKIP should preserve the existing duplicate room",
      );
      assert(
        skippedRows[0]?.staff_id === fixture.teacherOne,
        "SKIP should preserve the existing duplicate teacher",
      );

      const applyResult = await invoke(handler, {
        operation: "apply",
        month_start: fixture.monthStart,
        template: mondayTemplate,
        range: "FULL_MONTH",
        duplicate_action: "OVERWRITE_SAFE",
      });
      assert(
        applyResult.response.status === 200,
        "seeded apply should succeed",
      );
      assert(
        applyResult.body.data.created_sessions === 0,
        "second apply should find all remaining Mondays",
      );
      assert(
        applyResult.body.data.updated_sessions ===
          fixture.mondayDates.length - 2,
        "OVERWRITE_SAFE should update eligible duplicates and earlier additions",
      );
      assert(
        applyResult.body.data.protected_duplicates === 2,
        "apply should retain protected duplicates",
      );

      const safeRows = await seedSql`
        select s.room, ss.staff_id,
          (select count(*)::integer from public.session_students roster where roster.session_id = s.id) as roster_count
        from public.sessions s
        join public.session_staff ss on ss.session_id = s.id and ss.assignment_role = 'TEACHER'
        where s.id = ${fixture.safeDuplicateId}::uuid
      `;
      assert(
        safeRows[0]?.room === "QA-EDGE-NEW-ROOM",
        "safe duplicate should receive the requested room",
      );
      assert(
        safeRows[0]?.staff_id === fixture.teacherTwo,
        "safe duplicate should receive the requested teacher",
      );
      assert(
        safeRows[0]?.roster_count === 1,
        "updated roster should follow effective membership",
      );

      const preservedRows = await seedSql`
        select id, room, status from public.sessions where id = any(${[
        fixture.cancelledDuplicateId,
        fixture.protectedDuplicateId,
      ]}::uuid[]) order by id
      `;
      assert(
        preservedRows.length === 2,
        "both protected sessions should remain",
      );
      assert(
        preservedRows.find((row) => row.id === fixture!.cancelledDuplicateId)
          ?.room === "QA-EDGE-CANCELLED-ROOM",
        "cancelled session should remain unchanged",
      );
      assert(
        preservedRows.find((row) => row.id === fixture!.protectedDuplicateId)
          ?.room === "QA-EDGE-HISTORY-ROOM",
        "history-bearing session should remain unchanged",
      );

      const fridayTemplate = [{
        day_of_week: 5,
        class_id: fixture.classId,
        start_time: "14:00",
        end_time: "15:00",
        room: "QA-EDGE-FRIDAY",
        staff_ids: [fixture.teacherOne],
      }];
      const recurringPreview = await invoke(handler, {
        operation: "preview",
        month_start: fixture.monthStart,
        template: fridayTemplate,
        range: "FULL_MONTH",
        duplicate_action: "SKIP",
      });
      assert(
        recurringPreview.response.status === 200,
        "recurring preview should succeed",
      );
      assert(
        recurringPreview.body.data.recurring_duplicate_count ===
          fixture.fridayDates.length,
        "preview should identify all recurring Fridays",
      );
      const recurringApply = await invoke(handler, {
        operation: "apply",
        month_start: fixture.monthStart,
        template: fridayTemplate,
        range: "FULL_MONTH",
        duplicate_action: "SKIP",
      });
      assert(
        recurringApply.response.status === 200 &&
          recurringApply.body.data.created_sessions === 0,
        "existing recurring pattern should be skipped",
      );
      await seedSql`select public.generate_upcoming_sessions(90)`;
      const recurringRows = await seedSql`
        select count(*)::integer as count
        from public.sessions
        where recurrence_schedule_id = ${fixture.scheduleId}::uuid
          and recurrence_occurrence_date >= ${fixture.monthStart}::date
          and recurrence_occurrence_date < (${fixture.monthStart}::date + interval '1 month')::date
      `;
      assert(
        recurringRows[0]?.count === fixture.fridayDates.length,
        "recurring generator should still create one session per Friday",
      );

      const beforeConflict =
        await seedSql`select count(*)::integer as count from public.sessions where class_id = ${fixture.classId}::uuid`;
      const auditCountBeforeConflict = await seedSql`
        select count(*)::integer as count
        from public.audit_logs
        where actor_user_id = ${fixture.userId}::uuid and action like 'SESSION_MONTH_TEMPLATE_ADD%'
      `;
      const blockedApply = await invoke(handler, {
        operation: "apply",
        month_start: fixture.monthStart,
        template: [
          {
            day_of_week: 1,
            class_id: fixture.classId,
            start_time: "08:30",
            end_time: "09:30",
            room: "QA-EDGE-OVERLAP",
            staff_ids: [fixture.teacherOne],
          },
          {
            day_of_week: 2,
            class_id: fixture.classId,
            start_time: "10:00",
            end_time: "11:00",
            room: "QA-EDGE-TUESDAY",
            staff_ids: [fixture.teacherOne],
          },
        ],
        range: "FULL_MONTH",
        duplicate_action: "OVERWRITE_SAFE",
      });
      assert(
        blockedApply.response.status === 409 &&
          blockedApply.body.error.code === "TEMPLATE_ADDITION_BLOCKED",
        "hard schedule conflict should reject apply",
      );
      const afterConflict =
        await seedSql`select count(*)::integer as count from public.sessions where class_id = ${fixture.classId}::uuid`;
      assert(
        afterConflict[0]?.count === beforeConflict[0]?.count,
        "blocked apply must not partially create any sessions",
      );
      const auditCountAfterConflict = await seedSql`
        select count(*)::integer as count
        from public.audit_logs
        where actor_user_id = ${fixture.userId}::uuid and action like 'SESSION_MONTH_TEMPLATE_ADD%'
      `;
      assert(
        auditCountAfterConflict[0]?.count ===
          auditCountBeforeConflict[0]?.count,
        "blocked apply must not write partial audit rows",
      );

      const audits = await seedSql`
        select count(*)::integer as count
        from public.audit_logs
        where actor_user_id = ${fixture.userId}::uuid and action like 'SESSION_MONTH_TEMPLATE_ADD%'
      `;
      assert(
        audits[0]?.count >=
          skipApply.body.data.created_sessions +
            applyResult.body.data.updated_sessions + 2,
        "create, update, and summary writes should be audited",
      );
    } finally {
      if (fixture) await cleanupFixture(seedSql, fixture);
      await store.close();
      await seedSql.end({ timeout: 5 });
    }
  });
}
