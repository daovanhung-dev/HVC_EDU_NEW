import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import { createSessionAttendanceFinalizeStore } from "./store.ts";
import type { FinalizeSessionInput } from "./types.ts";

const ADMIN_ID = "f0640000-0000-0000-0000-000000000001";
const SESSION_ID = "f0640000-0000-0000-0000-000000000101";
const STUDENT_ID = "f0640000-0000-0000-0000-000000000201";
const TEACHER_ID = "f0640000-0000-0000-0000-000000000301";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function input(): FinalizeSessionInput {
  return {
    session_id: SESSION_ID,
    session_note: "QA finalization",
    lesson_youtube_url: null,
    students: [{
      student_id: STUDENT_ID,
      status: "PRESENT",
      late_minutes: null,
      absence_reason: null,
      homework_score: null,
      homework_note: null,
      understanding_score: null,
      attitude_score: null,
      positive_feedback_count: null,
      positive_feedback_raw: null,
      comment: null,
    }],
    teacher_decisions: [{ staff_id: TEACHER_ID, eligible: false }],
  };
}

interface FakeOptions {
  permission?: boolean;
  sessionStatus?: string;
  scheduledEndAt?: string;
  roster?: string[];
  teachers?: Array<{ staff_id: string; timesheet_eligible: boolean | null }>;
  failOnFinalAudit?: boolean;
}

function fakeDatabase(options: FakeOptions = {}) {
  const state = {
    writes: [] as string[],
    committed: 0,
    rolledBack: 0,
  };
  const session = {
    id: SESSION_ID,
    status: options.sessionStatus ?? "IN_PROGRESS",
    scheduled_end_at: options.scheduledEndAt ??
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scheduled_end_is_future: Date.parse(
      options.scheduledEndAt ??
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ) > Date.now(),
    session_note: null,
    lesson_youtube_url: null,
    ended_at: null,
    ended_by: null,
  };
  const teachers = options.teachers ??
    [{ staff_id: TEACHER_ID, timesheet_eligible: null }];
  const tx = Object.assign(
    async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
      if (query.includes("set_config('request.jwt.claim.sub'")) return [];
      if (query.includes("actor_has_permission")) {
        return [{
          academic_manage: options.permission !== false,
          timesheet_approve: options.permission !== false,
        }];
      }
      if (query.startsWith("select id, status, scheduled_end_at")) {
        return [{ ...session }];
      }
      if (query.includes("from public.session_students")) {
        return (options.roster ?? [STUDENT_ID]).map((student_id) => ({
          student_id,
        }));
      }
      if (query.includes("jsonb_agg(jsonb_build_object('staff_id'")) {
        return [{ data: teachers.map((teacher) => ({ ...teacher })) }];
      }
      if (query.includes("jsonb_agg(to_jsonb(sa)")) return [{ data: [] }];
      if (
        query.startsWith(
          "select staff_id, timesheet_eligible from public.session_staff",
        ) ||
        query.startsWith(
          "select ss.staff_id, ss.timesheet_eligible from public.session_staff",
        )
      ) {
        if (!query.includes("and ss.staff_id =")) {
          return teachers.map((teacher) => ({ ...teacher }));
        }
        const id = String(
          values.find((value) => value === TEACHER_ID) ?? TEACHER_ID,
        );
        return teachers.filter((teacher) => teacher.staff_id === id).map((
          teacher,
        ) => ({ ...teacher }));
      }
      if (query.startsWith("update public.sessions")) {
        state.writes.push("sessions");
        return [{
          ...session,
          status: "COMPLETED",
          ended_at: new Date().toISOString(),
          ended_by: ADMIN_ID,
        }];
      }
      if (query.startsWith("insert into public.student_attendances")) {
        state.writes.push("attendance");
        return [];
      }
      if (query.startsWith("update public.session_staff")) {
        state.writes.push("session_staff");
        return [];
      }
      if (query.startsWith("select t.id, t.status from public.timesheets")) {
        return [];
      }
      if (query.startsWith("select public.write_audit")) {
        if (
          state.writes.length > 0 && options.failOnFinalAudit &&
          values[1] === "SESSION_ADMIN_ATTENDANCE_AND_TIMESHEETS"
        ) {
          throw Object.assign(new Error("audit failure"), { code: "XX000" });
        }
        state.writes.push(`audit:${String(values[1])}`);
        return [];
      }
      return [];
    },
    {
      json: (value: unknown) => value,
    },
  );
  const database = {
    begin: async <T>(
      callback: (transaction: TransactionSql) => Promise<T>,
    ): Promise<T> => {
      try {
        const result = await callback(tx as unknown as TransactionSql);
        state.committed += 1;
        return result;
      } catch (error) {
        state.rolledBack += 1;
        throw error;
      }
    },
    end: async () => undefined,
  };
  return { database: database as unknown as Sql, state };
}

