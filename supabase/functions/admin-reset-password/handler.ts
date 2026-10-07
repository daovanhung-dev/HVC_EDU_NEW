import { handleOptions } from "../_shared/cors.ts";
import { ADMIN_RESET_PASSWORD } from "../_shared/password-reset.ts";
import { fail, fromError, ok } from "../_shared/response.ts";

export interface ResetPasswordCaller {
  user: { id: string };
  profile: { role: string };
}

export interface AdminResetPasswordDependencies {
  getCaller: (request: Request) => Promise<ResetPasswordCaller>;
  hasStaffManagePermission: (userId: string) => Promise<boolean>;
  updatePassword: (userId: string, password: string) => Promise<void>;
  setForcePasswordChange: (
    userId: string,
  ) => Promise<{ id: string; username: string | null }>;
  writeAudit: (
    input: { actorUserId: string; profileId: string },
  ) => Promise<void>;
}

export function createAdminResetPasswordHandler(
  dependencies: AdminResetPasswordDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const options = handleOptions(request);
    if (options) return options;

    try {
      const caller = await dependencies.getCaller(request);
      const body = await request.json() as { user_id?: string };
      if (!body.user_id) return fail("INVALID_INPUT", "Thiếu user_id.");

      if (
        caller.profile.role !== "ROOT_ADMIN" &&
        !await dependencies.hasStaffManagePermission(caller.user.id)
      ) {
        return fail("FORBIDDEN", "Bạn không có quyền reset mật khẩu.", 403);
      }

      await dependencies.updatePassword(body.user_id, ADMIN_RESET_PASSWORD);
      const profile = await dependencies.setForcePasswordChange(body.user_id);
      await dependencies.writeAudit({
        actorUserId: caller.user.id,
        profileId: profile.id,
      });

      return ok({ profile, temporary_password: ADMIN_RESET_PASSWORD });
    } catch (error) {
      return fromError(error);
    }
  };
}
