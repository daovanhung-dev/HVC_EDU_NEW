import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";
import type {
  TemplateApplyResult,
  TemplateCaller,
  TemplateInput,
  TemplatePreview,
} from "./types.ts";

export interface TemplateAdditionStore {
  preview(input: TemplateInput, actorUserId: string): Promise<TemplatePreview>;
  apply(
    input: TemplateInput,
    actorUserId: string,
  ): Promise<TemplateApplyResult>;
}

export interface TemplateAdditionDependencies {
  getCaller(req: Request): Promise<TemplateCaller>;
  getStore(): TemplateAdditionStore;
}

interface CodedError extends Error {
  code?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(?::\d{2})?$/;
const PUBLIC_ERRORS: Record<string, { message: string; status: number }> = {
  DUPLICATE_TEACHER: {
    message: "Một buổi mẫu có giáo viên bị trùng.",
    status: 400,
  },
  EMPTY_TEMPLATE: {
    message: "Hãy thêm ít nhất một buổi vào mẫu lịch.",
    status: 400,
  },
  CLASS_NOT_FOUND: {
    message: "Một lớp trong mẫu không còn tồn tại. Hãy tải lại danh sách lớp.",
    status: 400,
  },
  CLASS_NOT_ACTIVE: {
    message: "Lớp đã ngừng hoạt động nên không thể thêm buổi tương lai.",
    status: 400,
  },
  TEACHER_NOT_ACTIVE: {
    message: "Chỉ giáo viên đang hoạt động mới có thể được phân công.",
    status: 400,
  },
  INVALID_TEMPLATE: {
    message:
      "Một buổi trong mẫu chưa hợp lệ. Hãy kiểm tra lớp, giáo viên và khung giờ.",
    status: 400,
  },
  TEMPLATE_LIMIT_EXCEEDED: {
    message: "Mẫu lịch vượt quá 100 buổi.",
    status: 400,
  },
  NO_REMAINING_OCCURRENCES: {
    message:
      "Không còn buổi nào có giờ bắt đầu trong tương lai ở phần còn lại của tháng đã chọn.",
    status: 400,
  },
};
const DOMAIN_ERROR_CODES = new Set([
  "FORBIDDEN",
  "INVALID_INPUT",
  "TEMPLATE_ADDITION_BLOCKED",
  ...Object.keys(PUBLIC_ERRORS),
]);

function codedError(code: string): CodedError {
  const error = new Error(code) as CodedError;
  error.code = code;
  return error;
}

function timeSeconds(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null;
  const [hours = 0, minutes = 0, seconds = 0] = value.split(":").map((part) =>
    Number(part)
  );
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function isTemplateInput(value: unknown): value is TemplateInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<TemplateInput>;
  if (input.operation !== "preview" && input.operation !== "apply") {
    return false;
  }
  if (
    typeof input.month_start !== "string" ||
    !DATE_PATTERN.test(input.month_start)
  ) return false;
  const [year, month, day] = input.month_start.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.toISOString().slice(0, 10) !== input.month_start || day !== 1
  ) return false;
  if (
    !Array.isArray(input.template) || input.template.length === 0 ||
    input.template.length > 100
  ) return false;
  if (input.range !== "FULL_MONTH" && input.range !== "REMAINING_DAYS") {
    return false;
  }
  if (
    input.duplicate_action !== "OVERWRITE_SAFE" &&
    input.duplicate_action !== "SKIP"
  ) return false;
  return input.template.every((slot) => {
    if (!slot || typeof slot !== "object") return false;
    const startSeconds = typeof slot.start_time === "string"
      ? timeSeconds(slot.start_time)
      : null;
    const endSeconds = typeof slot.end_time === "string"
      ? timeSeconds(slot.end_time)
      : null;
    return Number.isInteger(slot.day_of_week) && slot.day_of_week >= 1 &&
      slot.day_of_week <= 7 &&
      typeof slot.class_id === "string" && UUID_PATTERN.test(slot.class_id) &&
      startSeconds !== null && endSeconds !== null &&
      endSeconds > startSeconds &&
      (slot.room == null || typeof slot.room === "string") &&
      Array.isArray(slot.staff_ids) && slot.staff_ids.length > 0 &&
      slot.staff_ids.length <= 5 &&
      slot.staff_ids.every((staffId) =>
        typeof staffId === "string" && UUID_PATTERN.test(staffId)
      ) &&
      new Set(slot.staff_ids.map((staffId) => staffId.toLowerCase())).size ===
        slot.staff_ids.length;
  });
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { code?: unknown; message?: unknown };
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (DOMAIN_ERROR_CODES.has(code)) return code;
  for (const domainCode of DOMAIN_ERROR_CODES) {
    if (message === domainCode || message.startsWith(`${domainCode}:`)) {
      return domainCode;
    }
  }
  return code || message || null;
}

export function createMonthTemplateAdditionHandler(
  dependencies: TemplateAdditionDependencies,
) {
  return async (req: Request): Promise<Response> => {
    const options = handleOptions(req);
    if (options) return options;
    if (req.method !== "POST") {
      return fail("METHOD_NOT_ALLOWED", "Chỉ chấp nhận yêu cầu POST.", 405);
    }

    try {
      const caller = await dependencies.getCaller(req);
      if (
        !caller.user?.id || caller.profile.status !== "ACTIVE" ||
        !["ADMIN", "ROOT_ADMIN"].includes(caller.profile.role)
      ) {
        throw codedError("FORBIDDEN");
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw codedError("INVALID_INPUT");
      }
      if (!isTemplateInput(body)) throw codedError("INVALID_INPUT");

      const store = dependencies.getStore();
      const result = body.operation === "preview"
        ? await store.preview(body, caller.user.id)
        : await store.apply(body, caller.user.id);
      return ok(result);
    } catch (error) {
      const code = errorCode(error);
      if (code === "TEMPLATE_ADDITION_BLOCKED") {
        return fail(
          code,
          "Lịch đã thay đổi hoặc có xung đột. Hãy xem lại preview; chưa có buổi nào được thêm.",
          409,
        );
      }
      if (code === "FORBIDDEN") {
        return fail(code, "Bạn không có quyền quản lý lịch lớp.", 403);
      }
      if (code === "INVALID_INPUT") {
        return fail(code, "Thông tin mẫu lịch không hợp lệ.", 400);
      }
      if (code === "NO_REMAINING_OCCURRENCES") {
        return fail(
          code,
          "Không còn buổi nào có giờ bắt đầu trong tương lai ở phần còn lại của tháng đã chọn.",
          400,
        );
      }
      if (code && PUBLIC_ERRORS[code]) {
        return fail(
          code,
          PUBLIC_ERRORS[code].message,
          PUBLIC_ERRORS[code].status,
        );
      }
      return fromError(error, undefined, { stage: "month_template_addition" });
    }
  };
}
