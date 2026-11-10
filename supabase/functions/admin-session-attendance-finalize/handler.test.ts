import { createSessionAttendanceFinalizeHandler } from "./handler.ts";
import type { FinalizeSessionInput, FinalizeSessionResult } from "./types.ts";

const ADMIN_ID = "f0640000-0000-0000-0000-000000000001";
const SESSION_ID = "f0640000-0000-0000-0000-000000000101";
const STUDENT_ID = "f0640000-0000-0000-0000-000000000201";
const TEACHER_ID = "f0640000-0000-0000-0000-000000000301";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(body: unknown, method = "POST") {
  return new Request(
    "https://local.test/functions/v1/admin-session-attendance-finalize",
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    },
  );
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
    teacher_decisions: [{ staff_id: TEACHER_ID, eligible: true }],
  };
}

function codedError(code: string) {
  return Object.assign(new Error(code), { code });
}

function dependencies(overrides: {
  role?: string;
  status?: string;
  finalize?: (
    value: FinalizeSessionInput,
    actorId: string,
  ) => Promise<FinalizeSessionResult>;
} = {}) {
  const calls = { caller: 0, finalize: 0 };
  const handler = createSessionAttendanceFinalizeHandler({
    getCaller: async () => {
      calls.caller += 1;
      return {
        user: { id: ADMIN_ID },
        profile: {
          role: overrides.role ?? "ROOT_ADMIN",
          status: overrides.status ?? "ACTIVE",
        },
      };
    },
    getStore: () => ({
      finalize: async (value, actorId) => {
        calls.finalize += 1;
        return overrides.finalize ? await overrides.finalize(value, actorId) : {
          session_id: SESSION_ID,
          status: "COMPLETED",
          students_updated: 1,
          timesheets_approved: 1,
          teachers_not_eligible: 0,
          ended_at: new Date().toISOString(),
          ended_by: ADMIN_ID,
        };
      },
    }),
  });
  return { calls, handler };
}

Deno.test("rejects callers without Admin role before opening the store", async () => {
  const { calls, handler } = dependencies({ role: "TEACHER" });
  const response = await handler(request(input()));
  const body = await response.json();
  assert(
    response.status === 403 && body.error.code === "FORBIDDEN",
    "non-admin should be denied",
  );
  assert(
    calls.finalize === 0,
    "non-admin should not enter the finalize transaction",
  );
});

Deno.test("checks both database permissions through the transactional store", async () => {
  const { calls, handler } = dependencies({
    finalize: async () => {
      throw codedError("FORBIDDEN");
    },
  });
  const response = await handler(request(input()));
  const body = await response.json();
  assert(
    response.status === 403 && body.error.code === "FORBIDDEN",
    "missing DB permission should be denied",
  );
  assert(
    calls.finalize === 1,
    "permission check belongs inside the store transaction",
  );
});

Deno.test("rejects malformed attendance input before opening the store", async () => {
  const { calls, handler } = dependencies();
  const malformed = input();
  malformed.students[0].homework_score = 11;
  const response = await handler(request(malformed));
  const body = await response.json();
  assert(
    response.status === 400 && body.error.code === "INVALID_INPUT",
    "out-of-range score should be rejected",
  );
  assert(calls.finalize === 0, "malformed input must not open the transaction");
});

Deno.test("maps roster and teacher-decision mismatches returned by the transaction", async () => {
  for (
    const code of [
      "SESSION_ROSTER_MISMATCH",
      "SESSION_TEACHER_DECISION_REQUIRED",
    ]
  ) {
    const { handler } = dependencies({
      finalize: async () => {
        throw codedError(code);
      },
    });
    const response = await handler(request(input()));
    const body = await response.json();
    assert(
      response.status === 409 || response.status === 400,
      `${code} should be rejected`,
    );
    assert(body.error.code === code, `${code} should remain actionable`);
  }
});

Deno.test("rejects a future scheduled session and a cancelled session", async () => {
  for (const code of ["ADMIN_SESSION_NOT_FINISHED", "SESSION_CANCELLED"]) {
    const { handler } = dependencies({
      finalize: async () => {
        throw codedError(code);
      },
    });
    const response = await handler(request(input()));
    const body = await response.json();
    assert(
      response.status === 409 && body.error.code === code,
      `${code} should be rejected`,
    );
  }
});

Deno.test("returns a successful completion result for an early in-progress session", async () => {
  const expected = {
    session_id: SESSION_ID,
    status: "COMPLETED" as const,
    students_updated: 1,
    timesheets_approved: 1,
    teachers_not_eligible: 0,
    ended_at: new Date().toISOString(),
    ended_by: ADMIN_ID,
  };
  const { handler } = dependencies({ finalize: async () => expected });
  const response = await handler(request(input()));
  const body = await response.json();
  assert(
    response.status === 200 && body.data.status === "COMPLETED",
    "in-progress completion should succeed",
  );
  assert(
    body.data.ended_by === ADMIN_ID,
    "result should preserve the completion actor",
  );
});

Deno.test("does not report success when storage rejects the transaction", async () => {
  let writesAttempted = 0;
  const { handler } = dependencies({
    finalize: async () => {
      writesAttempted += 1;
      throw codedError("SESSION_ROSTER_MISMATCH");
    },
  });
  const response = await handler(request(input()));
  const body = await response.json();
  assert(
    writesAttempted === 1,
    "the transaction failure should reach the handler",
  );
  assert(
    response.status !== 200 && body.success === false,
    "failed transaction must not report success",
  );
});

Deno.test("rejects non-POST methods without authenticating", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request(null, "GET"));
  assert(response.status === 405, "GET should be rejected");
  assert(calls.caller === 0, "unsupported method should not authenticate");
});
