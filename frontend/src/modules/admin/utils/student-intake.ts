export const MAX_STUDENT_INTAKE_ROWS = 100

export const STUDENT_INTAKE_HEADERS = [
  'Họ tên *',
  'Mã học sinh',
  'SĐT học sinh',
  'Tên phụ huynh',
  'SĐT phụ huynh',
] as const

export interface StudentIntakeRow {
  row_number: number
  full_name: string
  student_code: string
  phone: string
  parent_name: string
  parent_phone: string
}

export interface ExistingStudentIdentity {
  id: string
  student_code: string | null
  full_name: string
  phone: string | null
}

export type StudentIntakeRowStatus = 'READY' | 'DUPLICATE' | 'REVIEW_NAME' | 'INVALID'

export interface StudentIntakePreviewRow extends StudentIntakeRow {
  status: StudentIntakeRowStatus
  message: string
  matched_student?: ExistingStudentIdentity
  keep_same_name?: boolean
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim()
  return ''
}

export function normalizeStudentCode(value: string | null | undefined): string {
  return (value || '').trim().toLocaleUpperCase('vi-VN')
}

export function normalizeStudentPhone(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/gu, '')
  return digits.length === 11 && digits.startsWith('84') ? `0${digits.slice(2)}` : digits
}

export function normalizeStudentName(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/giu, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/gu, ' ')
    .trim()
}

export function classifyStudentIntakeRows(
  rows: StudentIntakeRow[],
  existingStudents: ExistingStudentIdentity[],
): StudentIntakePreviewRow[] {
  const existingByCode = new Map<string, ExistingStudentIdentity>()
  const existingByPhone = new Map<string, ExistingStudentIdentity>()
  const existingByName = new Map<string, ExistingStudentIdentity>()
  for (const student of existingStudents) {
    const code = normalizeStudentCode(student.student_code)
    const phone = normalizeStudentPhone(student.phone)
    const name = normalizeStudentName(student.full_name)
    if (code && !existingByCode.has(code)) existingByCode.set(code, student)
    if (phone && !existingByPhone.has(phone)) existingByPhone.set(phone, student)
    if (name && !existingByName.has(name)) existingByName.set(name, student)
  }

  const seenCodes = new Map<string, number>()
  const seenPhones = new Map<string, number>()
  const seenNames = new Map<string, number>()

  return rows.map((row) => {
    const normalized = { ...row, full_name: row.full_name.trim() }
    if (!normalized.full_name) {
      return { ...normalized, status: 'INVALID', message: 'Thiếu họ tên.' }
    }

    const code = normalizeStudentCode(normalized.student_code)
    const phone = normalizeStudentPhone(normalized.phone)
    const name = normalizeStudentName(normalized.full_name)
    const codeMatch = code ? existingByCode.get(code) : undefined
    const phoneMatch = phone ? existingByPhone.get(phone) : undefined
    const duplicateStudent = codeMatch || phoneMatch
    const repeatedCodeRow = code ? seenCodes.get(code) : undefined
    const repeatedPhoneRow = phone ? seenPhones.get(phone) : undefined
    const repeatedRow = repeatedCodeRow || repeatedPhoneRow
    if (duplicateStudent || repeatedRow) {
      const identifier = (codeMatch || repeatedCodeRow)
        ? 'Mã học sinh'
        : 'Số điện thoại'
      if (code) seenCodes.set(code, repeatedRow || normalized.row_number)
      if (phone) seenPhones.set(phone, repeatedRow || normalized.row_number)
      return {
        ...normalized,
        status: 'DUPLICATE',
        message: duplicateStudent
          ? `${identifier} đã có trong hệ thống; dòng này sẽ được bỏ qua.`
          : `${identifier} trùng dòng ${repeatedRow}; dòng này sẽ được bỏ qua.`,
        matched_student: duplicateStudent || undefined,
      }
    }

    const nameMatch = existingByName.get(name)
    const sameNameRow = seenNames.get(name)
    if (code) seenCodes.set(code, normalized.row_number)
    if (phone) seenPhones.set(phone, normalized.row_number)
    if (name && !sameNameRow) seenNames.set(name, normalized.row_number)

    if (nameMatch || sameNameRow) {
      return {
        ...normalized,
        status: 'REVIEW_NAME',
        keep_same_name: false,
        message: nameMatch
          ? `Trùng tên với mã ${nameMatch.student_code || 'chưa có mã'}; hãy xác nhận đây là học sinh khác.`
          : `Trùng tên ở dòng ${sameNameRow}; hãy xác nhận đây là học sinh khác.`,
        matched_student: nameMatch || undefined,
      }
    }

    return { ...normalized, status: 'READY', message: 'Sẵn sàng nhập.' }
  })
}

