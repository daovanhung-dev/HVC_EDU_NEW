import postgres from "npm:postgres@3.4.7";
import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import { MONTH_TEMPLATE_PLAN_SQL } from "./planner_sql.ts";
import type {
  TemplateAction,
  TemplateApplyResult,
  TemplateInput,
  TemplatePlan,
  TemplatePreview,
} from "./types.ts";

interface PlannedRow {
  plan: TemplatePlan;
}

interface SessionIdRow {
  id: string;
}

interface CodedError extends Error {
  code?: string;
}

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

async function setActorContext(tx: TransactionSql, actorUserId: string) {
  await tx`
    select
      set_config('request.jwt.claim.sub', ${actorUserId}, true),
      set_config('request.jwt.claim.role', 'authenticated', true)
  `;
}

async function buildPlan(
  tx: TransactionSql,
  input: TemplateInput,
  actorUserId: string,
): Promise<TemplatePlan> {
  await setActorContext(tx, actorUserId);
  await tx.unsafe(MONTH_TEMPLATE_PLAN_SQL);
  const rows = await tx<PlannedRow[]>`
    select pg_temp._build_month_week_template_addition_plan(
      ${input.month_start}::date,
      ${JSON.stringify(input.template)}::jsonb,
      ${input.range},
      ${input.duplicate_action}
    ) as plan
  `;
  if (!rows[0]?.plan || !Array.isArray(rows[0].plan.actions)) {
    throw codedError("TEMPLATE_PLAN_INVALID");
  }
  return rows[0].plan;
}

function previewFromPlan(plan: TemplatePlan): TemplatePreview {
  const { actions: _actions, ...preview } = plan;
  return preview;
}

async function writeAudit(
  tx: TransactionSql,
  actorUserId: string,
  action: string,
  entityId: string | null,
  oldData: unknown,
  newData: unknown,
  reason: string,
) {
  await tx`
    select public.write_audit(
      ${actorUserId}::uuid,
      ${action},
      'sessions',
      ${entityId}::uuid,
      ${oldData === null ? null : JSON.stringify(oldData)}::jsonb,
      ${newData === null ? null : JSON.stringify(newData)}::jsonb,
      ${reason}
    )
  `;
}

async function insertRoster(
  tx: TransactionSql,
  sessionId: string,
  studentIds: string[],
) {
  if (studentIds.length === 0) return;
  await tx`
    insert into public.session_students(session_id, student_id)
    select ${sessionId}::uuid, roster.student_id
    from unnest(${studentIds}::uuid[]) as roster(student_id)
  `;
}

async function insertTeachers(
  tx: TransactionSql,
  sessionId: string,
  staffIds: string[],
) {
  if (staffIds.length === 0) return;
  await tx`
    insert into public.session_staff(session_id, staff_id, assignment_role)
    select ${sessionId}::uuid, teacher.staff_id, 'TEACHER'
    from unnest(${staffIds}::uuid[]) as teacher(staff_id)
  `;
}

