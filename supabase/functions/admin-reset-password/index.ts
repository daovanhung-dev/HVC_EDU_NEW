import { adminClient, requireCaller } from "../_shared/auth.ts";
import { createAdminResetPasswordHandler } from "./handler.ts";

const handler = createAdminResetPasswordHandler({
  getCaller: requireCaller,
  hasStaffManagePermission: async (userId) => {
    const { data, error } = await adminClient().rpc("actor_has_permission", {
      p_user_id: userId,
      p_permission_code: "STAFF_MANAGE",
    });
    return !error && Boolean(data);
  },
  updatePassword: async (userId, password) => {
    const { error } = await adminClient().auth.admin.updateUserById(userId, {
      password,
    });
    if (error) throw error;
  },
  setForcePasswordChange: async (userId) => {
    const { data, error } = await adminClient()
      .from("profiles")
      .update({ force_password_change: true })
      .eq("user_id", userId)
      .select("id,username")
      .single();
    if (error) throw error;
    return data;
  },
  writeAudit: async ({ actorUserId, profileId }) => {
    await adminClient().rpc("write_audit", {
      p_actor_user_id: actorUserId,
      p_action: "ACCOUNT_RESET_PASSWORD",
      p_entity_type: "profiles",
      p_entity_id: profileId,
      p_new_data: { force_password_change: true },
    });
  },
});

Deno.serve(handler);
