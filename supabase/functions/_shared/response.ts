import { corsHeaders } from './cors.ts'

export function traceId(): string {
  return crypto.randomUUID()
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

export function fromError(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định'
  const known = ['FORBIDDEN', 'SESSION_NOT_COMPLETEABLE', 'SESSION_NOT_FOUND', 'SESSION_NOT_IN_PROGRESS', 'SESSION_TEACHER_REQUIRED', 'CLASS_MONTH_NOT_FOUND', 'CLASS_MONTH_NOT_DRAFT', 'CLASS_MONTH_NO_SCHEDULE', 'CLASS_MONTH_NO_STUDENTS', 'SCHEDULE_CONFLICT', 'TUITION_NOT_FOUND', 'TUITION_ALREADY_PAID', 'PAYROLL_NOT_FOUND', 'PAYROLL_NOT_CONFIRMED', 'PAYROLL_LOCKED', 'INVALID_PAYROLL_PERIOD', 'INVALID_SALARY_ADJUSTMENT', 'STAFF_NOT_FOUND', 'ACCOUNT_NOT_FOUND', 'CANNOT_LOCK_SELF', 'ACCOUNTING_CATEGORY_MISMATCH', 'INVALID_TRANSACTION', 'ADMIN_ACCOUNT_NOT_FOUND', 'STUDENT_CODE_GENERATION_FAILED', 'USERNAME_GENERATION_FAILED']
  const code = known.includes(message) ? message : 'INTERNAL_ERROR'
  const status = code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400
  return fail(code, code === 'INTERNAL_ERROR' ? 'Không thể hoàn thành yêu cầu' : message, status)
}
