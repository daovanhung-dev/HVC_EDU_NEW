import { adminClient, requireCaller } from "../_shared/auth.ts";
import { createTeacherCommentOptimizeHandler } from "./handler.ts";

const handler = createTeacherCommentOptimizeHandler({
  getCaller: requireCaller,
  isActiveTeacher: async (userId) => {
    const { data, error } = await adminClient()
      .from("staff")
      .select("id")
      .eq("user_id", userId)
      .eq("staff_type", "TEACHER")
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },
  getApiKey: () => Deno.env.get("GEMINI_API_KEY"),
});

Deno.serve(handler);
