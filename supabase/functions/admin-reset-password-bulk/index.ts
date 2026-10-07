import { adminClient, requireCaller } from "../_shared/auth.ts";
import { createAdminResetPasswordBulkHandler } from "./handler.ts";

const handler = createAdminResetPasswordBulkHandler({
  getCaller: requireCaller,
  hasStaffManagePermission: async (userId) => {
    const { data, error } = await adminClient().rpc("actor_has_permission", {
      p_user_id: userId,
      p_permission_code: "STAFF_MANAGE",
    });
    return !error && Boolean(data);
  },
  getTargetStates: async (userIds) => {
    const client = adminClient();
    const [profilesResult, studentsResult, staffResult] = await Promise.all([
      client.from("profiles").select("id,user_id,role,status").in("user_id", userIds),
      client.from("students").select("user_id,status").in("user_id", userIds),
      client.from("staff").select("user_id,status,staff_type").eq("staff_type", "TEACHER").in("user_id", userIds),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (studentsResult.error) throw studentsResult.error;
    if (staffResult.error) throw staffResult.error;

    const profiles = new Map((profilesResult.data || []).map((row) => [row.user_id.toLowerCase(), row]));
    const students = new Map((studentsResult.data || []).map((row) => [row.user_id.toLowerCase(), row]));
    const staff = new Map((staffResult.data || []).map((row) => [row.user_id.toLowerCase(), row]));

    return userIds.map((userId) => {
      const key = userId.toLowerCase();
      const profile = profiles.get(key);
      if (!profile) {
        return {
          user_id: userId,
          profile_id: null,
          role: null,
          profile_status: null,
          entity_exists: false,
          entity_status: null,
        };
      }
      const entity = profile.role === "STUDENT" ? students.get(key) : profile.role === "TEACHER" ? staff.get(key) : null;
      return {
        user_id: userId,
        profile_id: profile.id,
        role: profile.role,
        profile_status: profile.status,
        entity_exists: Boolean(entity),
        entity_status: entity?.status || null,
      };
    });
  },
  updatePassword: async (userId, password) => {
    const { error } = await adminClient().auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  },
  setForcePasswordChange: async (userId) => {
    const { data, error } = await adminClient()
      .from("profiles")
      .update({ force_password_change: true })
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .in("role", ["STUDENT", "TEACHER"])
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ACCOUNT_INACTIVE");
  },
  writeAudit: async ({ actorUserId, profileId, forcePasswordChange, passwordReset }) => {
    const { error } = await adminClient().rpc("write_audit", {
      p_actor_user_id: actorUserId,
      p_action: "ACCOUNT_RESET_PASSWORD",
      p_entity_type: "profiles",
      p_entity_id: profileId,
      p_new_data: {
        force_password_change: forcePasswordChange,
        outcome: forcePasswordChange === null ? "FAILED" : passwordReset ? "SUCCESS" : "PARTIAL",
      },
    });
    if (error) throw error;
  },
});

Deno.serve(handler);
