import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadStudentLoginExport, studentLoginExportFilename } from './student-account-export'

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>()
  return { ...actual, writeFileXLSX: vi.fn() }
})

describe('student login workbook export', () => {
  afterEach(() => {
    vi.mocked(XLSX.writeFileXLSX).mockReset()
  })

  it('writes only the three requested columns as literal text and leaves missing emails blank', async () => {
    await downloadStudentLoginExport([{
      student_code: '=2+2',
      full_name: 'QA- Nguyễn Minh An',
      login_email: null,
    }])

    expect(XLSX.writeFileXLSX).toHaveBeenCalledTimes(1)
    const [workbook, filename] = vi.mocked(XLSX.writeFileXLSX).mock.calls[0]
    expect(filename).toMatch(/^tai-khoan-hoc-sinh-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(workbook.SheetNames).toEqual(['Tài khoản học sinh'])
    const sheet = workbook.Sheets['Tài khoản học sinh']
    expect(sheet.A1?.v).toBe('Mã học sinh')
    expect(sheet.B1?.v).toBe('Họ và tên')
    expect(sheet.C1?.v).toBe('Email đăng nhập')
    expect(sheet['!ref']).toBe('A1:C2')
    expect(sheet.A2).toMatchObject({ t: 's', v: '=2+2' })
    expect(sheet.A2?.f).toBeUndefined()
    expect(sheet.B2).toMatchObject({ t: 's', v: 'QA- Nguyễn Minh An' })
    expect(sheet.C2).toMatchObject({ t: 's', v: '' })
    expect(Object.keys(sheet).some((cell) => /^D\d/u.test(cell))).toBe(false)
  })

  it('uses the Vietnam date for the download filename', () => {
    expect(studentLoginExportFilename(new Date('2026-10-06T17:30:00.000Z')))
      .toBe('tai-khoan-hoc-sinh-2026-10-07.xlsx')
  })
})
