import { createAdminResetPasswordBulkHandler } from "./handler.ts";
import type {
  BulkResetPasswordDependencies,
  BulkResetTargetState,
} from "./handler.ts";

const QA_USER_1 = "00000000-0000-4000-8000-000000000001";
const QA_USER_2 = "00000000-0000-4000-8000-000000000002";
const QA_USER_3 = "00000000-0000-4000-8000-000000000003";
const QA_USER_4 = "00000000-0000-4000-8000-000000000004";
const QA_USER_5 = "00000000-0000-4000-8000-000000000005";
const QA_ADMIN = "00000000-0000-4000-8000-000000000099";

const authorizedAdmin = {
  user: { id: QA_ADMIN },
  profile: { role: "ADMIN" },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeRequest(body: unknown) {
  return new Request("https://local.test/admin-reset-password-bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function activeTarget(userId: string, role: "STUDENT" | "TEACHER" = "STUDENT"): BulkResetTargetState {
  return {
    user_id: userId,
    profile_id: `profile-${userId}`,
    role,
    profile_status: "ACTIVE",
    entity_exists: true,
    entity_status: "ACTIVE",
  };
}

function makeDependencies(overrides: Partial<BulkResetPasswordDependencies> = {}) {
  const calls = {
    permissionChecks: 0,
    targetLookups: [] as string[][],
    order: [] as string[],
    passwordUpdates: [] as Array<{ userId: string; password: string }>,
    forcePasswordChanges: [] as string[],
    audits: [] as Array<{ actorUserId: string; profileId: string; forcePasswordChange: boolean | null; passwordReset: boolean }>,
  };

  const dependencies: BulkResetPasswordDependencies = {
    getCaller: async () => authorizedAdmin,
    hasStaffManagePermission: async () => {
      calls.permissionChecks += 1;
      return true;
    },
    getTargetStates: async (userIds) => {
      calls.targetLookups.push(userIds);
      return userIds.map((userId) => activeTarget(userId));
    },
    updatePassword: async (userId, password) => {
      calls.order.push(`password:${userId}`);
      calls.passwordUpdates.push({ userId, password });
    },
    setForcePasswordChange: async (userId) => {
      calls.order.push(`force:${userId}`);
      calls.forcePasswordChanges.push(userId);
    },
    writeAudit: async (input) => {
      calls.order.push(`audit:${input.profileId}`);
      calls.audits.push(input);
    },
    ...overrides,
  };
  return { calls, dependencies };
}

Deno.test("resets active students and teachers, forces password change, and audits each account", async () => {
  const { calls, dependencies } = makeDependencies({
    getTargetStates: async (userIds) => userIds.map((userId, index) => activeTarget(userId, index ? "TEACHER" : "STUDENT")),
  });
  const response = await createAdminResetPasswordBulkHandler(dependencies)(makeRequest({ user_ids: [QA_USER_1, QA_USER_2] }));
  const body = await response.json();

  assert(response.status === 200, "authorized batch should succeed");
  assert(body.data.temporary_password === "12345678", "the fixed password should be returned once");
  assert(body.data.results.length === 2, "there should be one result per requested account");
  assert(body.data.results.every((item: { status: string; password_reset: boolean }) => item.status === "SUCCESS" && item.password_reset), "both accounts should succeed");
  assert(calls.passwordUpdates.length === 2, "each account password should be updated once");
  assert(calls.passwordUpdates.every((item) => item.password === "12345678"), "every account should receive the fixed password");
  assert(calls.forcePasswordChanges.length === 2, "every account should require a password change");
  assert(calls.audits.length === 2, "every reset should be audited");
  assert(calls.audits[0].actorUserId === QA_ADMIN, "the audit should identify the caller");
  assert(calls.order[0] === `force:${QA_USER_1}` && calls.order[1] === `password:${QA_USER_1}`, "the force-change flag must be set before resetting the password");
});

Deno.test("rejects callers without STAFF_MANAGE before reading or changing targets", async () => {
  const { calls, dependencies } = makeDependencies({
    hasStaffManagePermission: async () => {
      calls.permissionChecks += 1;
      return false;
    },
  });
  const response = await createAdminResetPasswordBulkHandler(dependencies)(makeRequest({ user_ids: [QA_USER_1] }));
  const body = await response.json();

  assert(response.status === 403 && body.error.code === "FORBIDDEN", "unauthorized caller should be rejected");
  assert(calls.targetLookups.length === 0, "unauthorized caller must not inspect targets");
  assert(calls.passwordUpdates.length === 0, "unauthorized caller must not update passwords");
});

Deno.test("allows ROOT_ADMIN without a STAFF_MANAGE lookup", async () => {
  const { calls, dependencies } = makeDependencies({
    getCaller: async () => ({ user: { id: QA_ADMIN }, profile: { role: "ROOT_ADMIN" } }),
  });
  const response = await createAdminResetPasswordBulkHandler(dependencies)(makeRequest({ user_ids: [QA_USER_1] }));

  assert(response.status === 200, "ROOT_ADMIN should be authorized");
  assert(calls.permissionChecks === 0, "ROOT_ADMIN should bypass permission lookup");
});

Deno.test("rejects malformed, empty, duplicate, and over-limit target lists before any update", async () => {
  const tooManyIds = Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
  const invalidBodies = [
    {},
    { user_ids: [] },
    { user_ids: ["not-a-uuid"] },
    { user_ids: [QA_USER_1, QA_USER_1] },
    { user_ids: [QA_USER_1, QA_USER_1.toUpperCase()] },
    { user_ids: tooManyIds },
  ];

  for (const body of invalidBodies) {
    const { calls, dependencies } = makeDependencies();
    const response = await createAdminResetPasswordBulkHandler(dependencies)(makeRequest(body));
    const result = await response.json();
    assert(response.status === 400 && result.error.code === "INVALID_INPUT", "invalid batch should be rejected");
    assert(calls.targetLookups.length === 0, "invalid batch must not inspect targets");
    assert(calls.passwordUpdates.length === 0, "invalid batch must not change passwords");
  }
});

Deno.test("skips missing, inactive, archived, and unsupported targets without mutating them", async () => {
  const states: BulkResetTargetState[] = [
    { ...activeTarget(QA_USER_1), profile_status: "LOCKED" },
    { ...activeTarget(QA_USER_2), profile_status: "INACTIVE" },
    { ...activeTarget(QA_USER_3), entity_status: "ARCHIVED" },
    { ...activeTarget(QA_USER_4), role: "ADMIN" },
  ];
  const { calls, dependencies } = makeDependencies({ getTargetStates: async () => states });
  const response = await createAdminResetPasswordBulkHandler(dependencies)(makeRequest({ user_ids: [QA_USER_1, QA_USER_2, QA_USER_3, QA_USER_4, QA_USER_5] }));
  const body = await response.json();

  assert(response.status === 200, "ineligible target statuses should be reported per account");
  assert(body.data.temporary_password === null, "no password should be returned if no account changed");
  assert(body.data.results.every((item: { status: string; password_reset: boolean }) => item.status === "SKIPPED" && !item.password_reset), "all ineligible accounts should be skipped");
  assert(calls.passwordUpdates.length === 0, "ineligible accounts must not be changed");
  assert(calls.audits.length === 0, "ineligible accounts must not create reset audit entries");
});

Deno.test("continues processing later accounts after a password update failure while keeping the force-change flag", async () => {
  const { calls, dependencies } = makeDependencies({
    updatePassword: async (userId, password) => {
      if (userId === QA_USER_1) throw new Error("QA_AUTH_FAILURE");
      calls.passwordUpdates.push({ userId, password });
    },
  });
  const response = await createAdminResetPasswordBulkHandler(dependencies)(makeRequest({ user_ids: [QA_USER_1, QA_USER_2] }));
  const body = await response.json();

  assert(response.status === 200, "per-account failures should be returned in a completed batch");
  assert(body.data.results[0].status === "PARTIAL", "failed auth update after setting the force-change flag should be marked partial");
  assert(body.data.results[0].reason_codes[0] === "PASSWORD_UPDATE_FAILED", "auth failure should have a safe reason code");
  assert(body.data.results[0].password_reset === false, "failed auth update must not claim the shared password was set");
  assert(body.data.results[1].status === "SUCCESS", "the later account should still be processed");
  assert(calls.forcePasswordChanges.length === 2 && calls.forcePasswordChanges[0] === QA_USER_1, "each eligible account should be protected before Auth updates");
  assert(calls.audits[0].forcePasswordChange === true && calls.audits[0].passwordReset === false, "audit should capture the enforced change even if Auth password update failed");
});

Deno.test("does not update Auth when setting the force-change flag fails and reports audit failure", async () => {
  const { calls, dependencies } = makeDependencies({
    setForcePasswordChange: async () => { throw new Error("QA_FORCE_FLAG_FAILURE"); },
    writeAudit: async (input) => {
      calls.audits.push(input);
      throw new Error("QA_AUDIT_FAILURE");
    },
  });
  const response = await createAdminResetPasswordBulkHandler(dependencies)(makeRequest({ user_ids: [QA_USER_1] }));
  const body = await response.json();

  assert(response.status === 200, "per-account failure should be reported in a completed batch");
  assert(body.data.temporary_password === null, "shared password should not be returned when Auth was not changed");
  assert(body.data.results[0].status === "FAILED" && !body.data.results[0].password_reset, "the failed result must show that Auth password was not changed");
  assert(body.data.results[0].reason_codes.includes("FORCE_PASSWORD_CHANGE_FAILED"), "force-change failure should be visible");
  assert(body.data.results[0].reason_codes.includes("AUDIT_WRITE_FAILED"), "audit failure should be visible");
  assert(calls.passwordUpdates.length === 0, "Auth password must not change when the force-change guard could not be set");
  assert(calls.audits.length === 1 && calls.audits[0].forcePasswordChange === null && !calls.audits[0].passwordReset, "audit attempt should record that force-change state is uncertain and Auth was unchanged");
});
