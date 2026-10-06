import { createStudentAiTutorHandler, type LessonContext } from "./handler.ts";

const student = { user: { id: "qa-student" }, profile: { role: "STUDENT", status: "ACTIVE", force_password_change: false } };
const lesson: LessonContext = { class_name: "QA- Toán 8", subject_name: "QA- Toán", scheduled_start_at: "2026-10-01T10:00:00+07:00", session_note: "QA- Phương trình bậc nhất" };
const request = (body: unknown) => new Request("https://local.test/student-ai-tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const deps = (overrides: Partial<Parameters<typeof createStudentAiTutorHandler>[0]> = {}) => ({
  getCaller: async () => student,
  isActiveStudent: async () => true,
  getLessonContext: async () => lesson,
  getApiKey: () => "qa-key",
  fetcher: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "QA- Hãy chuyển hạng tử trước." }] } }] }), { status: 200 }),
  ...overrides,
});
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }

Deno.test("allows only active students", async () => {
  const handler = createStudentAiTutorHandler(deps({ getCaller: async () => ({ user: { id: "qa-admin" }, profile: { role: "ADMIN", status: "ACTIVE" } }) }));
  const response = await handler(request({ question: "QA hỏi" }));
  assert(response.status === 403, "non-students should be forbidden");
  const inactiveStudent = createStudentAiTutorHandler(deps({ isActiveStudent: async () => false }));
  assert((await inactiveStudent(request({ question: "QA hỏi" }))).status === 403, "inactive student record should be forbidden");
  const forcedStudent = createStudentAiTutorHandler(deps({ getCaller: async () => ({ user: { id: "qa-student" }, profile: { role: "STUDENT", status: "ACTIVE", force_password_change: true } }) }));
  assert((await forcedStudent(request({ question: "QA hỏi" }))).status === 403, "forced-change student must not use the AI endpoint");
});

Deno.test("requires the selected completed session to belong to the student", async () => {
  let called = false;
  const handler = createStudentAiTutorHandler(deps({ getLessonContext: async () => null, fetcher: async () => { called = true; return new Response("{}") } }));
  const response = await handler(request({ question: "QA hỏi", session_id: "00000000-0000-4000-8000-000000000001" }));
  assert(response.status === 404 && !called, "foreign session should never reach Gemini");
});

Deno.test("sends only the selected lesson context and the current conversation to Gemini", async () => {
  let payload: any;
  let headers = new Headers();
  const handler = createStudentAiTutorHandler(deps({ fetcher: async (_input, init) => {
    headers = new Headers(init?.headers);
    payload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "QA- Đáp án gợi ý" }] } }] }), { status: 200 });
  } }));
  const response = await handler(request({ question: "QA- Giải bài này", history: [{ role: "user", text: "QA- Câu trước" }, { role: "model", text: "QA- Gợi ý trước" }], session_id: "00000000-0000-4000-8000-000000000001" }));
  const serialized = JSON.stringify(payload);
  assert(response.status === 200, "valid student request should succeed");
  assert(headers.get("x-goog-api-key") === "qa-key", "secret must be sent only in server request");
  assert(serialized.includes("QA- Phương trình bậc nhất") && serialized.includes("QA- Giải bài này"), "lesson note and chat should be sent");
  assert(!serialized.includes("student_id") && !serialized.includes("student_attendances") && !serialized.includes("grades") && !serialized.includes("homework_score") && !serialized.includes("comment") && !serialized.includes("video"), "private evaluation data and video must be excluded");
});

Deno.test("rejects malformed, overlong questions and history", async () => {
  let calls = 0;
  const handler = createStudentAiTutorHandler(deps({ fetcher: async () => { calls++; return new Response("{}") } }));
  assert((await handler(request({ question: "x".repeat(2001) }))).status === 400, "overlong question should fail");
  assert((await handler(request({ question: "QA hỏi", history: Array.from({ length: 22 }, () => ({ role: "user", text: "QA" })) }))).status === 400, "too many previous messages should fail");
  assert((await handler(request({ question: "QA hỏi", history: [{ role: "system", text: "QA" }] }))).status === 400, "unsupported role should fail");
  assert((await handler(request({ question: "QA hỏi", session_id: "not-a-uuid" }))).status === 400, "malformed session ID should fail");
  assert(calls === 0, "invalid requests must not call Gemini");
});

Deno.test("keeps upstream failures safe and retryable", async () => {
  const missing = createStudentAiTutorHandler(deps({ getApiKey: () => undefined }));
  assert((await missing(request({ question: "QA hỏi" }))).status === 503, "missing key should return a configuration error");
  const quota = createStudentAiTutorHandler(deps({ fetcher: async () => new Response("{}", { status: 429 }) }));
  const response = await quota(request({ question: "QA hỏi" }));
  const body = await response.text();
  assert(response.status === 429 && body.includes("Câu hỏi vẫn được giữ lại"), "quota failure should be recoverable");
});
