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
  INVALID_CREDENTIALS: 'Tài khoản hoặc mật khẩu không đúng.',
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
  TIMESHEET_NOT_PENDING: 'Yêu cầu chấm công này đã được xử lý.',
  REJECTION_REASON_REQUIRED: 'Nhập lý do trước khi từ chối chấm công.',
  SESSION_NOT_COMPLETED: 'Chỉ có thể gửi chấm công sau khi buổi học hoàn thành.',
  FEATURE_DISABLED: 'Chức năng này đã được ngừng sử dụng.',
  SESSION_LOCKED: 'Buổi học đã khóa và không thể chỉnh sửa ở vai trò này.',
  SESSION_DELETE_NOT_ALLOWED: 'Chỉ có thể xóa buổi học sắp tới đang ở trạng thái đã lên lịch.',
  SESSION_HAS_HISTORY: 'Buổi học đã có dữ liệu điểm danh, học tập hoặc chấm công nên không thể xóa. Hãy dùng thao tác hủy để giữ lịch sử.',
  SCHEDULE_CONFLICT: 'Không thể xếp lịch vì lớp hoặc học sinh đã có buổi học trùng giờ.',
  ROOM_REQUIRED_FOR_OVERLAP: 'Các buổi trùng giờ cần nhập phòng cho cả hai lớp trước khi lưu lịch.',
  ROOM_ALREADY_BOOKED: 'Phòng này đã có buổi học khác trong khung giờ được chọn.',
  INVALID_INPUT: 'Thời gian buổi học không hợp lệ. Hãy kiểm tra ngày, giờ bắt đầu và giờ kết thúc.',
  CLASS_NOT_ACTIVE: 'Chỉ có thể tạo lịch hiện tại hoặc tương lai cho lớp đang hoạt động.',
  CLASS_NOT_FOUND: 'Một lớp trong mẫu không còn tồn tại. Hãy tải lại danh sách lớp rồi thử lại.',
  DUPLICATE_TEACHER: 'Mỗi giáo viên chỉ được chọn một lần.',
  TEACHER_NOT_ACTIVE: 'Chỉ giáo viên đang hoạt động mới có thể được phân công.',
  NO_ACTIVE_STUDENTS: 'Lớp chưa có thành viên trong ngày đã chọn. Hãy kiểm tra danh sách thành viên và khoảng ngày tham gia của lớp.',
  EMPTY_TEMPLATE: 'Mẫu tuần chưa có buổi nào. Hãy thêm ít nhất một buổi trước khi lưu.',
  INVALID_TEMPLATE: 'Một buổi trong mẫu chưa hợp lệ. Hãy kiểm tra lớp, giáo viên và khung giờ.',
  DELETE_COUNT_MISMATCH: 'Dữ liệu lịch đã thay đổi nên không thể thay tháng. Lịch cũ được giữ nguyên; hãy tải lại và thử lại.',
  CLASS_TEACHER_LIMIT: 'Mỗi lớp được phân công tối đa 5 giáo viên đang hoạt động. Hãy gỡ một phân công trước khi thêm giáo viên mới.',
  ATTENDANCE_STATUS_REQUIRED: 'Mỗi học sinh cần có trạng thái điểm danh.',
  STUDENT_NOT_IN_SESSION: 'Học sinh không thuộc buổi học này.',
  STUDENT_NOT_IN_CLASS_ON_SESSION_DATE: 'Chỉ có thể chọn học sinh có membership hiệu lực trong lớp vào đúng ngày buổi học.',
  DUPLICATE_STUDENT: 'Danh sách có học sinh bị trùng. Hãy tải lại rồi thử lại.',
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
  const message = stringValue(error.message)
  const knownMessageCode = Object.keys(publicMessages).find((code) => message === code || message.startsWith(`${code}:`))
  if (knownMessageCode) return knownMessageCode

  const explicitCode = stringValue(error.code)
  if (explicitCode) return explicitCode
  return undefined
}

export function normalizeAppError(error: unknown, fallback = 'Không thể hoàn thành yêu cầu.'): NormalizedAppError {
  const value = asErrorLike(error)
  const code = detectCode(value)
  const status = numberValue(value.status)
  const traceId = stringValue(value.traceId) || stringValue(value.trace_id) || clientTraceId()

  let message = code ? publicMessages[code] : ''
  if (!message && !code && status === 401) message = publicMessages.UNAUTHENTICATED
  if (!message && !code && status === 403) message = publicMessages.FORBIDDEN
  if (!message && !code && status !== undefined && status >= 500) message = publicMessages.INTERNAL_ERROR
  if (!message) message = fallback

  return { message, code, traceId }
}

export function userErrorMessage(error: unknown, fallback: string): string {
  return normalizeAppError(error, fallback).message
}

const deleteRpcMessages: Record<string, string> = {
  '23503': 'Không thể xóa vì cơ sở dữ liệu còn phát hiện dữ liệu liên kết chưa được xử lý. Giao dịch đã được hoàn tác.',
  '42501': 'Tài khoản hiện không đủ quyền xóa buổi học trong tháng.',
  PGRST202: 'Máy chủ chưa nhận diện RPC xóa tháng. Hãy tải lại trang; nếu lỗi còn, gửi mã lỗi này để kiểm tra cấu hình backend.',
  PGRST203: 'Máy chủ đang nhận diện RPC xóa tháng không nhất quán. Hãy gửi mã lỗi này để kiểm tra cấu hình backend.',
  '40P01': 'Có xung đột đồng thời với thao tác lịch khác. Giao dịch xóa chưa hoàn tất; hãy tải lại lịch rồi thử lại.',
  '55P03': 'Lịch đang được cập nhật. Giao dịch xóa chưa hoàn tất; hãy tải lại lịch rồi thử lại.',
  '57014': 'Yêu cầu xóa bị máy chủ dừng trước khi hoàn tất. Hãy tải lại lịch để xác nhận trạng thái rồi thử lại.',
}

function safeDiagnosticCode(code: string): string | undefined {
  return /^[A-Z0-9]{5}$/.test(code) || /^PGRST\d{3}$/.test(code) ? code : undefined
}

/** Produces a safe, actionable message for a failed destructive database RPC. */
export function deleteRpcErrorMessage(error: unknown, fallback: string): string {
  const normalized = normalizeAppError(error, fallback)
  const code = normalized.code
  if (!code) {
    const status = asErrorLike(error).status
    const safeStatus = typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
      ? status
      : undefined
    return safeStatus ? `${normalized.message} (HTTP ${safeStatus}).` : normalized.message
  }

  if (normalized.message !== fallback && !safeDiagnosticCode(code)) return normalized.message

  let message = deleteRpcMessages[code]
  if (!message && code.startsWith('23')) {
    message = 'Cơ sở dữ liệu từ chối xóa do một ràng buộc dữ liệu. Giao dịch đã được hoàn tác.'
  } else if (!message && code.startsWith('40')) {
    message = 'Giao dịch xóa bị gián đoạn do xung đột đồng thời. Hãy tải lại lịch rồi thử lại.'
  } else if (!message && code.startsWith('PGRST')) {
    message = 'API chưa hoàn tất yêu cầu xóa lịch. Hãy tải lại trang; nếu lỗi còn, gửi mã lỗi này để kiểm tra backend.'
  } else if (!message && safeDiagnosticCode(code)) {
    message = fallback
  }

  if (!message) return normalized.message
  const diagnosticCode = safeDiagnosticCode(code)
  return diagnosticCode ? `${message} (mã lỗi ${diagnosticCode}).` : message
}
