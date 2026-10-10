import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  classifyStudentIntakeRows,
  downloadStudentIntakeTemplate,
  normalizeStudentName,
  normalizeStudentPhone,
  parseStudentIntakeWorkbook,
  STUDENT_INTAKE_HEADERS,
  type StudentIntakeRow,
} from './student-intake'

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>()
  return { ...actual, writeFileXLSX: vi.fn() }
})

function row(overrides: Partial<StudentIntakeRow> = {}): StudentIntakeRow {
  return {
    row_number: 2,
    full_name: 'QA Nguyễn Minh An',
    student_code: '',
    phone: '',
    parent_name: '',
    parent_phone: '',
    ...overrides,
  }
}

function fileWithArrayBuffer(bytes: ArrayBuffer, name: string): File {
  const file = new File([bytes], name)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes })
  return file
}

describe('student intake workbook', () => {
  afterEach(() => vi.mocked(XLSX.writeFileXLSX).mockReset())

  it('downloads a text formatted template with instructions and the supported columns', async () => {
    await downloadStudentIntakeTemplate()

    expect(XLSX.writeFileXLSX).toHaveBeenCalledTimes(1)
    const [workbook, filename] = vi.mocked(XLSX.writeFileXLSX).mock.calls[0]
    expect(filename).toBe('bieu-mau-nhap-hoc.xlsx')
    expect(workbook.SheetNames).toEqual(['Nhập học', 'Hướng dẫn'])
    const sheet = workbook.Sheets['Nhập học']
    expect(['A1', 'B1', 'C1', 'D1', 'E1'].map((cell) => sheet[cell]?.v)).toEqual([...STUDENT_INTAKE_HEADERS])
    expect(sheet.C2).toMatchObject({ t: 's', v: '', z: '@' })
    expect(sheet.E101).toMatchObject({ t: 's', v: '', z: '@' })
    expect(workbook.Sheets['Hướng dẫn'].B7?.v).toContain('Không nhập tên đăng nhập hoặc mật khẩu')
  })

  it('parses the first worksheet using the template headers and preserves text identifiers', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      [...STUDENT_INTAKE_HEADERS],
      ['QA Học sinh', 'QA-001', '0123456789', 'QA Phụ huynh', '0987654321'],
      ['', '', '', '', ''],
      ['', 'QA-002', '', '', ''],
    ]), 'Nhập học')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const file = fileWithArrayBuffer(bytes, 'QA-nhap-hoc.xlsx')

    await expect(parseStudentIntakeWorkbook(file)).resolves.toEqual([
      { row_number: 2, full_name: 'QA Học sinh', student_code: 'QA-001', phone: '0123456789', parent_name: 'QA Phụ huynh', parent_phone: '0987654321' },
      { row_number: 4, full_name: '', student_code: 'QA-002', phone: '', parent_name: '', parent_phone: '' },
    ])
  })

  it('rejects the wrong file type, wrong headers, and more than 100 populated rows', async () => {
    await expect(parseStudentIntakeWorkbook(new File(['x'], 'QA.csv'))).rejects.toThrow('.xlsx')

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Tên', 'Mã']]), 'Nhập học')
    const invalidHeaders = fileWithArrayBuffer(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), 'QA-invalid.xlsx')
    await expect(parseStudentIntakeWorkbook(invalidHeaders)).rejects.toThrow('giữ nguyên hàng tiêu đề')

    const largeWorkbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(largeWorkbook, XLSX.utils.aoa_to_sheet([
      [...STUDENT_INTAKE_HEADERS],
      ...Array.from({ length: 101 }, (_, index) => [`QA Học sinh ${index + 1}`, '', '', '', '']),
    ]), 'Nhập học')
    const oversized = fileWithArrayBuffer(XLSX.write(largeWorkbook, { type: 'array', bookType: 'xlsx' }), 'QA-large.xlsx')
    await expect(parseStudentIntakeWorkbook(oversized)).rejects.toThrow('tối đa 100 dòng')
  })
})

describe('student intake duplicate preview', () => {
  const existing = [
    { id: 'qa-existing-1', student_code: 'QA-001', full_name: 'Nguyễn Thị An', phone: '0912345678' },
  ]

  it('skips normalized code and Vietnamese phone duplicates, and asks before creating a same-name student', () => {
    const preview = classifyStudentIntakeRows([
      row({ row_number: 2, full_name: 'QA Học sinh trùng mã', student_code: ' qa-001 ' }),
      row({ row_number: 3, full_name: 'QA Học sinh trùng SĐT', student_code: 'QA-002', phone: '+84 912 345 678' }),
      row({ row_number: 4, full_name: 'Nguyen Thi An', student_code: 'QA-003', phone: '' }),
      row({ row_number: 5, full_name: '' }),
    ], existing)

    expect(preview.map((item) => item.status)).toEqual(['DUPLICATE', 'DUPLICATE', 'REVIEW_NAME', 'INVALID'])
    expect(preview[2].keep_same_name).toBe(false)
    expect(preview[0].message).toContain('Mã học sinh')
    expect(preview[1].message).toContain('Số điện thoại')
  })

  it('skips repeated identifiers inside one workbook and flags normalized repeated names', () => {
    const preview = classifyStudentIntakeRows([
      row({ row_number: 2, full_name: 'QA Học sinh mới', student_code: 'qa-010', phone: '0911222333' }),
      row({ row_number: 3, full_name: 'QA Học sinh mới', student_code: 'QA-010', phone: '0911222333' }),
      row({ row_number: 4, full_name: 'QA Học sinh moi', student_code: 'QA-011', phone: '0911222334' }),
    ], [])

    expect(preview.map((item) => item.status)).toEqual(['READY', 'DUPLICATE', 'REVIEW_NAME'])
    expect(preview[2].message).toContain('dòng 2')
    expect(normalizeStudentPhone('+84 (911) 222 333')).toBe('0911222333')
    expect(normalizeStudentName('  Nguyễn   Thị Ánh ')).toBe('nguyen thi anh')
  })
})
