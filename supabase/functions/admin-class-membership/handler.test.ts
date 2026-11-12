import { createClassMembershipHandler } from "./handler.ts";
import type { ClassMembershipEnrollmentStore } from "../_shared/class-membership-enrollment.ts";

const QA_ADMIN = "f0670000-0000-4000-8000-000000000001";
const QA_CLASS = "f0670000-0000-4000-8000-000000000002";
const QA_STUDENT = "f0670000-0000-4000-8000-000000000003";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(body: unknown, method = "POST") {
  return new Request("https://local.test/functions/v1/admin-class-membership", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

function input() {
  return {
    operation: "add",
    class_id: QA_CLASS,
    student_id: QA_STUDENT,
    start_date: "2026-11-12",
  };
}

function dependencies(overrides: {
  getCaller?: () => Promise<
    { user: { id: string }; profile: { role: string; status: string } }
  >;
  enroll?: ClassMembershipEnrollmentStore["enroll"];
} = {}) {
  const calls = { store: 0, enroll: [] as unknown[] };
  const store: ClassMembershipEnrollmentStore = {
    hasPermission: async () => true,
    isActiveClass: async () => true,
    enroll: async (value) => {
      calls.enroll.push(value);
      if (overrides.enroll) return overrides.enroll(value);
      return {
        membership_id: "f0670000-0000-4000-8000-000000000004",
        sessions_updated: 3,
        students_added: 3,
        sessions_skipped_with_attendance: 1,
      };
    },
    close: async () => {},
  };
  return {
    calls,
    deps: {
      getCaller: overrides.getCaller ?? (async () => ({
        user: { id: QA_ADMIN },
        profile: { role: "ADMIN", status: "ACTIVE" },
      })),
      getStore: () => {
        calls.store += 1;
        return store;
      },
    },
  };
}

Deno.test("adds an existing student through one authorized membership transaction", async () => {
  const { calls, deps } = dependencies();
  const response = await createClassMembershipHandler(deps)(request(input()));
  const body = await response.json();

  assert(
    response.status === 200 && body.success,
    "authorized enrollment should succeed",
  );
  assert(
    body.data.sessions_updated === 3,
    "the response should include synchronized session count",
  );
  assert(
    body.data.sessions_skipped_with_attendance === 1,
    "the response should report protected sessions",
  );
  assert(
    calls.enroll.length === 1,
    "one request should perform one transaction",
  );
  assert(
    (calls.enroll[0] as { actor_user_id: string }).actor_user_id === QA_ADMIN,
    "the actor must come from auth",
  );
});

Deno.test("rejects non-admin callers before opening the store", async () => {
  const { calls, deps } = dependencies({
    getCaller: async () => ({
      user: { id: QA_ADMIN },
      profile: { role: "TEACHER", status: "ACTIVE" },
    }),
  });
  const response = await createClassMembershipHandler(deps)(request(input()));
  const body = await response.json();

  assert(
    response.status === 403 && body.error.code === "FORBIDDEN",
    "teacher must be denied",
  );
  assert(
    calls.store === 0,
    "unauthorized callers must not open the database store",
  );
});

Deno.test("rejects malformed input before opening the store", async () => {
  const { calls, deps } = dependencies();
  const response = await createClassMembershipHandler(deps)(
    request({ ...input(), start_date: "2026-02-30" }),
  );
  const body = await response.json();

  assert(
    response.status === 400 && body.error.code === "INVALID_INPUT",
    "invalid calendar date must be rejected",
  );
  assert(calls.store === 0, "invalid input must not open the database store");
});

Deno.test("returns the conflicting session date and states that the transaction rolled back", async () => {
  const { deps } = dependencies({
    enroll: async () => {
      throw Object.assign(new Error("MEMBERSHIP_ROSTER_SYNC_CONFLICT"), {
        code: "MEMBERSHIP_ROSTER_SYNC_CONFLICT",
        details: { session_date: "2026-11-20", reason: "SCHEDULE_CONFLICT" },
      });
    },
  });
  const response = await createClassMembershipHandler(deps)(request(input()));
  const body = await response.json();

  assert(response.status === 409, "a roster collision should return conflict");
  assert(
    body.error.details.session_date === "2026-11-20",
    "the conflicting session date should be returned",
  );
  assert(
    body.error.message.includes("Membership và các roster chưa được thay đổi"),
    "the rollback should be explicit",
  );
});
