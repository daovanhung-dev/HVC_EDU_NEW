import { handleOptions } from "../_shared/cors.ts";
import { ADMIN_RESET_PASSWORD } from "../_shared/password-reset.ts";
import { fail, fromError, ok } from "../_shared/response.ts";

const MAX_TARGETS = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BulkResetCaller {
  user: { id: string };
  profile: { role: string };
}

export interface BulkResetTargetState {
  user_id: string;
  profile_id: string | null;
  role: string | null;
  profile_status: string | null;
  entity_exists: boolean;
  entity_status: string | null;
}

export interface BulkResetPasswordDependencies {
  getCaller: (request: Request) => Promise<BulkResetCaller>;
  hasStaffManagePermission: (userId: string) => Promise<boolean>;
  getTargetStates: (userIds: string[]) => Promise<BulkResetTargetState[]>;
  updatePassword: (userId: string, password: string) => Promise<void>;
  setForcePasswordChange: (userId: string) => Promise<void>;
  writeAudit: (input: {
    actorUserId: string;
    profileId: string;
    forcePasswordChange: boolean | null;
    passwordReset: boolean;
  }) => Promise<void>;
}

type ResultStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";

interface TargetResult {
  user_id: string;
  status: ResultStatus;
  password_reset: boolean;
  reason_codes: string[];
}

function validUserIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const userIds = (body as { user_ids?: unknown }).user_ids;
  if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > MAX_TARGETS) return null;
  if (!userIds.every((userId) => typeof userId === "string" && UUID_PATTERN.test(userId))) return null;
  const normalized = userIds.map((userId) => userId.toLowerCase());
  if (new Set(normalized).size !== normalized.length) return null;
  return userIds as string[];
}

function ineligibleReason(target: BulkResetTargetState | undefined): string | null {
  if (!target || !target.profile_id) return "ACCOUNT_NOT_FOUND";
  if (target.profile_status !== "ACTIVE") return "ACCOUNT_INACTIVE";
  if (target.role !== "STUDENT" && target.role !== "TEACHER") return "TARGET_ROLE_NOT_SUPPORTED";
  if (!target.entity_exists) return "TARGET_PROFILE_NOT_FOUND";
  if (target.entity_status !== "ACTIVE") return "TARGET_PROFILE_NOT_ACTIVE";
  return null;
}

export function createAdminResetPasswordBulkHandler(
  dependencies: BulkResetPasswordDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const options = handleOptions(request);
    if (options) return options;

    try {
      const caller = await dependencies.getCaller(request);
      if (
        caller.profile.role !== "ROOT_ADMIN" &&
        !await dependencies.hasStaffManagePermission(caller.user.id)
      ) {
        return fail("FORBIDDEN", "Bạn không có quyền reset mật khẩu.", 403);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return fail("INVALID_INPUT", "Danh sách tài khoản không hợp lệ.");
      }
      const userIds = validUserIds(body);
      if (!userIds) {
        return fail(
          "INVALID_INPUT",
          `Chọn từ 1 đến ${MAX_TARGETS} tài khoản hợp lệ, không trùng lặp.`,
        );
      }

      const targetStates = await dependencies.getTargetStates(userIds);
      const targetByUserId = new Map(
        targetStates.map((target) => [target.user_id.toLowerCase(), target]),
      );
      const results: TargetResult[] = [];

      for (const userId of userIds) {
        const target = targetByUserId.get(userId.toLowerCase());
        const notEligible = ineligibleReason(target);
        if (notEligible) {
          results.push({
            user_id: userId,
            status: "SKIPPED",
            password_reset: false,
            reason_codes: [notEligible],
          });
          continue;
        }

        const reasonCodes: string[] = [];
        let forcePasswordChangeSet: boolean | null = true;
        try {
          await dependencies.setForcePasswordChange(userId);
        } catch {
          forcePasswordChangeSet = null;
          reasonCodes.push("FORCE_PASSWORD_CHANGE_FAILED");
        }

        let passwordReset = false;
        if (forcePasswordChangeSet === true) {
          try {
            await dependencies.updatePassword(userId, ADMIN_RESET_PASSWORD);
            passwordReset = true;
          } catch {
            reasonCodes.push("PASSWORD_UPDATE_FAILED");
          }
        }

        try {
          await dependencies.writeAudit({
            actorUserId: caller.user.id,
            profileId: target!.profile_id!,
            forcePasswordChange: forcePasswordChangeSet,
            passwordReset,
          });
        } catch {
          reasonCodes.push("AUDIT_WRITE_FAILED");
        }

        results.push({
          user_id: userId,
          status: reasonCodes.length
            ? forcePasswordChangeSet === true ? "PARTIAL" : "FAILED"
            : "SUCCESS",
          password_reset: passwordReset,
          reason_codes: reasonCodes,
        });
      }

      const anyPasswordReset = results.some((result) => result.password_reset);
      return ok({
        temporary_password: anyPasswordReset ? ADMIN_RESET_PASSWORD : null,
        results,
      });
    } catch (error) {
      return fromError(error);
    }
  };
}
