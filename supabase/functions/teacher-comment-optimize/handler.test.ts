import { createTeacherCommentOptimizeHandler } from "./handler.ts";

const activeTeacher = {
  user: { id: "qa-teacher-user" },
  profile: { role: "TEACHER", status: "ACTIVE" },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeRequest(body: unknown) {
  return new Request("https://local.test/teacher-comment-optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDependencies(overrides: Partial<Parameters<typeof createTeacherCommentOptimizeHandler>[0]> = {}) {
  return {
    getCaller: async () => activeTeacher,
    isActiveTeacher: async () => true,
    getApiKey: () => "qa-gemini-key",
    fetcher: async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Nhận xét đã được diễn đạt rõ ràng hơn." }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
    ...overrides,
  };
}

Deno.test("rejects callers who are not active teachers", async () => {
  const handler = createTeacherCommentOptimizeHandler(makeDependencies({
    getCaller: async () => ({ user: { id: "qa-admin" }, profile: { role: "ADMIN", status: "ACTIVE" } }),
  }));
  const response = await handler(makeRequest({ comment: "QA nhận xét" }));
  const body = await response.json();
  assert(response.status === 403, "non-teacher should be forbidden");
  assert(body.error.code === "FORBIDDEN", "response should identify forbidden access");
});

Deno.test("rejects a teacher whose staff record is inactive", async () => {
  const handler = createTeacherCommentOptimizeHandler(makeDependencies({ isActiveTeacher: async () => false }));
  const response = await handler(makeRequest({ comment: "QA nhận xét" }));
  assert(response.status === 403, "inactive staff record should be forbidden");
});

Deno.test("rejects blank and overlong comments before calling Gemini", async () => {
  let calls = 0;
  const handler = createTeacherCommentOptimizeHandler(makeDependencies({
    fetcher: async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  }));
  const blank = await handler(makeRequest({ comment: "   " }));
  const long = await handler(makeRequest({ comment: "x".repeat(2001) }));
  assert(blank.status === 400, "blank comment should be rejected");
  assert(long.status === 400, "overlong comment should be rejected");
  assert(calls === 0, "invalid input should not reach Gemini");
});

Deno.test("returns a draft and sends only comment text to Gemini", async () => {
  let capturedUrl = "";
  let capturedHeaders = new Headers();
  let capturedBody: Record<string, unknown> = {};
  const handler = createTeacherCommentOptimizeHandler(makeDependencies({
    fetcher: async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Bản nhận xét đã tối ưu." }] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  }));
  const response = await handler(makeRequest({ comment: "QA- học sinh tiến bộ" }));
  const body = await response.json();
  const serializedBody = JSON.stringify(capturedBody);
  assert(response.status === 200, "valid comment should succeed");
  assert(body.data.optimized_comment === "Bản nhận xét đã tối ưu.", "draft should be returned");
  assert(capturedUrl.includes("gemini-3.8-flash:generateContent"), "expected stable Flash endpoint");
  assert(capturedHeaders.get("x-goog-api-key") === "qa-gemini-key", "key should be sent only in server request header");
  assert(serializedBody.includes("QA- học sinh tiến bộ"), "comment text should be sent");
  assert(!serializedBody.includes("student_id"), "student identity must not be sent");
});

Deno.test("handles missing key, quota errors, and empty model output", async () => {
  const missingKey = createTeacherCommentOptimizeHandler(makeDependencies({ getApiKey: () => undefined }));
  const missingResponse = await missingKey(makeRequest({ comment: "QA nhận xét" }));
  assert(missingResponse.status === 503, "missing secret should be unavailable");

  const quota = createTeacherCommentOptimizeHandler(makeDependencies({
    fetcher: async () => new Response("{}", { status: 429 }),
  }));
  const quotaResponse = await quota(makeRequest({ comment: "QA nhận xét" }));
  assert(quotaResponse.status === 429, "quota error should be recoverable");

  const empty = createTeacherCommentOptimizeHandler(makeDependencies({
    fetcher: async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
  }));
  const emptyResponse = await empty(makeRequest({ comment: "QA nhận xét" }));
  assert(emptyResponse.status === 502, "empty output should return a safe failure");

  const networkFailure = createTeacherCommentOptimizeHandler(makeDependencies({
    fetcher: async () => { throw new Error("QA raw upstream detail"); },
  }));
  const networkResponse = await networkFailure(makeRequest({ comment: "QA nhận xét" }));
  const networkBody = await networkResponse.text();
  assert(networkResponse.status === 502, "network failure should return a safe failure");
  assert(!networkBody.includes("QA raw upstream detail"), "upstream details must not be exposed");
  assert(!networkBody.includes("qa-gemini-key"), "API key must never be exposed");
});

Deno.test("aborts a timed out Gemini request and returns a safe message", async () => {
  const timedOut = createTeacherCommentOptimizeHandler(makeDependencies({
    timeoutMs: 1,
    fetcher: async (_input, init) => await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) reject(new DOMException("QA upstream timeout", "AbortError"));
      else signal?.addEventListener("abort", () => reject(new DOMException("QA upstream timeout", "AbortError")), { once: true });
    }),
  }));
  const response = await timedOut(makeRequest({ comment: "QA nhận xét" }));
  const body = await response.text();
  assert(response.status === 502, "timeout should return an upstream failure");
  assert(body.includes("Nội dung gốc vẫn được giữ nguyên"), "timeout should preserve the original comment");
  assert(!body.includes("QA upstream timeout"), "upstream timeout details must not be exposed");
});
