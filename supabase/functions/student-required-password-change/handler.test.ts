import { createForcedStudentPasswordChangeHandler } from "./handler.ts";
import type {
  ForcedStudentPasswordChangeCaller,
  ForcedStudentPasswordChangeDependencies,
} from "./handler.ts";

const forcedStudent: ForcedStudentPasswordChangeCaller = {
  user: { id: "qa-student-user" },
  profile: { role: "STUDENT", status: "ACTIVE", force_password_change: true },
};

function makeRequest(body: unknown) {
  return new Request("https://local.test/student-required-password-change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDependencies(
  overrides: Partial<ForcedStudentPasswordChangeDependencies> = {},
) {
  const calls = {
    updates: [] as Array<{ userId: string; password: string }>,
    clears: [] as string[],
    order: [] as string[],
  };
  const dependencies: ForcedStudentPasswordChangeDependencies = {
    getCaller: async () => forcedStudent,
    updatePassword: async (userId, password) => {
      calls.order.push("password");
      calls.updates.push({ userId, password });
    },
    clearForcePasswordChange: async (userId) => {
      calls.order.push("clear");
      calls.clears.push(userId);
    },
    ...overrides,
  };
  return { calls, dependencies };
}

Deno.test("changes only the caller password and clears the flag after password update", async () => {
  const { calls, dependencies } = makeDependencies();
  const handler = createForcedStudentPasswordChangeHandler(dependencies);
  const response = await handler(makeRequest({
    new_password: "QA-NewPassword-123",
    user_id: "qa-other-user",
  }));
  const body = await response.json();

  if (response.status !== 200) throw new Error("forced student password change should succeed");
  if (calls.updates.length !== 1 || calls.updates[0].userId !== "qa-student-user") {
    throw new Error("the authenticated student must be the only account updated");
  }
  if (calls.updates[0].password !== "QA-NewPassword-123") {
    throw new Error("the submitted password should be applied as entered");
  }
  if (calls.clears[0] !== "qa-student-user") throw new Error("the caller flag should be cleared");
  if (calls.order.join(",") !== "password,clear") {
    throw new Error("the password must be updated before clearing the forced-change flag");
  }
  if (body.data.changed !== true) throw new Error("successful response should confirm the password change");
});

Deno.test("rejects a caller who is not an active forced-change student", async () => {
  const invalidCallers: ForcedStudentPasswordChangeCaller[] = [
    {
      user: { id: "qa-not-forced-user" },
      profile: { role: "STUDENT", status: "ACTIVE", force_password_change: false },
    },
    {
      user: { id: "qa-inactive-user" },
      profile: { role: "STUDENT", status: "LOCKED", force_password_change: true },
    },
    {
      user: { id: "qa-non-student-user" },
      profile: { role: "TEACHER", status: "ACTIVE", force_password_change: true },
    },
  ];

  for (const caller of invalidCallers) {
    const { calls, dependencies } = makeDependencies({ getCaller: async () => caller });
    const handler = createForcedStudentPasswordChangeHandler(dependencies);
    const response = await handler(makeRequest({ new_password: "QA-NewPassword-123" }));

    if (response.status !== 403) throw new Error("only an active forced-change student may change password here");
    if (calls.updates.length || calls.clears.length) throw new Error("rejected caller must not mutate credentials");
  }
});

Deno.test("keeps the forced flag when caller authentication fails", async () => {
  const { calls, dependencies } = makeDependencies({
    getCaller: async () => { throw new Error("UNAUTHENTICATED"); },
  });
  const handler = createForcedStudentPasswordChangeHandler(dependencies);
  const response = await handler(makeRequest({ new_password: "QA-NewPassword-123" }));

  if (response.status !== 401) throw new Error("unauthenticated requests should be rejected");
  if (calls.updates.length || calls.clears.length) throw new Error("authentication failure must not mutate credentials or the flag");
});

Deno.test("rejects invalid passwords without changing the password or flag", async () => {
  const { calls, dependencies } = makeDependencies();
  const handler = createForcedStudentPasswordChangeHandler(dependencies);
  const shortPasswordResponse = await handler(makeRequest({ new_password: "short" }));
  const nullBodyResponse = await handler(makeRequest(null));

  if (shortPasswordResponse.status !== 400) throw new Error("passwords shorter than eight characters must be rejected");
  if (nullBodyResponse.status !== 400) throw new Error("null request bodies must be rejected as invalid input");
  if (calls.updates.length || calls.clears.length) throw new Error("invalid input must not mutate account state");
});

Deno.test("keeps the forced flag when the Auth password update fails", async () => {
  const { calls, dependencies } = makeDependencies({
    updatePassword: async () => {
      calls.order.push("password");
      throw new Error("QA_AUTH_UPDATE_FAILED");
    },
  });
  const handler = createForcedStudentPasswordChangeHandler(dependencies);
  const response = await handler(makeRequest({ new_password: "QA-NewPassword-123" }));

  if (response.status !== 500) throw new Error("Auth failure should return a server error");
  if (calls.clears.length) throw new Error("the forced flag must remain when Auth update fails");
});

Deno.test("does not report success when the profile flag cannot be cleared", async () => {
  const { calls, dependencies } = makeDependencies({
    clearForcePasswordChange: async () => {
      calls.order.push("clear");
      throw new Error("QA_PROFILE_UPDATE_FAILED");
    },
  });
  const handler = createForcedStudentPasswordChangeHandler(dependencies);
  const response = await handler(makeRequest({ new_password: "QA-NewPassword-123" }));

  if (response.status !== 500) throw new Error("profile update failure should not report success");
  if (calls.order.join(",") !== "password,clear") {
    throw new Error("the profile flag should be cleared only after the password update succeeds");
  }
});
