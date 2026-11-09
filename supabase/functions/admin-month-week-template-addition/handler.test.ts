import { createMonthTemplateAdditionHandler } from "./handler.ts";
import type { TemplateAdditionDependencies } from "./handler.ts";
import type { TemplateInput } from "./types.ts";

const QA_ADMIN = "f0640000-0000-0000-0000-000000000001";
const QA_CLASS = "f0640000-0000-0000-0000-000000000303";
const QA_TEACHER = "f0640000-0000-0000-0000-000000000101";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(body: unknown, method = "POST") {
  return new Request(
    "https://local.test/functions/v1/admin-month-week-template-addition",
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    },
  );
}

function input(operation: "preview" | "apply" = "preview"): TemplateInput {
  return {
    operation,
    month_start: "2026-12-01",
    template: [{
      day_of_week: 1,
      class_id: QA_CLASS,
      start_time: "08:00",
      end_time: "09:00",
      room: "QA-A1",
      staff_ids: [QA_TEACHER],
    }],
    range: "FULL_MONTH",
    duplicate_action: "SKIP",
  };
}

function dependencies(overrides: Partial<TemplateAdditionDependencies> = {}) {
  const calls = { previews: 0, applies: 0, stores: 0, auth: 0 };
  const deps: TemplateAdditionDependencies = {
    getCaller: async () => {
      calls.auth += 1;
      return {
        user: { id: QA_ADMIN },
        profile: { role: "ROOT_ADMIN", status: "ACTIVE" },
      };
    },
    getStore: () => {
      calls.stores += 1;
      return {
        preview: async () => {
          calls.previews += 1;
          return {
            month_start: "2026-12-01",
            range: "FULL_MONTH",
            create_count: 4,
            update_count: 0,
            overwriteable_duplicate_count: 0,
            recurring_duplicate_count: 0,
            skipped_duplicate_count: 0,
            protected_duplicate_count: 0,
            blockers: [],
            matches: [],
          };
        },
        apply: async () => {
          calls.applies += 1;
          return {
            month_start: "2026-12-01",
            range: "FULL_MONTH",
            created_sessions: 4,
            updated_sessions: 0,
            skipped_duplicates: 0,
            protected_duplicates: 0,
          };
        },
      };
    },
    ...overrides,
  };
  return { calls, deps };
}

Deno.test("previews and applies through the same Edge Function contract", async () => {
  const { calls, deps } = dependencies();
  const handler = createMonthTemplateAdditionHandler(deps);

  const previewResponse = await handler(request(input("preview")));
  const previewBody = await previewResponse.json();
  assert(
    previewResponse.status === 200 && previewBody.success,
    "preview should return the standard success envelope",
  );
  assert(
    previewBody.data.create_count === 4,
    "preview should return the planned count",
  );

  const applyResponse = await handler(request(input("apply")));
  const applyBody = await applyResponse.json();
  assert(
    applyResponse.status === 200 && applyBody.success,
    "apply should return the standard success envelope",
  );
  assert(
    applyBody.data.created_sessions === 4,
    "apply should return the applied count",
  );
  assert(
    calls.previews === 1 && calls.applies === 1,
    "each operation should call only its matching store method",
  );
});

Deno.test("rejects inactive or non-admin callers before opening the database", async () => {
  const { calls, deps } = dependencies({
    getCaller: async () => ({
      user: { id: QA_ADMIN },
      profile: { role: "TEACHER", status: "ACTIVE" },
    }),
  });
  const response = await createMonthTemplateAdditionHandler(deps)(
    request(input()),
  );
  const body = await response.json();
  assert(
    response.status === 403 && body.error.code === "FORBIDDEN",
    "teacher should be denied",
  );
  assert(
    calls.stores === 0,
    "unauthorized caller must not create a database store",
  );
});

Deno.test("rejects malformed requests before opening the database", async () => {
  const { calls, deps } = dependencies();
  const response = await createMonthTemplateAdditionHandler(deps)(
    request({ ...input(), month_start: "2026-12-02" }),
  );
  const body = await response.json();
  assert(
    response.status === 400 && body.error.code === "INVALID_INPUT",
    "non-month-start date should be rejected",
  );
  assert(calls.stores === 0, "invalid input must not create a database store");
});

Deno.test("returns a conflict response when the apply transaction is blocked", async () => {
  const { deps } = dependencies({
    getStore: () => ({
      preview: async () => {
        throw new Error("unused");
      },
      apply: async () => {
        throw Object.assign(new Error("TEMPLATE_ADDITION_BLOCKED"), {
          code: "P0001",
        });
      },
    }),
  });
  const response = await createMonthTemplateAdditionHandler(deps)(
    request(input("apply")),
  );
  const body = await response.json();
  assert(
    response.status === 409 && body.error.code === "TEMPLATE_ADDITION_BLOCKED",
    "blocked apply should request a new preview",
  );
});

Deno.test("rejects non-POST methods", async () => {
  const { calls, deps } = dependencies();
  const response = await createMonthTemplateAdditionHandler(deps)(
    request(null, "GET"),
  );
  assert(response.status === 405, "GET should be rejected");
  assert(
    calls.auth === 0 && calls.stores === 0,
    "unsupported methods must not authenticate or access data",
  );
});
