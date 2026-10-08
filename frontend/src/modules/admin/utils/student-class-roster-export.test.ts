import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClassRosterExportStudent } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import { downloadStudentClassRosterExport, studentClassRosterExportFilename } from './student-class-roster-export'

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>()
  return { ...actual, writeFileXLSX: vi.fn() }
})

const qaStudent: ClassRosterExportStudent = {
  id: 'qa-student-1',
  student_code: '=QA-001',
  full_name: 'QA- Nguyễn Minh An',
  phone: '0123456789',
  parent_name: 'QA- Phụ huynh',
  status: 'ACTIVE',
  created_at: '2026-10-06T17:30:00.000Z',
}

describe('student class roster workbook export', () => {
  afterEach(() => {
    vi.mocked(XLSX.writeFileXLSX).mockReset()
  })

  it('exports the student list columns as literal text', async () => {
    await downloadStudentClassRosterExport('QA-CLASS-8', [qaStudent])

    expect(XLSX.writeFileXLSX).toHaveBeenCalledTimes(1)
    const [workbook, filename] = vi.mocked(XLSX.writeFileXLSX).mock.calls[0]
    expect(filename).toMatch(/^danh-sach-hoc-sinh-QA-CLASS-8-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(workbook.SheetNames).toEqual(['Danh sách học sinh'])
    const sheet = workbook.Sheets['Danh sách học sinh']
    expect(['A1', 'B1', 'C1', 'D1', 'E1', 'F1'].map((cell) => sheet[cell]?.v)).toEqual([
      'Mã', 'Họ tên', 'SĐT', 'Phụ huynh', 'Trạng thái', 'Ngày tạo',
    ])
    expect(sheet['!ref']).toBe('A1:F2')
    expect(sheet.A2).toMatchObject({ t: 's', v: '=QA-001' })
    expect(sheet.A2?.f).toBeUndefined()
    expect(sheet.C2).toMatchObject({ t: 's', v: '0123456789' })
    expect(sheet.E2).toMatchObject({ t: 's', v: 'Đang hoạt động' })
    expect(sheet.F2).toMatchObject({ t: 's', v: formatDateTime(qaStudent.created_at) })
    expect(Object.keys(sheet).some((cell) => /^G\d/u.test(cell))).toBe(false)
  })

  it('uses the Vietnam date and sanitizes the class code in the filename', () => {
    expect(studentClassRosterExportFilename('QA/CLASS', new Date('2026-10-06T17:30:00.000Z')))
      .toBe('danh-sach-hoc-sinh-QA-CLASS-2026-10-07.xlsx')
  })
})
