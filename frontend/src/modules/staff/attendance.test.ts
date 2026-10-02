import { describe, expect, it } from 'vitest'
import { attendanceIsDirty, attendanceStatusLabel, attendanceValidationError, createAttendanceValue, toAttendanceSaveInput, type AttendanceStudentRow } from './attendance'

const baseValue = createAttendanceValue({ status: 'PRESENT', homework_score: 0 })

describe('staff attendance helpers', () => {
  it('translates every attendance result to Vietnamese while preserving domain values', () => {
    expect(attendanceStatusLabel('PRESENT')).toBe('Có mặt')
    expect(attendanceStatusLabel('LATE')).toBe('Đi muộn')
    expect(attendanceStatusLabel('ABSENT')).toBe('Vắng mặt')
    expect(attendanceStatusLabel('EXCUSED')).toBe('Vắng có phép')
    expect(attendanceStatusLabel(null)).toBe('Chưa điểm danh')
  })

  it('tracks changes and keeps zero scores when preparing the saved row', () => {
    const row: AttendanceStudentRow = {
      student_id: 'qa-student-1',
      attendance: { ...baseValue, comment: 'Có tiến bộ.' },
      initialAttendance: { ...baseValue },
    }
    expect(attendanceIsDirty(row)).toBe(true)
    expect(toAttendanceSaveInput(row).homework_score).toBe(0)
    row.initialAttendance = { ...row.attendance }
    expect(attendanceIsDirty(row)).toBe(false)
  })

  it('validates required attendance and supported score ranges', () => {
    expect(attendanceValidationError(createAttendanceValue())).toBe('Chọn trạng thái điểm danh.')
    expect(attendanceValidationError(createAttendanceValue({ status: 'PRESENT', homework_score: 11 }))).toBe('Điểm bài tập phải từ 0 đến 10.')
    expect(attendanceValidationError(createAttendanceValue({ status: 'LATE', late_minutes: -1 }))).toBe('Số phút đi muộn không được âm.')
    expect(attendanceValidationError(createAttendanceValue({ status: 'PRESENT', understanding_score: 6 }))).toBe('Mức hiểu bài phải từ 1 đến 5.')
  })
})
