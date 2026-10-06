import { adminClient, requireCaller } from "../_shared/auth.ts";
import { createForcedStudentPasswordChangeHandler } from "./handler.ts";

const handler = createForcedStudentPasswordChangeHandler({
  getCaller: (request) => requireCaller(request, { allowForcedStudentPasswordChange: true }),
  updatePassword: async (userId, password) => {
    const { error } = await adminClient().auth.admin.updateUserById(userId, {
      password,
    });
    if (error) throw error;
  },
  clearForcePasswordChange: async (userId) => {
    const { data, error } = await adminClient()
      .from("profiles")
      .update({ force_password_change: false })
      .eq("user_id", userId)
      .eq("role", "STUDENT")
      .eq("force_password_change", true)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("PASSWORD_CHANGE_STATE_CHANGED");
  },
});

Deno.serve(handler);
