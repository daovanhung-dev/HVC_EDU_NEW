import {
  createParentFeedbackHandler,
  createRateLimitKey,
  type ParentFeedbackStore,
  type ParentFeedbackSubmission,
} from "./handler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function responseData(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function request(body: unknown, method = "POST"): Request {
  return new Request("https://example.invalid/functions/v1/parent-feedback-submit", {
    method,
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.20",
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function storeHarness(options: { saved?: boolean; error?: Error } = {}) {
  const state = {
    submissions: [] as Array<{ input: ParentFeedbackSubmission; key: string }>,
    rateLimitCalls: 0,
  };
  const store: ParentFeedbackStore = {
    async submit(input, key) {
      state.submissions.push({ input, key });
      if (options.error) throw options.error;
      return options.saved !== false;
    },
  };
  return {
    state,
    store,
    handler: createParentFeedbackHandler({
      getRateLimitKey: async (req) => {
        state.rateLimitCalls += 1;
        return req.headers.get("cf-connecting-ip") || "qa-network-key";
      },
      getStore: () => store,
    }),
  };
}

Deno.test("accepts a public feedback submission without requiring a caller identity", async () => {
  const harness = storeHarness();
  const response = await harness.handler(request({
    parent_name: "  QA Parent  ",
    student_name: " QA Student ",
    class_name: " QA-Class ",
    feedback: "  QA feedback  ",
  }));
  const result = await responseData(response);

  assert(response.status === 200, "a valid public submission should succeed");
  assert(result.success === true, "the response should use the shared success envelope");
  assert(!("id" in (result.data as Record<string, unknown>)), "the response must not reveal a database row id");
  assert(harness.state.submissions.length === 1, "the feedback should be stored once");
  assert(harness.state.submissions[0].input.parent_name === "QA Parent", "the parent name should be trimmed");
  assert(harness.state.submissions[0].input.student_name === "QA Student", "the optional student name should be trimmed");
  assert(harness.state.submissions[0].input.class_name === "QA-Class", "the optional class should be trimmed");
  assert(harness.state.submissions[0].input.feedback === "QA feedback", "feedback should be trimmed");
});

Deno.test("allows optional student and class fields", async () => {
  const harness = storeHarness();
  const response = await harness.handler(request({
    parent_name: "QA Parent",
    feedback: "QA feedback without student details",
  }));

  assert(response.status === 200, "optional student details should not block a submission");
  assert(harness.state.submissions[0].input.student_name === null, "student name should be stored as null");
  assert(harness.state.submissions[0].input.class_name === null, "class should be stored as null");
});

Deno.test("rejects missing required fields and overlong values without writing or counting a submission", async () => {
  const harness = storeHarness();
  const missing = await harness.handler(request({ parent_name: "QA Parent", feedback: "   " }));
  const tooLong = await harness.handler(request({
    parent_name: "QA Parent",
    feedback: "x".repeat(4001),
  }));

  assert(missing.status === 400, "empty feedback should be rejected");
  assert(tooLong.status === 400, "feedback above the character limit should be rejected");
  assert(harness.state.submissions.length === 0, "invalid submissions should not be stored");
});

Deno.test("returns generic success for a filled honeypot without storing the submission", async () => {
  const harness = storeHarness();
  const response = await harness.handler(request({
    parent_name: "",
    feedback: "",
    website: "https://bot.invalid",
  }));

  assert(response.status === 200, "a honeypot submission should not expose the spam check");
  assert(harness.state.submissions.length === 0, "a honeypot submission must not be stored");
});

Deno.test("bounds streamed request bodies even when content length is omitted", async () => {
  const harness = storeHarness();
  const req = new Request("https://example.invalid/functions/v1/parent-feedback-submit", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.20" },
    body: JSON.stringify({ parent_name: "QA Parent", feedback: "x".repeat(16_000) }),
  });
  const response = await harness.handler(req);

  assert(response.status === 413, "the endpoint should reject a body above the byte limit");
  assert(harness.state.submissions.length === 0, "an oversized body must not be stored");
});

Deno.test("applies the server-side submission limit", async () => {
  const harness = storeHarness({ saved: false });
  const response = await harness.handler(request({
    parent_name: "QA Parent",
    feedback: "QA feedback",
  }));
  const result = await responseData(response);

  assert(response.status === 429, "the sixth submission in a window should be rate limited by the store");
  assert((result.error as Record<string, unknown>).code === "RATE_LIMITED", "the response should expose a safe rate-limit code");
});

Deno.test("returns a retryable response when the network key is unavailable", async () => {
  const store: ParentFeedbackStore = { submit: async () => true };
  const handler = createParentFeedbackHandler({
    getRateLimitKey: async () => { throw new Error("RATE_LIMIT_SOURCE_UNAVAILABLE"); },
    getStore: () => store,
  });
  const response = await handler(request({ parent_name: "QA Parent", feedback: "QA feedback" }));

  assert(response.status === 503, "the endpoint should fail closed when it cannot rate limit a source");
});

Deno.test("uses a stable HMAC for a gateway address and never returns the raw address", async () => {
  const req = request({ parent_name: "QA Parent", feedback: "QA feedback" });
  const first = await createRateLimitKey(req, "qa-test-secret-with-at-least-32-characters");
  const second = await createRateLimitKey(req, "qa-test-secret-with-at-least-32-characters");

  assert(first === second, "the same address and secret should produce a stable key");
  assert(/^[0-9a-f]{64}$/.test(first), "the rate-limit key should be a SHA-256 HMAC");
  assert(first !== "203.0.113.20", "the rate-limit key must not expose the raw address");
});
