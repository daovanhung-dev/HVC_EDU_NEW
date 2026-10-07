import { adminClient, requireCaller } from "../_shared/auth.ts";
import { createForcedPasswordChangeHandler } from "./handler.ts";

const handler = createForcedPasswordChangeHandler({
  getCaller: (request) => requireCaller(request, { allowForcedPasswordChange: true }),
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
      .eq("status", "ACTIVE")
      .in("role", ["STUDENT", "TEACHER"])
      .eq("force_password_change", true)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("PASSWORD_CHANGE_STATE_CHANGED");
  },
});

Deno.serve(handler);
