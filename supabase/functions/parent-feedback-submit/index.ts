import { createParentFeedbackHandler, createRateLimitKey } from "./handler.ts";
import { createParentFeedbackStore } from "./store.ts";

let store: ReturnType<typeof createParentFeedbackStore> | null = null;

Deno.serve(createParentFeedbackHandler({
  getRateLimitKey: (req) => {
    const secret = Deno.env.get("PARENT_FEEDBACK_RATE_LIMIT_SECRET");
    if (!secret) throw new Error("RATE_LIMIT_SECRET_MISSING");
    return createRateLimitKey(req, secret);
  },
  getStore: () => {
    if (!store) store = createParentFeedbackStore();
    return store;
  },
}));
