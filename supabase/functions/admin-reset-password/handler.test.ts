import { createAdminResetPasswordHandler } from "./handler.ts";
import type {
  AdminResetPasswordDependencies,
  ResetPasswordCaller,
} from "./handler.ts";

const authorizedAdmin: ResetPasswordCaller = {
  user: { id: "qa-admin-user" },
  profile: { role: "ADMIN" },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeRequest(body: unknown) {
  return new Request("https://local.test/admin-reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDependencies(
  overrides: Partial<AdminResetPasswordDependencies> = {},
) {
  const calls = {
    permissionChecks: 0,
    passwordUpdates: [] as Array<{ userId: string; password: string }>,
    forcePasswordChanges: [] as string[],
    audits: [] as Array<{ actorUserId: string; profileId: string }>,
  };
  const dependencies: AdminResetPasswordDependencies = {
    getCaller: async () => authorizedAdmin,
    hasStaffManagePermission: async () => {
      calls.permissionChecks += 1;
      return true;
    },
    updatePassword: async (userId, password) => {
      calls.passwordUpdates.push({ userId, password });
    },
    setForcePasswordChange: async (userId) => {
      calls.forcePasswordChanges.push(userId);
      return { id: "qa-profile-1", username: "qa-user" };
    },
    writeAudit: async (input) => {
      calls.audits.push(input);
    },
    ...overrides,
  };
  return { calls, dependencies };
}

Deno.test("resets the account to 12345678 and preserves force-change and audit behavior", async () => {
  const { calls, dependencies } = makeDependencies();
  const handler = createAdminResetPasswordHandler(dependencies);
  const response = await handler(makeRequest({ user_id: "qa-target-user" }));
  const body = await response.json();

  assert(response.status === 200, "authorized reset should succeed");
  assert(calls.passwordUpdates.length === 1, "password should be updated once");
  assert(
    calls.passwordUpdates[0].userId === "qa-target-user",
    "target account should be updated",
  );
  assert(
    calls.passwordUpdates[0].password === "12345678",
    "fixed password should be applied",
  );
  assert(
    calls.forcePasswordChanges[0] === "qa-target-user",
    "target should be required to change password",
  );
  assert(
    body.data.temporary_password === "12345678",
    "fixed password should be returned for the existing result dialog",
  );
  assert(
    calls.audits[0].actorUserId === "qa-admin-user",
    "reset should be audited under the caller",
  );
  assert(
    calls.audits[0].profileId === "qa-profile-1",
    "reset should audit the target profile",
  );
});

Deno.test("rejects an admin without STAFF_MANAGE before changing the account", async () => {
  const { calls, dependencies } = makeDependencies({
    hasStaffManagePermission: async () => {
      calls.permissionChecks += 1;
      return false;
    },
  });
  const handler = createAdminResetPasswordHandler(dependencies);
  const response = await handler(makeRequest({ user_id: "qa-target-user" }));
  const body = await response.json();

  assert(
    response.status === 403,
    "admin without permission should be forbidden",
  );
  assert(
    body.error.code === "FORBIDDEN",
    "forbidden response should be identified",
  );
  assert(
    calls.passwordUpdates.length === 0,
    "unauthorized reset must not update credentials",
  );
  assert(
    calls.forcePasswordChanges.length === 0,
    "unauthorized reset must not change profile flags",
  );
  assert(
    calls.audits.length === 0,
    "unauthorized reset must not write an audit entry",
  );
});

Deno.test("allows ROOT_ADMIN without a STAFF_MANAGE lookup", async () => {
  const { calls, dependencies } = makeDependencies({
    getCaller: async () => ({
      user: { id: "qa-root-user" },
      profile: { role: "ROOT_ADMIN" },
    }),
  });
  const handler = createAdminResetPasswordHandler(dependencies);
  const response = await handler(makeRequest({ user_id: "qa-target-user" }));

  assert(response.status === 200, "ROOT_ADMIN reset should succeed");
  assert(
    calls.permissionChecks === 0,
    "ROOT_ADMIN should bypass the permission lookup",
  );
  assert(
    calls.passwordUpdates[0].password === "12345678",
    "ROOT_ADMIN reset should use the fixed password",
  );
});

Deno.test("rejects a missing user_id without changing the account", async () => {
  const { calls, dependencies } = makeDependencies();
  const handler = createAdminResetPasswordHandler(dependencies);
  const response = await handler(makeRequest({}));

  assert(response.status === 400, "missing user_id should be rejected");
  assert(
    calls.passwordUpdates.length === 0,
    "invalid input must not update credentials",
  );
});
