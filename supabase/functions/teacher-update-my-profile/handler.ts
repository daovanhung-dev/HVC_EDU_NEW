import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";
import type {
  TeacherProfileCaller,
  TeacherProfileInput,
  TeacherProfileResult,
} from "./types.ts";

export interface TeacherProfileStore {
  updateMyProfile(
    userId: string,
    input: TeacherProfileInput,
  ): Promise<TeacherProfileResult>;
}

export interface TeacherProfileUpdateDependencies {
  getCaller(request: Request): Promise<TeacherProfileCaller>;
  getStore(): TeacherProfileStore;
}

function invalidInput() {
  return fail("INVALID_INPUT", "Họ tên hoặc số điện thoại không hợp lệ.", 400);
}

function optionalText(value: unknown, maxLength: number): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (normalized.length > maxLength) return false;
  return normalized || null;
}

export function createTeacherProfileUpdateHandler(
  dependencies: TeacherProfileUpdateDependencies,
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
        caller.profile.role !== "TEACHER" || caller.profile.status !== "ACTIVE"
      ) {
        return fail("FORBIDDEN", "Chức năng chỉ dành cho giáo viên đang hoạt động.", 403);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return invalidInput();
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return invalidInput();
      }

      const values = body as Record<string, unknown>;
      const fullName = typeof values.full_name === "string"
        ? values.full_name.trim()
        : "";
      const phone = typeof values.phone === "string" ? values.phone.trim() : "";
      const email = optionalText(values.email, 254);
      const address = optionalText(values.address, 500);
      if (!fullName || fullName.length > 200 || !phone || phone.length > 50 || email === false || address === false) {
        return invalidInput();
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail("INVALID_EMAIL", "Email không hợp lệ.", 400);
      }

      const result = await dependencies.getStore().updateMyProfile(caller.user.id, {
        full_name: fullName,
        phone,
        email,
        address,
      });
      return ok(result);
    } catch (error) {
      return fromError(error, undefined, { stage: "teacher_profile_update", role: "TEACHER" });
    }
  };
}
