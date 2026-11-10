import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";
import type {
  FinalizeCaller,
  FinalizeSessionInput,
  FinalizeSessionResult,
} from "./types.ts";

export interface SessionAttendanceFinalizeStore {
  finalize(
    input: FinalizeSessionInput,
    actorUserId: string,
  ): Promise<FinalizeSessionResult>;
}

export interface SessionAttendanceFinalizeDependencies {
  getCaller(req: Request): Promise<FinalizeCaller>;
  getStore(): SessionAttendanceFinalizeStore;
}

interface CodedError extends Error {
  code?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ATTENDANCE_STATUSES = new Set(["PRESENT", "LATE", "ABSENT", "EXCUSED"]);
const PUBLIC_ERRORS: Record<string, { message: string; status: number }> = {
  FORBIDDEN: {
    message: "Bạn không có quyền chốt điểm danh và chấm công.",
    status: 403,
  },
  INVALID_INPUT: { message: "Thông tin điểm danh không hợp lệ.", status: 400 },
  SESSION_NOT_FOUND: { message: "Không tìm thấy buổi học.", status: 404 },
  SESSION_CANCELLED: {
    message: "Buổi học đã bị hủy nên không thể chốt.",
    status: 409,
  },
  ADMIN_SESSION_NOT_FINISHED: {
    message: "Chỉ có thể chốt điểm danh sau giờ kết thúc theo lịch.",
    status: 409,
  },
  INVALID_YOUTUBE_URL: {
    message: "Đường dẫn video YouTube không hợp lệ.",
    status: 400,
  },
  DUPLICATE_STUDENT: {
    message: "Danh sách học sinh có học sinh bị trùng.",
    status: 400,
  },
  SESSION_ROSTER_MISMATCH: {
    message:
      "Danh sách học sinh đã thay đổi. Hãy tải lại buổi học trước khi chốt.",
    status: 409,
  },
  ADMIN_SESSION_TEACHER_REQUIRED: {
    message:
      "Buổi học cần có ít nhất một giáo viên được phân công trước khi chốt.",
    status: 400,
  },
  DUPLICATE_TEACHER_DECISION: {
    message: "Quyết định chấm công có giáo viên bị trùng.",
    status: 400,
  },
  SESSION_TEACHER_DECISION_REQUIRED: {
    message:
      "Hãy chọn quyết định chấm công cho đúng từng giáo viên của buổi học.",
    status: 400,
  },
  ATTENDANCE_STATUS_REQUIRED: {
    message: "Hãy chọn trạng thái điểm danh cho từng học sinh.",
    status: 400,
  },
  INVALID_LATE_MINUTES: {
    message: "Số phút đi muộn không hợp lệ.",
    status: 400,
  },
  INVALID_HOMEWORK_SCORE: {
    message: "Điểm bài tập phải nằm trong khoảng 0 đến 10.",
    status: 400,
  },
  INVALID_UNDERSTANDING_SCORE: {
    message: "Điểm hiểu bài phải nằm trong khoảng 1 đến 5.",
    status: 400,
  },
  INVALID_ATTITUDE_SCORE: {
    message: "Điểm thái độ phải nằm trong khoảng 1 đến 5.",
    status: 400,
  },
  INVALID_FEEDBACK_COUNT: {
    message: "Số lượt động viên không hợp lệ.",
    status: 400,
  },
  INVALID_COMMENT: {
    message: "Nhận xét không được vượt quá 2.000 ký tự.",
    status: 400,
  },
};

function codedError(code: string): CodedError {
  const error = new Error(code) as CodedError;
  error.code = code;
  return error;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null ||
    (typeof value === "number" && Number.isFinite(value));
}

function isStudentAttendance(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.student_id !== "string" || !UUID_PATTERN.test(row.student_id)
  ) return false;
  if (typeof row.status !== "string" || !ATTENDANCE_STATUSES.has(row.status)) {
    return false;
  }
  for (
    const key of [
      "late_minutes",
      "homework_score",
      "understanding_score",
      "attitude_score",
      "positive_feedback_count",
    ]
  ) {
    if (!isNullableNumber(row[key])) return false;
  }
  for (
    const key of [
      "absence_reason",
      "homework_note",
      "positive_feedback_raw",
      "comment",
    ]
  ) {
    if (!isNullableString(row[key])) return false;
  }
  const late = row.late_minutes as number | null | undefined;
  const homework = row.homework_score as number | null | undefined;
  const understanding = row.understanding_score as number | null | undefined;
  const attitude = row.attitude_score as number | null | undefined;
  const feedback = row.positive_feedback_count as number | null | undefined;
  const comment = row.comment as string | null | undefined;
  return (late == null || Number.isSafeInteger(late) && late >= 0) &&
    (homework == null || homework >= 0 && homework <= 10) &&
    (understanding == null ||
      Number.isSafeInteger(understanding) && understanding >= 1 &&
        understanding <= 5) &&
    (attitude == null ||
      Number.isSafeInteger(attitude) && attitude >= 1 && attitude <= 5) &&
    (feedback == null || Number.isSafeInteger(feedback) && feedback >= 0) &&
    (comment == null || comment.length <= 2000);
}

export function isFinalizeSessionInput(
  value: unknown,
): value is FinalizeSessionInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<FinalizeSessionInput>;
  if (
    typeof input.session_id !== "string" || !UUID_PATTERN.test(input.session_id)
  ) return false;
  if (
    !isNullableString(input.session_note) ||
    (input.session_note?.length ?? 0) > 10000
  ) return false;
  if (!isNullableString(input.lesson_youtube_url)) return false;
  if (
    !Array.isArray(input.students) || !input.students.every(isStudentAttendance)
  ) return false;
  if (!Array.isArray(input.teacher_decisions)) return false;
  return input.teacher_decisions.every((value) => {
    if (!value || typeof value !== "object") return false;
    const decision = value as unknown as Record<string, unknown>;
    return typeof decision.staff_id === "string" &&
      UUID_PATTERN.test(decision.staff_id) &&
      typeof decision.eligible === "boolean";
  });
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { code?: unknown; message?: unknown };
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  if (PUBLIC_ERRORS[code]) return code;
  if (PUBLIC_ERRORS[message]) return message;
  return null;
}

export function createSessionAttendanceFinalizeHandler(
  dependencies: SessionAttendanceFinalizeDependencies,
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
      ) throw codedError("FORBIDDEN");

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw codedError("INVALID_INPUT");
      }
      if (!isFinalizeSessionInput(body)) throw codedError("INVALID_INPUT");

      const result = await dependencies.getStore().finalize(
        body,
        caller.user.id,
      );
      return ok(result);
    } catch (error) {
      const code = errorCode(error);
      if (code) {
        const { message, status } = PUBLIC_ERRORS[code];
        return fail(code, message, status);
      }
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        return fail(
          "UNAUTHENTICATED",
          "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
          401,
        );
      }
      return fromError(error, undefined, {
        stage: "admin_session_attendance_finalize",
      });
    }
  };
}
