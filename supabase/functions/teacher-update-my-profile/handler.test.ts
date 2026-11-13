import { createTeacherProfileUpdateHandler } from "./handler.ts";
import type { TeacherProfileInput } from "./types.ts";

const activeTeacher = {
  user: { id: "qa-teacher-user" },
  profile: { role: "TEACHER", status: "ACTIVE" },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeRequest(body: unknown, method = "POST") {
  return new Request("https://local.test/teacher-update-my-profile", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function makeDependencies(overrides: Partial<Parameters<typeof createTeacherProfileUpdateHandler>[0]> = {}) {
  const writes: Array<{ userId: string; input: TeacherProfileInput }> = [];
  return {
    writes,
    dependencies: {
      getCaller: async () => activeTeacher,
      getStore: () => ({
        updateMyProfile: async (userId: string, input: TeacherProfileInput) => {
          writes.push({ userId, input });
          return { staff_id: "qa-staff-1", full_name: input.full_name };
        },
      }),
      ...overrides,
    },
  };
}

Deno.test("rejects callers who are not active teachers", async () => {
  const { dependencies, writes } = makeDependencies({
    getCaller: async () => ({
      user: { id: "qa-admin" },
      profile: { role: "ADMIN", status: "ACTIVE" },
    }),
  });
  const response = await createTeacherProfileUpdateHandler(dependencies)(
    makeRequest({ full_name: "QA Teacher", phone: "0900000000" }),
  );
  const body = await response.json();
  assert(response.status === 403, "non-teacher should be forbidden");
  assert(body.error.code === "FORBIDDEN", "response should identify forbidden access");
  assert(writes.length === 0, "forbidden caller must not update a profile");
});

Deno.test("rejects missing required name or phone before writing", async () => {
  const { dependencies, writes } = makeDependencies();
  const handler = createTeacherProfileUpdateHandler(dependencies);
  const missingName = await handler(makeRequest({ full_name: "  ", phone: "0900000000" }));
  const missingPhone = await handler(makeRequest({ full_name: "QA Teacher", phone: "   " }));
  const overlongName = await handler(makeRequest({ full_name: "N".repeat(201), phone: "0900000000" }));
  assert(missingName.status === 400, "blank name should be rejected");
  assert(missingPhone.status === 400, "blank phone should be rejected");
  assert(overlongName.status === 400, "overlong name should be rejected");
  assert(writes.length === 0, "invalid input must not update a profile");
});

Deno.test("normalizes fields and updates only the authenticated teacher", async () => {
  const { dependencies, writes } = makeDependencies();
  const response = await createTeacherProfileUpdateHandler(dependencies)(
    makeRequest({
      full_name: "  QA Teacher One  ",
      phone: "  0900000000  ",
      email: " teacher@example.com ",
      address: "  QA Street  ",
      user_id: "qa-someone-else",
    }),
  );
  const body = await response.json();
  assert(response.status === 200, "valid teacher profile should save");
  assert(writes.length === 1, "profile should be written once");
  assert(writes[0].userId === "qa-teacher-user", "caller ID must come from the authenticated session");
  assert(writes[0].input.full_name === "QA Teacher One", "name should be trimmed");
  assert(writes[0].input.phone === "0900000000", "phone should be trimmed");
  assert(writes[0].input.email === "teacher@example.com", "email should be trimmed");
  assert(writes[0].input.address === "QA Street", "address should be trimmed");
  assert(body.data.staff_id === "qa-staff-1", "updated staff ID should be returned");
});

Deno.test("allows optional email and address to be empty", async () => {
  const { dependencies, writes } = makeDependencies();
  const response = await createTeacherProfileUpdateHandler(dependencies)(
    makeRequest({ full_name: "QA Teacher", phone: "0900000000", email: " ", address: null }),
  );
  assert(response.status === 200, "optional contact fields may be empty");
  assert(writes[0].input.email === null, "blank email should be stored as null");
  assert(writes[0].input.address === null, "empty address should be stored as null");
});

Deno.test("rejects invalid optional field types and email values", async () => {
  const { dependencies, writes } = makeDependencies();
  const handler = createTeacherProfileUpdateHandler(dependencies);
  const wrongType = await handler(makeRequest({ full_name: "QA Teacher", phone: "0900000000", address: 7 }));
  const invalidEmail = await handler(makeRequest({ full_name: "QA Teacher", phone: "0900000000", email: "not-an-email" }));
  assert(wrongType.status === 400, "wrong optional field types should be rejected");
  assert(invalidEmail.status === 400, "invalid email should be rejected");
  assert(writes.length === 0, "invalid optional values must not update a profile");
});

Deno.test("rejects non-POST methods", async () => {
  const { dependencies } = makeDependencies();
  const response = await createTeacherProfileUpdateHandler(dependencies)(makeRequest(null, "GET"));
  assert(response.status === 405, "non-POST method should be rejected");
});
