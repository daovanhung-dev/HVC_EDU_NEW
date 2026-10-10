import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { MONTH_WEEKDAY_LABELS, MONTH_WEEK_SCHEDULE_HEADERS, parseMonthWeekScheduleWorkbook } from './month-week-schedule-import'

const classId = '00000000-0000-4000-8000-000000000001'
const teacherOne = '00000000-0000-4000-8000-000000000002'
const teacherTwo = '00000000-0000-4000-8000-000000000003'
const slotId = '00000000-0000-4000-8000-000000000004'

async function workbookFile(month: string, rows: unknown[][], name = 'QA-lich-thang.xlsx') {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [...MONTH_WEEK_SCHEDULE_HEADERS],
    ...rows,
  ]), 'Mẫu tuần')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Tháng áp dụng', month],
    ['Mục', 'Hướng dẫn'],
  ]), 'Hướng dẫn')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const buffer = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const file = new File([buffer], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => buffer })
  return file
}

const lookup = {
  classes: [{ id: classId, code: 'QA-TOAN-7', status: 'ACTIVE' }],
  teachers: [
    { id: teacherOne, staff_code: 'QA-T-001', status: 'ACTIVE', staff_type: 'TEACHER' },
    { id: teacherTwo, staff_code: 'QA-T-002', status: 'ACTIVE', staff_type: 'TEACHER' },
  ],
}

describe('month week schedule workbook', () => {
  it('reads the month and maps a row with multiple teachers to stable IDs', async () => {
    const file = await workbookFile('2026-10', [[slotId, 'Thứ Hai', 'qa-toan-7', '08:00', '09:30', 'A1', 'QA-T-001; QA-T-002']])
    const result = await parseMonthWeekScheduleWorkbook(file, '2026-10-01', lookup)

    expect(result.issues).toEqual([])
    expect(result.slots).toEqual([{
      source_row_number: 2,
      slot_id: slotId,
      day_of_week: 1,
      class_id: classId,
      start_time: '08:00',
      end_time: '09:30',
      room: 'A1',
      staff_ids: [teacherOne, teacherTwo],
      source_schedule_id: slotId,
    }])
  })

  it('accepts all seven weekdays, multiple classes, and multiple teachers', async () => {
    const classes = [
      { id: classId, code: 'QA-TOAN-7', status: 'ACTIVE' },
      { id: '00000000-0000-4000-8000-000000000005', code: 'QA-LY-8', status: 'ACTIVE' },
    ]
    const rows = MONTH_WEEKDAY_LABELS.map((weekday, index) => [
      `00000000-0000-4000-8000-00000000001${index}`,
      weekday,
      index % 2 ? 'QA-LY-8' : 'QA-TOAN-7',
      '08:00',
      '09:00',
      `QA-${index + 1}`,
      index === 0 ? 'QA-T-001; QA-T-002' : 'QA-T-001',
    ])
    const file = await workbookFile('2026-10', rows)
    const result = await parseMonthWeekScheduleWorkbook(file, '2026-10-01', { ...lookup, classes })

    expect(result.issues).toEqual([])
    expect(result.slots.map((slot) => slot.day_of_week)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(result.slots[0].staff_ids).toEqual([teacherOne, teacherTwo])
    expect(result.slots[1].class_id).toBe(classes[1].id)
  })

  it('rejects more than one hundred populated template rows', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => [
      `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
      'Thứ Hai', 'QA-TOAN-7', '08:00', '09:00', '', 'QA-T-001',
    ])
    const file = await workbookFile('2026-10', rows)

    await expect(parseMonthWeekScheduleWorkbook(file, '2026-10-01', lookup)).rejects.toThrow('tối đa 100 dòng')
  })

  it('creates a repeatable slot ID for a new row without a template ID', async () => {
    const row = ['', 7, 'QA-TOAN-7', '13:00', '14:00', '', 'QA-T-001']
    const first = await parseMonthWeekScheduleWorkbook(await workbookFile('2026-10', [row]), '2026-10-01', lookup)
    const second = await parseMonthWeekScheduleWorkbook(await workbookFile('2026-10', [row]), '2026-10-01', lookup)

    expect(first.slots[0].slot_id).toMatch(/^[0-9a-f-]{36}$/iu)
    expect(first.slots[0].slot_id).toBe(second.slots[0].slot_id)
    expect(first.slots[0].day_of_week).toBe(7)
  })

  it('reports row-level errors for unknown class, teacher, and invalid time', async () => {
    const file = await workbookFile('2026-10', [[slotId, 'Thứ Tư', 'QA-UNKNOWN', '09:00', '08:00', '', 'QA-NO-TEACHER']])
    const result = await parseMonthWeekScheduleWorkbook(file, '2026-10-01', lookup)

    expect(result.slots).toHaveLength(0)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({ row_number: 2 })
    expect(result.issues[0].message).toContain('Không tìm thấy lớp')
    expect(result.issues[0].message).toContain('Giờ kết thúc phải sau giờ bắt đầu')
    expect(result.issues[0].message).toContain('Không tìm thấy giáo viên')
  })

  it('rejects a workbook created for a different month', async () => {
    const file = await workbookFile('2026-09', [[slotId, 'Thứ Hai', 'QA-TOAN-7', '08:00', '09:00', '', 'QA-T-001']])
    await expect(parseMonthWeekScheduleWorkbook(file, '2026-10-01', lookup)).rejects.toThrow('Mẫu áp dụng cho 2026-09')
  })

  it('rejects unsupported workbook names', async () => {
    const file = await workbookFile('2026-10', [[slotId, 'Thứ Hai', 'QA-TOAN-7', '08:00', '09:00', '', 'QA-T-001']], 'QA-lich.csv')
    await expect(parseMonthWeekScheduleWorkbook(file, '2026-10-01', lookup)).rejects.toThrow('Chỉ nhận biểu mẫu Excel .xlsx')
  })
})
