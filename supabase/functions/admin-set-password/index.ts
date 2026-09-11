import { adminClient, requireCaller } from "../_shared/auth.ts";
import { handleOptions } from "../_shared/cors.ts";
import { appError, fail, fromError, ok } from "../_shared/response.ts";

interface SetPasswordBody {
  user_id?: string;
  password?: string;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const caller = await requireCaller(req);
    if (caller.profile.role !== "ROOT_ADMIN") {
      return fail(
        "FORBIDDEN",
        "Chỉ ROOT_ADMIN được đặt mật khẩu trực tiếp.",
        403,
      );
    }

    const body = await req.json() as SetPasswordBody;
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (
      !userId || !password || password !== password.trim() ||
      password.length < 6 || password.length > 72
    ) {
      throw appError("INVALID_INPUT");
    }

    const admin = adminClient();
    const profile = await admin.from("profiles").select(
      "id,user_id,username,role,status",
    ).eq("user_id", userId).single();
    if (profile.error || !profile.data) throw appError("ACCOUNT_NOT_FOUND");
    if (profile.data.status !== "ACTIVE") throw appError("ACCOUNT_INACTIVE");

    const updated = await admin.auth.admin.updateUserById(userId, { password });
    if (updated.error) throw updated.error;

    const flag = await admin.from("profiles").update({
      force_password_change: false,
    }).eq("user_id", userId).select("id,user_id,username,force_password_change")
      .single();
    if (flag.error || !flag.data) {
      throw flag.error || appError("ACCOUNT_NOT_FOUND");
    }

    const audit = await admin.rpc("write_audit", {
      p_actor_user_id: caller.user.id,
      p_action: "ACCOUNT_SET_PASSWORD",
      p_entity_type: "profiles",
      p_entity_id: profile.data.id,
      p_new_data: {
        user_id: userId,
        username: profile.data.username,
        force_password_change: false,
      },
    });
    if (audit.error) throw audit.error;

    return ok({ profile: flag.data });
  } catch (error) {
    return fromError(error);
  }
});
