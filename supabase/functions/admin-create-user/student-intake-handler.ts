export interface StudentIntakeCaller {
  user: { id: string }
  profile: { role: string }
}

export interface StudentIntakeCandidate {
  row_number: number
  student_code?: string
  full_name: string
  phone?: string
  parent_name?: string
  parent_phone?: string
}

export interface StudentIntakeExistingStudent {
  student_code: string | null
  full_name: string
  phone: string | null
}

export interface CreatedStudentAccount {
  student_code: string
  username: string
  temporary_password: string
}

export interface StudentIntakeDependencies {
  todayDate(): string
  hasPermission(userId: string, permission: 'STUDENTS_MANAGE' | 'CLASS_MANAGE'): Promise<boolean>
  isActiveClass(classId: string): Promise<boolean>
  getExistingStudents(): Promise<StudentIntakeExistingStudent[]>
  createStudent(input: StudentIntakeCandidate & { class_id: string; start_date: string }): Promise<CreatedStudentAccount>
}

export interface StudentIntakeBatchInput {
  operation: 'batch_student_intake'
  class_id: string
  start_date: string
  students: StudentIntakeCandidate[]
}

export type StudentIntakeRowResult =
  | ({ row_number: number; status: 'CREATED' } & CreatedStudentAccount)
  | { row_number: number; status: 'SKIPPED'; reason_code: 'STUDENT_CODE_ALREADY_EXISTS' | 'STUDENT_PHONE_ALREADY_EXISTS' }
  | { row_number: number; status: 'FAILED'; reason_code: string }

export type StudentIntakeBatchOutcome =
  | { ok: true; results: StudentIntakeRowResult[] }
  | { ok: false; status: 400 | 403; code: string; message: string }

const MAX_STUDENT_INTAKE_ROWS = 100
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

function normalizeCode(value: string | null | undefined): string {
  return (value || '').trim().toLocaleUpperCase('vi-VN')
}

function normalizePhone(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/gu, '')
  return digits.length === 11 && digits.startsWith('84') ? `0${digits.slice(2)}` : digits
}

function isDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function validCandidate(value: unknown): value is StudentIntakeCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return Number.isInteger(row.row_number) && (row.row_number as number) >= 2 &&
    typeof row.full_name === 'string' &&
    ['student_code', 'phone', 'parent_name', 'parent_phone'].every((key) => row[key] === undefined || typeof row[key] === 'string')
}

function isDuplicate(
  candidate: StudentIntakeCandidate,
  existing: StudentIntakeExistingStudent[],
): 'STUDENT_CODE_ALREADY_EXISTS' | 'STUDENT_PHONE_ALREADY_EXISTS' | null {
  const code = normalizeCode(candidate.student_code)
  const phone = normalizePhone(candidate.phone)
  if (code && existing.some((student) => normalizeCode(student.student_code) === code)) {
    return 'STUDENT_CODE_ALREADY_EXISTS'
  }
  if (phone && existing.some((student) => normalizePhone(student.phone) === phone)) {
    return 'STUDENT_PHONE_ALREADY_EXISTS'
  }
  return null
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
    const value = error as { code: string; message?: string; details?: string }
    if (value.code === '23505') {
      const combined = `${value.message || ''} ${value.details || ''}`.toLowerCase()
      if (combined.includes('students_student_code_key') || combined.includes('(student_code)')) return 'STUDENT_CODE_ALREADY_EXISTS'
      if (combined.includes('profiles_phone_uidx') || combined.includes('(phone)')) return 'PHONE_ALREADY_EXISTS'
    }
    return value.code
  }
  return 'STUDENT_CREATE_FAILED'
}