async function applyActions(
  tx: TransactionSql,
  plan: TemplatePlan,
  input: TemplateInput,
  actorUserId: string,
): Promise<TemplateApplyResult> {
  const updateIds = plan.actions
    .filter((action) => action.action === "UPDATE")
    .map((action) => action.session_id)
    .filter((sessionId): sessionId is string => Boolean(sessionId));

  // Clear first so a batch can swap teacher assignments without temporarily
  // exceeding the per-class distinct-teacher limit.
  if (updateIds.length > 0) {
    await tx`
      delete from public.session_staff
      where session_id = any(${updateIds}::uuid[]) and assignment_role = 'TEACHER'
    `;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let protectedCount = 0;

  for (const action of plan.actions) {
    if (action.action === "PRESERVE") {
      protectedCount += 1;
      continue;
    }
    if (action.action === "SKIP" || action.action === "SKIP_RECURRING") {
      skipped += 1;
      continue;
    }

    if (action.action === "CREATE") {
      const sourceScheduleId = action.source_schedule_id;
      const rows = await tx<SessionIdRow[]>`
        insert into public.sessions (
          class_id, recurrence_schedule_id, recurrence_occurrence_date,
          scheduled_start_at, scheduled_end_at, room, manual_schedule,
          schedule_override, staff_assignment_override, room_override, status
        ) values (
          ${action.class_id}::uuid,
          ${sourceScheduleId}::uuid,
          ${sourceScheduleId ? action.date : null}::date,
          ${action.start_at}::timestamptz,
          ${action.end_at}::timestamptz,
          ${action.room},
          ${sourceScheduleId === null},
          ${sourceScheduleId !== null},
          ${sourceScheduleId !== null},
          ${sourceScheduleId !== null},
          'SCHEDULED'
        ) returning id
      `;
      const sessionId = rows[0]?.id;
      if (!sessionId) throw codedError("SESSION_CREATE_FAILED");
      await insertRoster(tx, sessionId, action.student_ids);
      await insertTeachers(tx, sessionId, action.staff_ids);
      await writeAudit(
        tx,
        actorUserId,
        "SESSION_MONTH_TEMPLATE_ADD_CREATE",
        sessionId,
        null,
        {
          month_start: input.month_start,
          range: input.range,
          date: action.date,
          class_id: action.class_id,
          scheduled_start_at: action.start_at,
          scheduled_end_at: action.end_at,
          room: action.room,
          staff_ids: action.staff_ids,
          roster_count: action.student_ids.length,
          recurrence_schedule_id: sourceScheduleId,
        },
        sourceScheduleId === null
          ? "Admin added a month template occurrence."
          : "Admin added an occurrence override without changing the recurring schedule.",
      );
      created += 1;
      continue;
    }

    if (action.action === "UPDATE") {
      if (!action.session_id) throw codedError("TEMPLATE_PLAN_INVALID");
      await tx`
        update public.sessions
        set room = ${action.room},
          schedule_override = case when recurrence_schedule_id is null then schedule_override else true end,
          staff_assignment_override = case when recurrence_schedule_id is null then staff_assignment_override else true end,
          room_override = case when recurrence_schedule_id is null then room_override else true end
        where id = ${action.session_id}::uuid
      `;
      await tx`delete from public.session_students where session_id = ${action.session_id}::uuid`;
      await insertRoster(tx, action.session_id, action.student_ids);
      await insertTeachers(tx, action.session_id, action.staff_ids);
      await writeAudit(
        tx,
        actorUserId,
        "SESSION_MONTH_TEMPLATE_ADD_UPDATE",
        action.session_id,
        action.previous || null,
        {
          room: action.room,
          teachers: action.staff_ids,
          students: action.student_ids,
        },
        "Admin updated a future scheduled occurrence from an additive month template; learning history was empty.",
      );
      updated += 1;
    }
  }

  await writeAudit(
    tx,
    actorUserId,
    "SESSION_MONTH_TEMPLATE_ADD",
    null,
    { month_start: input.month_start },
    {
      range: input.range,
      duplicate_action: input.duplicate_action,
      created,
      updated,
      skipped_duplicates: skipped,
      protected_duplicates: protectedCount,
    },
    "Admin added weekly template occurrences without deleting existing sessions or suppressing recurring generation.",
  );

  return {
    month_start: input.month_start,
    range: input.range,
    created_sessions: created,
    updated_sessions: updated,
    skipped_duplicates: skipped,
    protected_duplicates: protectedCount,
  };
}

export function createMonthTemplateAdditionStore(
  connection: Sql = postgres(databaseUrl(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  }),
) {
  return {
    async preview(
      input: TemplateInput,
      actorUserId: string,
    ): Promise<TemplatePreview> {
      return await connection.begin(async (tx) => {
        const plan = await buildPlan(tx, input, actorUserId);
        await tx.unsafe(
          "drop function pg_temp._build_month_week_template_addition_plan(date, jsonb, text, text)",
        );
        return previewFromPlan(plan);
      });
    },

    async apply(
      input: TemplateInput,
      actorUserId: string,
    ): Promise<TemplateApplyResult> {
      return await connection.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext('continuous-class-session-generator'))`;
        await tx.unsafe(
          "lock table public.class_schedules in share row exclusive mode",
        );
        await tx.unsafe(
          "lock table public.sessions in share row exclusive mode",
        );
        const plan = await buildPlan(tx, input, actorUserId);
        if (plan.blockers.length > 0) {
          throw codedError("TEMPLATE_ADDITION_BLOCKED");
        }
        const result = await applyActions(tx, plan, input, actorUserId);
        await tx.unsafe(
          "drop function pg_temp._build_month_week_template_addition_plan(date, jsonb, text, text)",
        );
        return result;
      });
    },

    async close() {
      await connection.end({ timeout: 5 });
    },
  };
}

export type MonthTemplateAdditionStore = ReturnType<
  typeof createMonthTemplateAdditionStore
>;
