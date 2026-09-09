import { corsHeaders } from './cors.ts'

export interface AppError extends Error {
  code?: string
}

export function traceId(): string {
  return crypto.randomUUID()
}

export function appError(code: string, message = code): AppError {
  const error = new Error(message) as AppError
  error.code = code
  return error
}

export function ok<T>(data: T, id = traceId()): Response {
  return new Response(JSON.stringify({ success: true, data, trace_id: id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function fail(code: string, message: string, status = 400, id = traceId()): Response {
  return new Response(JSON.stringify({ success: false, error: { code, message }, trace_id: id }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface ErrorContext {
  stage?: string
  role?: string
}

interface ErrorLike {
  code?: unknown
  message?: unknown
  details?: unknown
  status?: unknown
}

const knownCodes = [
  'FORBIDDEN',
  'SESSION_NOT_COMPLETEABLE',
  'SESSION_NOT_FOUND',
  'SESSION_NOT_IN_PROGRESS',
  'SESSION_TEACHER_REQUIRED',
  'CLASS_MONTH_NOT_FOUND',
  'CLASS_MONTH_NOT_DRAFT',
  'CLASS_MONTH_NO_SCHEDULE',
  'CLASS_MONTH_NO_STUDENTS',
  'SCHEDULE_CONFLICT',
  'TUITION_NOT_FOUND',
  'TUITION_ALREADY_PAID',
  'PAYROLL_NOT_FOUND',
  'PAYROLL_NOT_CONFIRMED',
  'PAYROLL_LOCKED',
  'INVALID_PAYROLL_PERIOD',
  'INVALID_SALARY_ADJUSTMENT',
  'STAFF_NOT_FOUND',
  'ACCOUNT_NOT_FOUND',
  'CANNOT_LOCK_SELF',
  'ACCOUNTING_CATEGORY_MISMATCH',
  'INVALID_TRANSACTION',
  'ADMIN_ACCOUNT_NOT_FOUND',
  'STUDENT_CODE_GENERATION_FAILED',
  'USERNAME_GENERATION_FAILED',
  'INVALID_INPUT',
  'INVALID_EMAIL',
  'USERNAME_ALREADY_EXISTS',
  'EMAIL_ALREADY_EXISTS',
  'PHONE_ALREADY_EXISTS',
  'STAFF_CODE_ALREADY_EXISTS',
  'STUDENT_CODE_ALREADY_EXISTS',
  'AUTH_CREATE_FAILED',
  'PROFILE_CREATE_FAILED',
  'STAFF_CREATE_FAILED',
  'STUDENT_CREATE_FAILED',
  'AUDIT_WRITE_FAILED',
  'ACCOUNT_ROLLBACK_FAILED',
]

const publicMessages: Record<string, string> = {
  INVALID_INPUT: 'Dữ liệu tạo tài khoản không hợp lệ.',
  INVALID_EMAIL: 'Email không hợp lệ.',
  USERNAME_ALREADY_EXISTS: 'Username đã tồn tại.',
  EMAIL_ALREADY_EXISTS: 'Email đã được sử dụng.',
  PHONE_ALREADY_EXISTS: 'Số điện thoại đã được sử dụng.',
  STAFF_CODE_ALREADY_EXISTS: 'Mã nhân sự đã tồn tại.',
  STUDENT_CODE_ALREADY_EXISTS: 'Mã học sinh đã tồn tại.',
  AUTH_CREATE_FAILED: 'Không thể tạo tài khoản đăng nhập.',
  PROFILE_CREATE_FAILED: 'Không thể tạo hồ sơ tài khoản.',
  STAFF_CREATE_FAILED: 'Không thể tạo hồ sơ nhân sự.',
  STUDENT_CREATE_FAILED: 'Không thể tạo hồ sơ học sinh.',
  AUDIT_WRITE_FAILED: 'Không thể ghi nhật ký thao tác.',
  ACCOUNT_ROLLBACK_FAILED: 'Tạo tài khoản thất bại và cần được kiểm tra để hoàn tất khôi phục dữ liệu.',
}

function asErrorLike(error: unknown): ErrorLike {
  return error && typeof error === 'object' ? error as ErrorLike : {}
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function classifyDatabaseConflict(errorText: string): string | null {
  if (!errorText.includes('23505') && !errorText.includes('duplicate') && !errorText.includes('unique')) return null
  if (errorText.includes('profiles_username_lower_uidx') || errorText.includes('profiles_user_id_key') || errorText.includes('(username)')) return 'USERNAME_ALREADY_EXISTS'
  if (errorText.includes('profiles_email_lower_uidx') || errorText.includes('(email)')) return 'EMAIL_ALREADY_EXISTS'
  if (errorText.includes('profiles_phone_uidx') || errorText.includes('(phone)')) return 'PHONE_ALREADY_EXISTS'
  if (errorText.includes('staff_staff_code_key') || errorText.includes('(staff_code)')) return 'STAFF_CODE_ALREADY_EXISTS'
  if (errorText.includes('students_student_code_key')) return 'STUDENT_CODE_ALREADY_EXISTS'
  return null
}

function classifyError(error: unknown, context: ErrorContext): { code: string; message: string; rawCode: string; status: number } {
  const value = asErrorLike(error)
  const message = error instanceof Error ? error.message : textValue(value.message) || 'Đã xảy ra lỗi không xác định'
  const explicitCode = textValue(value.code)
  const status = typeof value.status === 'number' ? value.status : 0
  const combined = `${explicitCode} ${message} ${textValue(value.details)}`.toLowerCase()

  if (knownCodes.includes(explicitCode)) return { code: explicitCode, message, rawCode: explicitCode, status }
  if (knownCodes.includes(message)) return { code: message, message, rawCode: explicitCode || message, status }

  const conflictCode = classifyDatabaseConflict(combined)
  if (conflictCode) return { code: conflictCode, message, rawCode: explicitCode, status }

  if (combined.includes('already registered') || combined.includes('already been registered') || combined.includes('email_exists')) {
    return { code: 'EMAIL_ALREADY_EXISTS', message, rawCode: explicitCode, status }
  }
  if (context.stage === 'auth.create') return { code: 'AUTH_CREATE_FAILED', message, rawCode: explicitCode, status }
  if (context.stage === 'profiles.insert') return { code: 'PROFILE_CREATE_FAILED', message, rawCode: explicitCode, status }
  if (context.stage === 'staff.insert') return { code: 'STAFF_CREATE_FAILED', message, rawCode: explicitCode, status }
  if (context.stage === 'students.insert') return { code: 'STUDENT_CREATE_FAILED', message, rawCode: explicitCode, status }
  if (context.stage === 'audit.write') return { code: 'AUDIT_WRITE_FAILED', message, rawCode: explicitCode, status }
  return { code: 'INTERNAL_ERROR', message, rawCode: explicitCode, status }
}

export function fromError(error: unknown, id = traceId(), context: ErrorContext = {}): Response {
  const classified = classifyError(error, context)
  console.error(JSON.stringify({
    event: 'edge_function_error',
    trace_id: id,
    stage: context.stage || 'unknown',
    role: context.role || 'unknown',
    code: classified.code,
    source_code: classified.rawCode || undefined,
    status: classified.status || undefined,
    message: classified.message,
  }))
  const status = classified.code === 'FORBIDDEN' ? 403 : classified.code === 'INTERNAL_ERROR' || classified.code === 'ACCOUNT_ROLLBACK_FAILED' ? 500 : 400
  return fail(classified.code, publicMessages[classified.code] || (knownCodes.includes(classified.code) ? classified.message : 'Không thể hoàn thành yêu cầu'), status, id)
}