export async function processStudentIntakeBatch(
  caller: StudentIntakeCaller,
  input: unknown,
  dependencies: StudentIntakeDependencies,
): Promise<StudentIntakeBatchOutcome> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'Dữ liệu nhập học không hợp lệ.' }
  }
  const batch = input as Partial<StudentIntakeBatchInput>
  if (
    batch.operation !== 'batch_student_intake' ||
    typeof batch.class_id !== 'string' || !UUID_PATTERN.test(batch.class_id) ||
    typeof batch.start_date !== 'string' || !isDate(batch.start_date) ||
    !Array.isArray(batch.students) || batch.students.length === 0 ||
    batch.students.length > MAX_STUDENT_INTAKE_ROWS ||
    !batch.students.every(validCandidate)
  ) {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: `Biểu mẫu cần có từ 1 đến ${MAX_STUDENT_INTAKE_ROWS} dòng hợp lệ.` }
  }
  if (batch.start_date !== dependencies.todayDate()) {
    return { ok: false, status: 400, code: 'START_DATE_MUST_BE_TODAY', message: 'Ngày bắt đầu nhập học đã thay đổi. Hãy mở lại biểu mẫu để dùng ngày hôm nay.' }
  }
  if (new Set(batch.students.map((student) => student.row_number)).size !== batch.students.length) {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'Số dòng biểu mẫu bị lặp.' }
  }
  if (!['ROOT_ADMIN', 'ADMIN'].includes(caller.profile.role)) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Bạn không có quyền nhập học sinh.' }
  }

  if (caller.profile.role !== 'ROOT_ADMIN') {
    const canManageStudents = await dependencies.hasPermission(caller.user.id, 'STUDENTS_MANAGE')
    if (!canManageStudents) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Tài khoản chưa được cấp quyền quản lý học sinh.' }
    }
    const canManageClass = await dependencies.hasPermission(caller.user.id, 'CLASS_MANAGE')
    if (!canManageClass) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Tài khoản chưa được cấp quyền xếp học sinh vào lớp.' }
    }
  }

  if (!await dependencies.isActiveClass(batch.class_id)) {
    return { ok: false, status: 400, code: 'CLASS_NOT_ACTIVE', message: 'Lớp đã chọn không còn hoạt động.' }
  }

  let existingStudents = await dependencies.getExistingStudents()
  const createdInBatch: StudentIntakeExistingStudent[] = []
  const results: StudentIntakeRowResult[] = []

  for (const rawCandidate of batch.students) {
    const candidate: StudentIntakeCandidate = {
      row_number: rawCandidate.row_number,
      full_name: text(rawCandidate.full_name),
      student_code: text(rawCandidate.student_code),
      phone: text(rawCandidate.phone),
      parent_name: text(rawCandidate.parent_name),
      parent_phone: text(rawCandidate.parent_phone),
    }
    if (!candidate.full_name) {
      results.push({ row_number: candidate.row_number, status: 'FAILED', reason_code: 'INVALID_INPUT' })
      continue
    }

    const duplicate = isDuplicate(candidate, [...existingStudents, ...createdInBatch])
    if (duplicate) {
      results.push({ row_number: candidate.row_number, status: 'SKIPPED', reason_code: duplicate })
      continue
    }

    try {
      const created = await dependencies.createStudent({
        ...candidate,
        student_code: normalizeCode(candidate.student_code),
        phone: normalizePhone(candidate.phone),
        class_id: batch.class_id,
        start_date: batch.start_date,
      })
      createdInBatch.push({ student_code: created.student_code, full_name: candidate.full_name, phone: candidate.phone || null })
      results.push({ row_number: candidate.row_number, status: 'CREATED', ...created })
    } catch (error) {
      const code = errorCode(error)
      if (code === 'STUDENT_CODE_ALREADY_EXISTS' || code === 'PHONE_ALREADY_EXISTS') {
        existingStudents = await dependencies.getExistingStudents()
        const appearedDuplicate = isDuplicate(candidate, [...existingStudents, ...createdInBatch])
        if (appearedDuplicate) {
          results.push({ row_number: candidate.row_number, status: 'SKIPPED', reason_code: appearedDuplicate })
          continue
        }
      }
      results.push({
        row_number: candidate.row_number,
        status: 'FAILED',
        reason_code: ['USERNAME_ALREADY_EXISTS', 'EMAIL_ALREADY_EXISTS', 'PHONE_ALREADY_EXISTS', 'STUDENT_CODE_ALREADY_EXISTS'].includes(code)
          ? code
          : code === 'ACCOUNT_ROLLBACK_FAILED' ? 'ACCOUNT_ROLLBACK_FAILED' : 'STUDENT_CREATE_FAILED',
      })
    }
  }

  return { ok: true, results }
}
