import type { AttendanceStatus } from '@/shared/types/domain'

export interface AttendanceValue {
  status: AttendanceStatus | null
  late_minutes: number | null
  absence_reason: string
  homework_score: number | null
  homework_note: string
  understanding_score: number | null
  attitude_score: number | null
  positive_feedback_count: number | null
  positive_feedback_raw: string
  comment: string
}

export interface AttendanceStudentRow {
  student_id: string
  students?: { full_name?: string; student_code?: string } | null
  attendance: AttendanceValue
  initialAttendance: AttendanceValue
}

export interface AttendanceSaveInput {
  student_id: string
  status: AttendanceStatus
  late_minutes: number | null
  absence_reason: string | null
  homework_score: number | null
  homework_note: string | null
  understanding_score: number | null
  attitude_score: number | null
  positive_feedback_count: number | null
  positive_feedback_raw: string | null
  comment: string | null
}

const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Có mặt',
  LATE: 'Đi muộn',
  ABSENT: 'Vắng mặt',
  EXCUSED: 'Vắng có phép',
}

export const attendanceStatuses: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']

export function attendanceStatusLabel(status: AttendanceStatus | null | undefined) {
  return status ? statusLabels[status] : 'Chưa điểm danh'
}

export function createAttendanceValue(source: Record<string, unknown> = {}): AttendanceValue {
  const numberOrNull = (value: unknown) => value === null || value === undefined || value === '' ? null : Number(value)
  return {
    status: (source.status as AttendanceStatus | null) || null,
    late_minutes: numberOrNull(source.late_minutes),
    absence_reason: String(source.absence_reason || ''),
    homework_score: numberOrNull(source.homework_score),
    homework_note: String(source.homework_note || ''),
    understanding_score: numberOrNull(source.understanding_score),
    attitude_score: numberOrNull(source.attitude_score),
    positive_feedback_count: numberOrNull(source.positive_feedback_count),
    positive_feedback_raw: String(source.positive_feedback_raw || ''),
    comment: String(source.comment || ''),
  }
}

export function attendanceIsDirty(row: AttendanceStudentRow) {
  return JSON.stringify(createAttendanceValue(row.attendance as unknown as Record<string, unknown>)) !==
    JSON.stringify(createAttendanceValue(row.initialAttendance as unknown as Record<string, unknown>))
}

export function attendanceValidationError(value: AttendanceValue): string | null {
  if (!value.status) return 'Chọn trạng thái điểm danh.'
  if (value.status === 'LATE' && value.late_minutes !== null && value.late_minutes < 0) {
    return 'Số phút đi muộn không được âm.'
  }
  if (value.homework_score !== null && (value.homework_score < 0 || value.homework_score > 10)) {
    return 'Điểm bài tập phải từ 0 đến 10.'
  }
  if (value.understanding_score !== null && (value.understanding_score < 1 || value.understanding_score > 5)) {
    return 'Mức hiểu bài phải từ 1 đến 5.'
  }
  if (value.attitude_score !== null && (value.attitude_score < 1 || value.attitude_score > 5)) {
    return 'Thái độ phải từ 1 đến 5.'
  }
  if (value.positive_feedback_count !== null && value.positive_feedback_count < 0) {
    return 'Điểm cộng không được âm.'
  }
  return null
}

export function toAttendanceSaveInput(row: AttendanceStudentRow): AttendanceSaveInput {
  const value = createAttendanceValue(row.attendance as unknown as Record<string, unknown>)
  if (!value.status) throw new Error('ATTENDANCE_STATUS_REQUIRED')
  return {
    student_id: row.student_id,
    status: value.status,
    late_minutes: value.status === 'LATE' ? value.late_minutes : null,
    absence_reason: ['ABSENT', 'EXCUSED'].includes(value.status) ? value.absence_reason.trim() || null : null,
    homework_score: value.homework_score,
    homework_note: value.homework_note.trim() || null,
    understanding_score: value.understanding_score,
    attitude_score: value.attitude_score,
    positive_feedback_count: value.positive_feedback_count,
    positive_feedback_raw: value.positive_feedback_raw.trim() || null,
    comment: value.comment.trim() || null,
  }
}
