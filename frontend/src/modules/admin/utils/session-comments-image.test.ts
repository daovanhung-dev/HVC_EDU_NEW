import { describe, expect, it } from 'vitest'
import { createAttendanceValue, type AttendanceStudentRow } from '@/modules/staff/attendance'
import { toSessionCommentsImageRows } from './session-comments-image'

function makeRow(overrides: Partial<AttendanceStudentRow> = {}): AttendanceStudentRow {
  const saved = createAttendanceValue({
    status: 'PRESENT',
    homework_score: 8,
    comment: 'Đã hoàn thành tốt bài tập.',
  })
  return {
    student_id: 'qa-student-1',
    students: { full_name: 'QA Học sinh Một' },
    attendance: { ...saved },
    initialAttendance: { ...saved },
    ...overrides,
  }
}

describe('session comments image rows', () => {
  it('exports the saved attendance values in the four report columns', () => {
    const saved = createAttendanceValue({ status: 'LATE', homework_score: 7.5, comment: 'Cần ôn lại phần chia phân số.' })
    const row = makeRow({
      attendance: createAttendanceValue({ status: 'ABSENT', homework_score: 3, comment: 'Chưa lưu nhận xét mới.' }),
      initialAttendance: saved,
    })

    expect(toSessionCommentsImageRows([row])).toEqual([{
      fullName: 'QA Học sinh Một',
      attendance: 'Đi muộn',
      homeworkScore: '7.5/10',
      comment: 'Cần ôn lại phần chia phân số.',
    }])
  })

  it('uses an em dash when exported values are missing', () => {
    const row = makeRow({
      students: { full_name: ' ' },
      initialAttendance: createAttendanceValue(),
    })

    expect(toSessionCommentsImageRows([row])).toEqual([{
      fullName: '—',
      attendance: '—',
      homeworkScore: '—',
      comment: '—',
    }])
  })
})
