import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";

export interface ForcedPasswordChangeCaller {
  user: { id: string };
  profile: {
    role: string;
    status: string;
    force_password_change: boolean;
  };
}

export interface ForcedPasswordChangeDependencies {
  getCaller: (request: Request) => Promise<ForcedPasswordChangeCaller>;
  updatePassword: (userId: string, password: string) => Promise<void>;
  clearForcePasswordChange: (userId: string) => Promise<void>;
}

export function createForcedPasswordChangeHandler(
  dependencies: ForcedPasswordChangeDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const options = handleOptions(request);
    if (options) return options;
    if (request.method !== "POST") {
      return fail("METHOD_NOT_ALLOWED", "Phương thức không được hỗ trợ.", 405);
    }

    try {
      const caller = await dependencies.getCaller(request);
      if (
        !["STUDENT", "TEACHER"].includes(caller.profile.role) ||
        caller.profile.status !== "ACTIVE" ||
        !caller.profile.force_password_change
      ) {
        return fail(
          "FORBIDDEN",
          "Chức năng này chỉ dành cho học sinh hoặc giáo viên đang được yêu cầu đổi mật khẩu.",
          403,
        );
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return fail("INVALID_INPUT", "Mật khẩu mới không hợp lệ.", 400);
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail("INVALID_INPUT", "Mật khẩu mới không hợp lệ.", 400);
      }
      const newPassword = (body as { new_password?: unknown }).new_password;
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return fail("INVALID_INPUT", "Mật khẩu mới phải có ít nhất 8 ký tự.", 400);
      }

      await dependencies.updatePassword(caller.user.id, newPassword);
      await dependencies.clearForcePasswordChange(caller.user.id);
      return ok({ changed: true });
    } catch (error) {
      return fromError(error);
    }
  };
}