Deno.test("checks both permissions inside its transaction", async () => {
  const fake = fakeDatabase({ permission: false });
  const store = createSessionAttendanceFinalizeStore(fake.database);
  let errorCode = "";
  try {
    await store.finalize(input(), ADMIN_ID);
  } catch (error) {
    errorCode = (error as { code?: string }).code ?? "";
  }
  assert(
    errorCode === "FORBIDDEN",
    "missing SQL permissions should be rejected",
  );
  assert(
    fake.state.rolledBack === 1 && fake.state.writes.length === 0,
    "denied transaction should roll back before writes",
  );
});

Deno.test("rejects mismatched student roster and teacher decisions before writes", async () => {
  const rosterFake = fakeDatabase({
    roster: ["f0640000-0000-0000-0000-000000000202"],
  });
  let rosterCode = "";
  try {
    await createSessionAttendanceFinalizeStore(rosterFake.database).finalize(
      input(),
      ADMIN_ID,
    );
  } catch (error) {
    rosterCode = (error as { code?: string }).code ?? "";
  }
  assert(
    rosterCode === "SESSION_ROSTER_MISMATCH",
    "changed roster should be rejected",
  );
  assert(
    rosterFake.state.writes.length === 0,
    "roster mismatch should be checked before writes",
  );

  const teacherFake = fakeDatabase({
    teachers: [{
      staff_id: "f0640000-0000-0000-0000-000000000302",
      timesheet_eligible: null,
    }],
  });
  let teacherCode = "";
  try {
    await createSessionAttendanceFinalizeStore(teacherFake.database).finalize(
      input(),
      ADMIN_ID,
    );
  } catch (error) {
    teacherCode = (error as { code?: string }).code ?? "";
  }
  assert(
    teacherCode === "SESSION_TEACHER_DECISION_REQUIRED",
    "changed teacher assignments should be rejected",
  );
  assert(
    teacherFake.state.writes.length === 0,
    "teacher mismatch should be checked before writes",
  );
});

Deno.test("rejects cancelled and future scheduled sessions", async () => {
  for (
    const [status, scheduledEndAt, expected] of [
      [
        "CANCELLED",
        new Date(Date.now() - 60_000).toISOString(),
        "SESSION_CANCELLED",
      ],
      [
        "SCHEDULED",
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        "ADMIN_SESSION_NOT_FINISHED",
      ],
    ] as const
  ) {
    const fake = fakeDatabase({ sessionStatus: status, scheduledEndAt });
    let errorCode = "";
    try {
      await createSessionAttendanceFinalizeStore(fake.database).finalize(
        input(),
        ADMIN_ID,
      );
    } catch (error) {
      errorCode = (error as { code?: string }).code ?? "";
    }
    assert(errorCode === expected, `${status} session should be rejected`);
    assert(
      fake.state.writes.length === 0,
      `${status} session should not be modified`,
    );
  }
});

Deno.test("completes an IN_PROGRESS session before its scheduled end", async () => {
  const fake = fakeDatabase({ sessionStatus: "IN_PROGRESS" });
  const result = await createSessionAttendanceFinalizeStore(fake.database)
    .finalize(input(), ADMIN_ID);
  assert(
    result.status === "COMPLETED",
    "in-progress session should be completed",
  );
  assert(
    result.ended_by === ADMIN_ID && Boolean(result.ended_at),
    "result should include who ended the session",
  );
  assert(
    result.students_updated === 1 && result.teachers_not_eligible === 1,
    "result should preserve attendance and decision counts",
  );
  assert(
    fake.state.committed === 1 && fake.state.rolledBack === 0,
    "successful transaction should commit",
  );
});

Deno.test("rolls back session, attendance, and teacher writes when audit fails", async () => {
  const fake = fakeDatabase({ failOnFinalAudit: true });
  let rejected = false;
  try {
    await createSessionAttendanceFinalizeStore(fake.database).finalize(
      input(),
      ADMIN_ID,
    );
  } catch {
    rejected = true;
  }
  assert(rejected, "audit failure must fail the finalization request");
  assert(
    fake.state.writes.includes("sessions") &&
      fake.state.writes.includes("attendance"),
    "test should fail after attempted writes",
  );
  assert(
    fake.state.rolledBack === 1 && fake.state.committed === 0,
    "transaction should roll back all attempted writes",
  );
});
