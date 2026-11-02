import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import type { SessionRow } from '@/shared/types/domain'
import { createAttendanceValue, type AttendanceStudentRow } from './attendance'
import { buildSessionAttendanceWorkbook, parseSessionAttendanceWorkbook } from './session-attendance-excel'

const session: SessionRow = {
  id: 'qa-session-001',
  class_id: 'qa-class-001',
  recurrence_schedule_id: null,
  recurrence_occurrence_date: null,
  scheduled_start_at: '2026-11-02T10:00:00+07:00',
  scheduled_end_at: '2026-11-02T12:00:00+07:00',
  status: 'IN_PROGRESS',
  session_note: null,
  classes: { id: 'qa-class-001', code: 'QA-CLASS-01', name: 'QA Lớp Toán', subjects: { name: 'Toán' }, grades: { name: '8' } },
  class_schedules: { room: 'QA-01' },
  session_staff: [{ staff_id: 'qa-teacher-001', assignment_role: 'TEACHER', staff: { id: 'qa-teacher-001', full_name: 'QA Giáo viên' } }],
}

function student(id: string, code: string, name: string, source: Record<string, unknown> = {}): AttendanceStudentRow {
  const attendance = createAttendanceValue(source)
  return {
    student_id: id,
    students: { student_code: code, full_name: name },
    attendance,
    initialAttendance: { ...attendance },
  }
}

const rows = [
  student('qa-student-001', 'QA-ST-01', 'QA Học sinh Một', {
    status: 'PRESENT', homework_score: 8, comment: 'QA nhận xét cũ',
  }),
  student('qa-student-002', 'QA-ST-02', 'QA Học sinh Hai'),
]

async function templateWorkbook() {
  const { workbook } = await buildSessionAttendanceWorkbook(session, rows)
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return XLSX.read(bytes, { type: 'array', cellDates: false })
}

function workbookFile(workbook: XLSX.WorkBook, name = 'QA-diem-danh.xlsx') {
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const file = new File([bytes], name)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes })
  return file
}

describe('session attendance Excel', () => {
  it('creates a session-specific workbook with the full roster and display information', async () => {
    const { workbook, filename } = await buildSessionAttendanceWorkbook(session, rows)
    expect(filename).toBe('diem-danh-qa-class-01-2026-11-02.xlsx')
    const info = workbook.Sheets['Thông tin buổi']
    const attendance = workbook.Sheets['Điểm danh']
    expect(info?.B2?.v).toContain('QA-CLASS-01')
    expect(info?.B6?.v).toContain('QA Giáo viên')
    expect(attendance?.A1?.v).toBe('__student_id')
    expect(attendance?.B2?.v).toBe('QA-ST-01')
    expect(attendance?.C3?.v).toBe('QA Học sinh Hai')
    expect(attendance?.['!cols']?.[0]).toMatchObject({ hidden: true })
  })

  it('parses updated fields by stable student id and keeps blank fields out of the patch', async () => {
    const workbook = await templateWorkbook()
    const sheet = workbook.Sheets['Điểm danh']!
    sheet.D2 = { t: 's', v: 'Đi muộn' }
    sheet.E2 = { t: 'n', v: 5 }
    sheet.G2 = { t: 'n', v: 8.5 }
    delete sheet.M2

    const result = await parseSessionAttendanceWorkbook(workbookFile(workbook), session, rows)

    expect(result.issues).toEqual([])
    expect(result.patches).toHaveLength(1)
    expect(result.patches[0]).toEqual({
      student_id: 'qa-student-001',
      patch: expect.objectContaining({ status: 'LATE', late_minutes: 5, homework_score: 8.5 }),
    })
    expect(result.patches[0].patch).not.toHaveProperty('comment')
  })

  it('rejects a template created for another session or an outdated roster', async () => {
    const workbook = await templateWorkbook()
    const otherSession = { ...session, id: 'qa-session-002' }
    await expect(parseSessionAttendanceWorkbook(workbookFile(workbook), otherSession, rows)).rejects.toThrow('buổi học khác')

    const changedRoster = [...rows, student('qa-student-003', 'QA-ST-03', 'QA Học sinh Ba')]
    await expect(parseSessionAttendanceWorkbook(workbookFile(workbook), session, changedRoster)).rejects.toThrow('Danh sách học sinh')
  })

  it('rejects changed headers and a file with a removed roster row', async () => {
    const changedHeader = await templateWorkbook()
    changedHeader.Sheets['Điểm danh']!.C1 = { t: 's', v: 'Tên khác' }
    await expect(parseSessionAttendanceWorkbook(workbookFile(changedHeader), session, rows)).rejects.toThrow('thứ tự cột')

    const missingStudent = await templateWorkbook()
    missingStudent.Sheets['Điểm danh']!['!ref'] = 'A1:M2'
    const result = await parseSessionAttendanceWorkbook(workbookFile(missingStudent), session, rows)
    expect(result.patches).toEqual([])
    expect(result.issues.some((issue) => issue.message.includes('thiếu học sinh trong roster'))).toBe(true)
  })

  it('rejects duplicate students and reports invalid values without returning patches', async () => {
    const duplicateWorkbook = await templateWorkbook()
    const duplicateSheet = duplicateWorkbook.Sheets['Điểm danh']!
    XLSX.utils.sheet_add_aoa(duplicateSheet, [XLSX.utils.sheet_to_json<unknown[]>(duplicateSheet, { header: 1, defval: '', raw: true })[1]], { origin: 'A4' })
    duplicateSheet['!ref'] = 'A1:M4'
    const duplicateResult = await parseSessionAttendanceWorkbook(workbookFile(duplicateWorkbook), session, rows)
    expect(duplicateResult.patches).toEqual([])
    expect(duplicateResult.issues.some((issue) => issue.message.includes('nhiều hơn một lần'))).toBe(true)

    const unknownWorkbook = await templateWorkbook()
    unknownWorkbook.Sheets['Điểm danh']!['A2'] = { t: 's', v: 'qa-student-unknown' }
    const unknownResult = await parseSessionAttendanceWorkbook(workbookFile(unknownWorkbook), session, rows)
    expect(unknownResult.patches).toEqual([])
    expect(unknownResult.issues.some((issue) => issue.message.includes('không thuộc roster'))).toBe(true)

    const invalidWorkbook = await templateWorkbook()
    const invalidSheet = invalidWorkbook.Sheets['Điểm danh']!
    invalidSheet.D2 = { t: 's', v: 'Không rõ' }
    invalidSheet.G2 = { t: 's', v: 'không phải số' }
    const invalidResult = await parseSessionAttendanceWorkbook(workbookFile(invalidWorkbook), session, rows)
    expect(invalidResult.patches).toEqual([])
    expect(invalidResult.issues.map((issue) => issue.message).join(' ')).toContain('Trạng thái không hợp lệ')
    expect(invalidResult.issues.map((issue) => issue.message).join(' ')).toContain('Điểm BTVN phải là số')
  })

  it('requires a status for a changed student that has not yet been marked', async () => {
    const workbook = await templateWorkbook()
    const sheet = workbook.Sheets['Điểm danh']!
    sheet.G3 = { t: 'n', v: 7 }

    const result = await parseSessionAttendanceWorkbook(workbookFile(workbook), session, rows)

    expect(result.patches).toEqual([])
    expect(result.issues.some((issue) => issue.message.includes('Cần chọn trạng thái'))).toBe(true)
  })
})
