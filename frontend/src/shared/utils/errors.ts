export interface NormalizedAppError {
  message: string
  code?: string
  traceId: string
}

interface ErrorLike {
  code?: unknown
  message?: unknown
  status?: unknown
  traceId?: unknown
  trace_id?: unknown
}

const publicMessages: Record<string, string> = {
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  ACCOUNT_INACTIVE: 'Tài khoản hiện không hoạt động. Vui lòng liên hệ quản trị viên.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  STAFF_NOT_FOUND: 'Không tìm thấy hồ sơ nhân sự của tài khoản này.',
  SESSION_NOT_FOUND: 'Không tìm thấy buổi học.',
  SESSION_NOT_SCHEDULED: 'Buổi học không còn ở trạng thái có thể bắt đầu.',
  SESSION_NOT_IN_PROGRESS: 'Buổi học không còn ở trạng thái đang diễn ra.',
  SESSION_STAFF_REQUIRED: 'Bạn không được phân công cho buổi học này.',
  SESSION_TEACHER_REQUIRED: 'Chỉ giáo viên được phân công mới có thể hoàn thành buổi học.',
  SESSION_NOT_COMPLETEABLE: 'Chưa thể hoàn thành vì còn học sinh chưa có điểm danh.',
  TIMESHEET_NOT_FOUND: 'Không tìm thấy bản ghi chấm công.',
  TIMESHEET_ALREADY_SUBMITTED: 'Buổi học này đã được gửi chấm công.',
  SESSION_NOT_COMPLETED: 'Chỉ có thể gửi chấm công sau khi buổi học hoàn thành.',
  FEATURE_DISABLED: 'Chức năng này đã được ngừng sử dụng.',
  SESSION_LOCKED: 'Buổi học đã khóa và không thể chỉnh sửa ở vai trò này.',
  ATTENDANCE_STATUS_REQUIRED: 'Mỗi học sinh cần có trạng thái điểm danh.',
  STUDENT_NOT_IN_SESSION: 'Học sinh không thuộc buổi học này.',
  INVALID_HOMEWORK_SCORE: 'Điểm BTVN phải nằm trong khoảng 0–10.',
  INVALID_UNDERSTANDING_SCORE: 'Điểm hiểu bài phải nằm trong khoảng 1–5.',
  INVALID_ATTITUDE_SCORE: 'Điểm thái độ phải nằm trong khoảng 1–5.',
  INTERNAL_ERROR: 'Hệ thống gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.',
}

function asErrorLike(error: unknown): ErrorLike {
  return error && typeof error === 'object' ? error as ErrorLike : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function clientTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `client-${Date.now().toString(36)}`
}

function detectCode(error: ErrorLike): string | undefined {
  const explicitCode = stringValue(error.code)
  if (explicitCode) return explicitCode

  const message = stringValue(error.message)
  return Object.prototype.hasOwnProperty.call(publicMessages, message) ? message : undefined
}

export function normalizeAppError(error: unknown, fallback = 'Không thể hoàn thành yêu cầu.'): NormalizedAppError {
  const value = asErrorLike(error)
  const code = detectCode(value)
  const status = numberValue(value.status)
  const traceId = stringValue(value.traceId) || stringValue(value.trace_id) || clientTraceId()

  let message = code ? publicMessages[code] : ''
  if (!message && status === 401) message = publicMessages.UNAUTHENTICATED
  if (!message && status === 403) message = publicMessages.FORBIDDEN
  if (!message && status !== undefined && status >= 500) message = publicMessages.INTERNAL_ERROR
  if (!message) message = fallback

  return { message, code, traceId }
}

export function userErrorMessage(error: unknown, fallback: string): string {
  return normalizeAppError(error, fallback).message
}
