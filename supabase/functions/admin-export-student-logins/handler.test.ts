import { createAdminExportStudentLoginsHandler } from "./handler.ts";
import type {
  ActiveStudentForLoginExport,
  StudentLoginExportDependencies,
} from "./handler.ts";

const QA_STUDENT_1 = "00000000-0000-4000-8000-000000000001";
const QA_STUDENT_2 = "00000000-0000-4000-8000-000000000002";
const QA_STUDENT_3 = "00000000-0000-4000-8000-000000000003";
const QA_ADMIN = "00000000-0000-4000-8000-000000000099";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeRequest(body: unknown, method = "POST") {
  return new Request("https://local.test/admin-export-student-logins", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function activeStudent(userId: string, code = "QA-S-001", name = "QA- Học sinh"):
  ActiveStudentForLoginExport {
  return { user_id: userId, student_code: code, full_name: name };
}

function makeDependencies(overrides: Partial<StudentLoginExportDependencies> = {}) {
  const calls = {
    permissionChecks: 0,
    lookups: [] as string[][],
    authLookups: [] as string[],
    audits: [] as Array<{ actorUserId: string; exportedCount: number }>,
  };
  const dependencies: StudentLoginExportDependencies = {
    getCaller: async () => ({ user: { id: QA_ADMIN }, profile: { role: "ADMIN" } }),
    hasStudentsViewPermission: async () => {
      calls.permissionChecks += 1;
      return true;
    },
    getActiveStudents: async (userIds) => {
      calls.lookups.push(userIds);
      return userIds.map((userId, index) => activeStudent(userId, `QA-S-00${index + 1}`, `QA- Học sinh ${index + 1}`));
    },
    getAuthEmail: async (userId) => {
      calls.authLookups.push(userId);
      return `${userId.slice(-1)}@hvc-edu.local`;
    },
    writeAudit: async (input) => { calls.audits.push(input); },
    ...overrides,
  };
  return { calls, dependencies };
}

Deno.test("exports active student login emails and audits actor plus count only", async () => {
  const { calls, dependencies } = makeDependencies({
    getActiveStudents: async () => [
      activeStudent(QA_STUDENT_1, "QA-S-001", "QA- Minh An"),
      activeStudent(QA_STUDENT_2, "QA-S-002", "QA- Gia Linh"),
    ],
    getAuthEmail: async (userId) => userId === QA_STUDENT_1 ? "qa-an@hvc-edu.local" : "qa-linh@gmail.test",
  });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1, QA_STUDENT_2] }),
  );
  const body = await response.json();

  assert(response.status === 200, "authorized request should succeed");
  assert(body.data.rows.length === 2, "both active students should be returned");
  assert(body.data.rows[0].login_email === "qa-an@hvc-edu.local", "Auth email should be used");
  assert(body.data.rows[1].login_email === "qa-linh@gmail.test", "Auth email should be used even when it is a Gmail address");
  assert(body.data.missing_email_count === 0 && body.data.skipped_count === 0, "counts should match the returned rows");
  assert(calls.permissionChecks === 1, "STUDENTS_VIEW permission should be checked");
  assert(calls.audits.length === 1, "a nonempty export should be audited once");
  assert(calls.audits[0].actorUserId === QA_ADMIN && calls.audits[0].exportedCount === 2, "audit should contain only actor and count");
  assert(!JSON.stringify(calls.audits[0]).includes("@"), "audit must not contain email addresses");
  assert(!JSON.stringify(calls.audits[0]).includes(QA_STUDENT_1), "audit must not contain student IDs");
});

Deno.test("allows ROOT_ADMIN without a permission lookup", async () => {
  const { calls, dependencies } = makeDependencies({
    getCaller: async () => ({ user: { id: QA_ADMIN }, profile: { role: "ROOT_ADMIN" } }),
  });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1] }),
  );

  assert(response.status === 200, "ROOT_ADMIN should be authorized");
  assert(calls.permissionChecks === 0, "ROOT_ADMIN should bypass the permission query");
});

Deno.test("rejects callers without STUDENTS_VIEW before inspecting student IDs", async () => {
  const { calls, dependencies } = makeDependencies({
    hasStudentsViewPermission: async () => false,
  });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1] }),
  );
  const body = await response.json();

  assert(response.status === 403 && body.error.code === "FORBIDDEN", "unauthorized caller should be rejected");
  assert(calls.lookups.length === 0 && calls.authLookups.length === 0, "unauthorized caller must not inspect account data");
  assert(calls.audits.length === 0, "unauthorized caller must not write an export audit");
});

