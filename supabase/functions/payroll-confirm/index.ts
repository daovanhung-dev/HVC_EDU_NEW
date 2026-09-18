import { handleOptions } from "../_shared/cors.ts";
import { fail } from "../_shared/response.ts";

Deno.serve((req) => {
  const options = handleOptions(req);
  if (options) return options;
  return fail("FEATURE_DISABLED", "Tính năng tài chính đã được lưu trữ.", 410);
});