export async function parseStudentIntakeWorkbook(file: File): Promise<StudentIntakeRow[]> {
  if (!/\.xlsx$/iu.test(file.name)) throw new Error('Chỉ nhận biểu mẫu Excel .xlsx.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Tệp vượt quá giới hạn 10 MB.')

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Tệp không có trang tính.')
  const worksheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: false })
  const headers = (matrix[0] || []).map(text)
  const headerIndexes = STUDENT_INTAKE_HEADERS.map((header) => headers.indexOf(header))
  if (headerIndexes.some((index) => index < 0)) {
    throw new Error('Không nhận diện được tiêu đề cột. Hãy dùng mẫu nhập học và giữ nguyên hàng tiêu đề.')
  }

  const dataRows = matrix.slice(1).flatMap((cells, index) => {
    const values = headerIndexes.map((columnIndex) => text(cells[columnIndex]))
    if (values.every((value) => !value)) return []
    return [{
      row_number: index + 2,
      full_name: values[0],
      student_code: values[1],
      phone: values[2],
      parent_name: values[3],
      parent_phone: values[4],
    }]
  })

  if (dataRows.length > MAX_STUDENT_INTAKE_ROWS) {
    throw new Error(`Mỗi lần chỉ nhập tối đa ${MAX_STUDENT_INTAKE_ROWS} dòng có dữ liệu.`)
  }
  if (!dataRows.length) throw new Error('Biểu mẫu chưa có dòng học sinh nào.')
  return dataRows
}

export async function downloadStudentIntakeTemplate() {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const entrySheet = XLSX.utils.aoa_to_sheet([
    [...STUDENT_INTAKE_HEADERS],
    ...Array.from({ length: MAX_STUDENT_INTAKE_ROWS }, () => ['', '', '', '', '']),
  ])
  entrySheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 22 }]
  entrySheet['!autofilter'] = { ref: 'A1:E1' }
  for (let row = 1; row <= MAX_STUDENT_INTAKE_ROWS; row += 1) {
    for (let column = 0; column < STUDENT_INTAKE_HEADERS.length; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column })
      entrySheet[address] = { t: 's', v: '', z: '@' }
    }
  }
  XLSX.utils.book_append_sheet(workbook, entrySheet, 'Nhập học')

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Cột', 'Cách điền'],
    ['Họ tên *', 'Bắt buộc. Nhập họ tên học sinh.'],
    ['Mã học sinh', 'Không bắt buộc. Để trống để hệ thống tự tạo mã.'],
    ['SĐT học sinh', 'Không bắt buộc. Dùng để nhận diện hồ sơ trùng.'],
    ['Tên phụ huynh', 'Không bắt buộc.'],
    ['SĐT phụ huynh', 'Không bắt buộc.'],
    ['Lưu ý', 'Giữ nguyên tên và thứ tự các cột. Không nhập tên đăng nhập hoặc mật khẩu.'],
  ])
  instructions['!cols'] = [{ wch: 22 }, { wch: 76 }]
  XLSX.utils.book_append_sheet(workbook, instructions, 'Hướng dẫn')
  XLSX.writeFileXLSX(workbook, 'bieu-mau-nhap-hoc.xlsx')
}