Deno.test("rejects unauthenticated callers before reading student data", async () => {
  const { calls, dependencies } = makeDependencies({
    getCaller: async () => { throw new Error("UNAUTHENTICATED"); },
  });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1] }),
  );
  const body = await response.json();

  assert(response.status === 401 && body.error.code === "UNAUTHENTICATED", "unauthenticated caller should be rejected");
  assert(calls.lookups.length === 0 && calls.authLookups.length === 0, "unauthenticated caller must not inspect student data");
});

Deno.test("rejects malformed, empty, and duplicate ID lists before inspecting accounts", async () => {
  const invalidBodies = [
    {},
    { user_ids: [] },
    { user_ids: ["not-a-uuid"] },
    { user_ids: [QA_STUDENT_1, QA_STUDENT_1] },
    { user_ids: [QA_STUDENT_1, QA_STUDENT_1.toUpperCase()] },
  ];

  for (const body of invalidBodies) {
    const { calls, dependencies } = makeDependencies();
    const response = await createAdminExportStudentLoginsHandler(dependencies)(makeRequest(body));
    const result = await response.json();
    assert(response.status === 400 && result.error.code === "INVALID_INPUT", "invalid IDs should be rejected");
    assert(calls.lookups.length === 0 && calls.audits.length === 0, "invalid input must not read or audit student data");
  }
});

Deno.test("keeps active students without an Auth email and skips accounts no longer active", async () => {
  const { calls, dependencies } = makeDependencies({
    getActiveStudents: async () => [activeStudent(QA_STUDENT_1, "QA-S-001", "QA- Minh An")],
    getAuthEmail: async () => null,
  });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1, QA_STUDENT_2] }),
  );
  const body = await response.json();

  assert(response.status === 200, "mixed active/inactive results should succeed");
  assert(body.data.rows.length === 1 && body.data.rows[0].login_email === null, "missing email should be represented as a blank value");
  assert(body.data.missing_email_count === 1, "missing email count should be reported");
  assert(body.data.skipped_count === 1, "nonactive target should be counted as skipped");
  assert(calls.audits[0].exportedCount === 1, "audit should count only returned active students");
});

Deno.test("returns no rows when the entire selection became inactive and does not audit", async () => {
  const { calls, dependencies } = makeDependencies({ getActiveStudents: async () => [] });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1, QA_STUDENT_3] }),
  );
  const body = await response.json();

  assert(response.status === 200 && body.data.rows.length === 0, "no eligible student should produce an empty result");
  assert(body.data.skipped_count === 2, "all requested accounts should be counted as skipped");
  assert(calls.authLookups.length === 0 && calls.audits.length === 0, "empty export should not fetch emails or create an audit");
});

Deno.test("does not return export rows when the audit write fails", async () => {
  const { dependencies } = makeDependencies({
    writeAudit: async () => { throw new Error("QA audit failure"); },
  });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1] }),
  );
  const bodyText = await response.text();

  assert(response.status === 500, "audit failure should fail the request");
  assert(!bodyText.includes("login_email") && !bodyText.includes("@hvc-edu.local"), "failed audit response must not include export data");
});

Deno.test("fails closed when an Auth lookup has an unexpected error", async () => {
  const { dependencies } = makeDependencies({
    getAuthEmail: async () => { throw new Error("QA Auth API failure"); },
  });
  const response = await createAdminExportStudentLoginsHandler(dependencies)(
    makeRequest({ user_ids: [QA_STUDENT_1] }),
  );
  const body = await response.json();

  assert(response.status === 500 && body.error.code === "EXPORT_FAILED", "Auth service errors should stop the export");
  assert(!JSON.stringify(body).includes("@"), "error response must not disclose email data");
});

Deno.test("allows OPTIONS and rejects non-POST requests", async () => {
  const { calls, dependencies } = makeDependencies();
  const handler = createAdminExportStudentLoginsHandler(dependencies);
  const options = await handler(new Request("https://local.test/admin-export-student-logins", { method: "OPTIONS" }));
  const get = await handler(makeRequest(null, "GET"));

  assert(options.status === 200, "CORS preflight should be handled");
  assert(get.status === 405, "non-POST request should be rejected");
  assert(calls.lookups.length === 0, "unsupported methods must not query accounts");
});
