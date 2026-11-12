import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok, traceId } from "../_shared/response.ts";
import type {
  ClassMembershipEnrollmentStore,
  MembershipEnrollmentInput,
} from "../_shared/class-membership-enrollment.ts";

export interface MembershipCaller {
  user: { id: string };
  profile: { role: string; status: string };
}

export interface ClassMembershipDependencies {
  getCaller(req: Request): Promise<MembershipCaller>;
  getStore(): ClassMembershipEnrollmentStore;
}

interface CodedError extends Error {
  code?: string;
  details?: unknown;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function conflictReason(reason: unknown): string {
  switch (reason) {
    case "ROOM_REQUIRED_FOR_OVERLAP":
      return "cần khai báo phòng cho cả hai buổi trùng giờ";
    case "ROOM_ALREADY_BOOKED":
      return "phòng đã có lịch khác trong cùng khung giờ";
    default:
      return "học sinh có buổi khác trùng giờ";
  }
}

function errorResponse(
  error: unknown,
  requestTraceId: string,
  role: string,
): Response {
  const value = error && typeof error === "object"
    ? error as CodedError
    : {} as CodedError;
  const details = isObject(value.details) ? value.details : {};
  switch (value.code) {
    case "MEMBERSHIP_ROSTER_SYNC_CONFLICT": {
      const date = typeof details.session_date === "string"
        ? details.session_date
        : null;
      const reason = conflictReason(details.reason);
      return fail(
        value.code,
        `Không thể thêm học sinh: buổi${
          date ? ` ngày ${date}` : " trong tháng"
        } ${reason}. Membership và các roster chưa được thay đổi.`,
        409,
        requestTraceId,
        details,
      );
    }
    case "STUDENT_ALREADY_IN_CLASS":
      return fail(
        value.code,
        "Học sinh đã được xếp vào lớp trong khoảng ngày này.",
        409,
        requestTraceId,
      );
    case "CLASS_NOT_ACTIVE":
      return fail(
        value.code,
        "Chỉ có thể xếp học sinh vào lớp đang hoạt động.",
        409,
        requestTraceId,
      );
    case "STUDENT_NOT_ACTIVE":
      return fail(
        value.code,
        "Chỉ có thể xếp học sinh đang hoạt động vào lớp.",
        409,
        requestTraceId,
      );
    case "FORBIDDEN":
      return fail(
        value.code,
        "Bạn không có quyền xếp học sinh vào lớp.",
        403,
        requestTraceId,
      );
    case "INVALID_INPUT":
      return fail(
        value.code,
        "Dữ liệu xếp lớp không hợp lệ.",
        400,
        requestTraceId,
      );
    default:
      return fromError(error, requestTraceId, {
        stage: "class_membership",
        role,
      });
  }
}

export function createClassMembershipHandler(
  dependencies: ClassMembershipDependencies,
) {
  return async (req: Request): Promise<Response> => {
    const options = handleOptions(req);
    if (options) return options;
    const requestTraceId = traceId();
    if (req.method !== "POST") {
      return fail(
        "METHOD_NOT_ALLOWED",
        "Chỉ hỗ trợ POST.",
        405,
        requestTraceId,
      );
    }

    let caller: MembershipCaller;
    try {
      caller = await dependencies.getCaller(req);
    } catch (error) {
      return fromError(error, requestTraceId, { stage: "auth" });
    }
    if (
      caller.profile.status !== "ACTIVE" ||
      !["ADMIN", "ROOT_ADMIN"].includes(caller.profile.role)
    ) {
      return fail(
        "FORBIDDEN",
        "Chỉ Admin mới được xếp học sinh vào lớp.",
        403,
        requestTraceId,
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(
        "INVALID_INPUT",
        "Dữ liệu yêu cầu không hợp lệ.",
        400,
        requestTraceId,
      );
    }
    if (
      !isObject(body) || body.operation !== "add" ||
      typeof body.class_id !== "string" || !UUID_PATTERN.test(body.class_id) ||
      typeof body.student_id !== "string" ||
      !UUID_PATTERN.test(body.student_id) ||
      !validDate(body.start_date)
    ) {
      return fail(
        "INVALID_INPUT",
        "Dữ liệu xếp lớp không hợp lệ.",
        400,
        requestTraceId,
      );
    }

    const input: MembershipEnrollmentInput = {
      class_id: body.class_id,
      student_id: body.student_id,
      start_date: body.start_date,
      actor_user_id: caller.user.id,
    };
    try {
      const result = await dependencies.getStore().enroll(input);
      return ok(result, requestTraceId);
    } catch (error) {
      return errorResponse(error, requestTraceId, caller.profile.role);
    }
  };
}
