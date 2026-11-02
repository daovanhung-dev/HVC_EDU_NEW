import type { SessionRow } from '@/shared/types/domain'
import { getBusinessDateKey, formatBusinessDate } from '@/shared/utils/session-calendar'
import {
  attendanceStatusLabel,
  attendanceValidationError,
  type AttendanceStudentRow,
  type AttendanceValue,
} from './attendance'

const TEMPLATE_MARKER = 'HVC_EDU_SESSION_ATTENDANCE'
const TEMPLATE_VERSION = 1
const MAX_FILE_SIZE = 10 * 1024 * 1024
const STUDENT_ID_HEADER = '__student_id'

export const SESSION_ATTENDANCE_HEADERS = [
  'Mã học sinh',
  'Họ và tên',
  'Trạng thái điểm danh',
  'Phút đi muộn',
  'Lý do vắng',
  'Điểm BTVN /10',
  'Ghi chú BTVN',
  'Hiểu bài /5',
  'Thái độ /5',
  'Điểm cộng',
  'Ghi nhận điểm cộng',
  'Nhận xét',
] as const

type AttendanceEditableKey = Exclude<keyof AttendanceValue, 'status'> | 'status'
export type AttendanceExcelPatch = Partial<Pick<AttendanceValue, AttendanceEditableKey>>

export interface AttendanceExcelIssue {
  row_number: number
  message: string
}

export interface AttendanceExcelPatchRow {
  student_id: string
  patch: AttendanceExcelPatch
}

export interface AttendanceExcelParseResult {
  patches: AttendanceExcelPatchRow[]
  issues: AttendanceExcelIssue[]
  roster_count: number
}

function cellText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function sortedRosterIds(rows: AttendanceStudentRow[]): string[] {
  return rows.map((row) => row.student_id).filter(Boolean).sort()
}

function safeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/giu, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'lop-hoc'
}

function statusLabel(status: AttendanceValue['status']): string {
  return status ? attendanceStatusLabel(status) : ''
}

export async function buildSessionAttendanceWorkbook(
  session: SessionRow,
  rows: AttendanceStudentRow[],
): Promise<{ workbook: import('xlsx').WorkBook; filename: string }> {
  if (!rows.length) throw new Error('Buổi học chưa có học sinh để tạo biểu mẫu.')

  const XLSX = await import('xlsx')
  const rosterIds = sortedRosterIds(rows)
  const teacherNames = (session.session_staff || [])
    .filter((item) => !item.assignment_role || item.assignment_role === 'TEACHER')
    .map((item) => item.staff?.full_name?.trim())
    .filter((name): name is string => Boolean(name))

  const informationSheet = XLSX.utils.aoa_to_sheet([
    ['Thông tin buổi học', '', '', 'template_marker', TEMPLATE_MARKER],
    ['Lớp', `${session.classes?.code ? `${session.classes.code} · ` : ''}${session.classes?.name || 'Chưa có tên lớp'}`, '', 'template_version', TEMPLATE_VERSION],
    ['Môn / khối', [session.classes?.subjects?.name, session.classes?.grades?.name].filter(Boolean).join(' · ') || '—', '', 'session_id', session.id],
    ['Ngày học', formatBusinessDate(getBusinessDateKey(session.scheduled_start_at)), '', 'class_id', session.class_id],
    ['Thời gian', `${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(session.scheduled_start_at))}–${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(session.scheduled_end_at))}`, '', 'business_date', getBusinessDateKey(session.scheduled_start_at)],
    ['Giáo viên', teacherNames.join(', ') || 'Chưa phân công', '', 'roster_ids', JSON.stringify(rosterIds)],
    ['Phòng', session.room || session.class_schedules?.room || '—'],
    [],
    ['Cách dùng', 'Chỉ dùng tệp này cho đúng buổi học ghi ở trên. Không đổi tên hoặc xóa học sinh trong cột ẩn.'],
    ['Trạng thái', 'Nhập một trong các giá trị: Có mặt, Đi muộn, Vắng mặt, Vắng có phép.'],
    ['Ô để trống', 'Giữ nguyên dữ liệu hiện có. Sau khi tải lên, hãy rà trên biểu mẫu và bấm lưu để xác nhận.'],
  ])
  informationSheet['!cols'] = [
    { wch: 18 },
    { wch: 64 },
    { wch: 4 },
    { wch: 20, hidden: true },
    { wch: 52, hidden: true },
  ]

  const attendanceSheet = XLSX.utils.aoa_to_sheet([
    [STUDENT_ID_HEADER, ...SESSION_ATTENDANCE_HEADERS],
    ...rows.map((row) => [
      row.student_id,
      row.students?.student_code || '',
      row.students?.full_name || '',
      statusLabel(row.attendance.status),
      row.attendance.late_minutes ?? '',
      row.attendance.absence_reason,
      row.attendance.homework_score ?? '',
      row.attendance.homework_note,
      row.attendance.understanding_score ?? '',
      row.attendance.attitude_score ?? '',
      row.attendance.positive_feedback_count ?? '',
      row.attendance.positive_feedback_raw,
      row.attendance.comment,
    ]),
  ])
  attendanceSheet['!cols'] = [
    { wch: 40, hidden: true },
    { wch: 20 },
    { wch: 32 },
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
    { wch: 32 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 32 },
    { wch: 48 },
  ]
  attendanceSheet['!autofilter'] = { ref: `B1:M${rows.length + 1}` }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, informationSheet, 'Thông tin buổi')
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Điểm danh')
  const classPart = safeFilenamePart(session.classes?.code || session.classes?.name || '')
  const datePart = getBusinessDateKey(session.scheduled_start_at)
  return { workbook, filename: `diem-danh-${classPart}-${datePart}.xlsx` }
}

export async function downloadSessionAttendanceTemplate(
  session: SessionRow,
  rows: AttendanceStudentRow[],
): Promise<void> {
  const XLSX = await import('xlsx')
  const { workbook, filename } = await buildSessionAttendanceWorkbook(session, rows)
  XLSX.writeFileXLSX(workbook, filename)
}

function normalizeStatus(value: unknown): AttendanceValue['status'] | null | undefined {
  const text = cellText(value)
  if (!text) return undefined
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/giu, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/gu, ' ')
    .trim()
  const statuses: Record<string, NonNullable<AttendanceValue['status']>> = {
    'co mat': 'PRESENT',
    present: 'PRESENT',
    'di muon': 'LATE',
    late: 'LATE',
    'vang mat': 'ABSENT',
    absent: 'ABSENT',
    'vang co phep': 'EXCUSED',
    excused: 'EXCUSED',
  }
  return statuses[normalized] || null
}

function parseNumber(value: unknown, rowNumber: number, label: string, issues: AttendanceExcelIssue[]): number | undefined {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return undefined
  const raw = typeof value === 'number' ? value : cellText(value).replace(',', '.')
  const parsed = typeof raw === 'number' ? raw : /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(raw) ? Number(raw) : Number.NaN
  if (!Number.isFinite(parsed)) {
    issues.push({ row_number: rowNumber, message: `${label} phải là số.` })
    return undefined
  }
  return parsed
}

function readMetadata(rows: unknown[][]): Map<string, unknown> {
  const metadata = new Map<string, unknown>()
  for (const row of rows) {
    const key = cellText(row[3])
    if (key) metadata.set(key, row[4])
  }
  return metadata
}

export async function parseSessionAttendanceWorkbook(
  file: File,
  session: SessionRow,
  currentRows: AttendanceStudentRow[],
): Promise<AttendanceExcelParseResult> {
  if (!/\.xlsx$/iu.test(file.name)) throw new Error('Chỉ nhận biểu mẫu Excel .xlsx.')
  if (file.size > MAX_FILE_SIZE) throw new Error('Tệp vượt quá giới hạn 10 MB.')
  if (!currentRows.length) throw new Error('Buổi học chưa có học sinh trong danh sách.')

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const infoSheet = workbook.Sheets['Thông tin buổi']
  const attendanceSheet = workbook.Sheets['Điểm danh']
  if (!infoSheet || !attendanceSheet) throw new Error('Tệp thiếu trang “Thông tin buổi” hoặc “Điểm danh”. Hãy tải lại mẫu từ đúng buổi học.')

  const metadata = readMetadata(XLSX.utils.sheet_to_json<unknown[]>(infoSheet, { header: 1, defval: '', raw: true }))
  if (metadata.get('template_marker') !== TEMPLATE_MARKER || Number(metadata.get('template_version')) !== TEMPLATE_VERSION) {
    throw new Error('Không nhận diện được mẫu điểm danh HVC_EDU. Hãy tải mẫu mới từ buổi học đang chọn.')
  }

  const expectedRosterIds = sortedRosterIds(currentRows)
  let templateRosterIds: string[]
  try {
    const value = metadata.get('roster_ids')
    templateRosterIds = JSON.parse(typeof value === 'string' ? value : '')
  } catch {
    throw new Error('Mẫu không có thông tin roster hợp lệ. Hãy tải lại mẫu từ đúng buổi học.')
  }
  if (metadata.get('session_id') !== session.id
      || metadata.get('class_id') !== session.class_id
      || metadata.get('business_date') !== getBusinessDateKey(session.scheduled_start_at)) {
    throw new Error('Tệp này thuộc buổi học khác. Hãy tải mẫu từ buổi đang chọn.')
  }
  if (!Array.isArray(templateRosterIds)
      || JSON.stringify([...templateRosterIds].sort()) !== JSON.stringify(expectedRosterIds)) {
    throw new Error('Danh sách học sinh của buổi đã thay đổi. Hãy tải lại mẫu mới trước khi nhập.')
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(attendanceSheet, { header: 1, defval: '', raw: true })
  const headers = (matrix[0] || []).map(cellText)
  const expectedHeaders = [STUDENT_ID_HEADER, ...SESSION_ATTENDANCE_HEADERS]
  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    throw new Error('Tiêu đề hoặc thứ tự cột không đúng. Hãy tải lại mẫu và giữ nguyên các cột điểm danh.')
  }

  const currentById = new Map(currentRows.map((row) => [row.student_id, row]))
  const expectedIds = new Set(expectedRosterIds)
  const seenIds = new Set<string>()
  const patches: AttendanceExcelPatchRow[] = []
  const issues: AttendanceExcelIssue[] = []
  const dataRows = matrix.slice(1)

  for (let index = 0; index < dataRows.length; index += 1) {
    const cells = dataRows[index]
    const rowNumber = index + 2
    const values = cells.slice(0, expectedHeaders.length)
    const studentId = cellText(values[0])
    const editableValues = values.slice(3)
    if (!studentId) {
      if (editableValues.some((value) => cellText(value))) {
        issues.push({ row_number: rowNumber, message: 'Không xác định được học sinh của dòng này. Hãy giữ nguyên cột mã nội bộ trong mẫu.' })
      }
      continue
    }
    if (!expectedIds.has(studentId)) {
      issues.push({ row_number: rowNumber, message: 'Học sinh không thuộc roster của buổi đang chọn.' })
      continue
    }
    if (seenIds.has(studentId)) {
      issues.push({ row_number: rowNumber, message: 'Học sinh xuất hiện nhiều hơn một lần trong tệp.' })
      continue
    }
    seenIds.add(studentId)

    const current = currentById.get(studentId)
    if (!current) {
      issues.push({ row_number: rowNumber, message: 'Không tìm thấy học sinh trong roster hiện tại.' })
      continue
    }
    if (cellText(values[1]) !== (current.students?.student_code || '')
        || cellText(values[2]) !== (current.students?.full_name || '')) {
      issues.push({ row_number: rowNumber, message: 'Mã hoặc tên học sinh không khớp dòng dữ liệu nội bộ. Hãy khôi phục thông tin học sinh trong mẫu.' })
      continue
    }

    const patch: AttendanceExcelPatch = {}
    const status = normalizeStatus(values[3])
    if (status === null) issues.push({ row_number: rowNumber, message: 'Trạng thái không hợp lệ. Dùng Có mặt, Đi muộn, Vắng mặt hoặc Vắng có phép.' })
    else if (status !== undefined) patch.status = status

    const numberColumns: Array<{ index: number; key: keyof AttendanceValue; label: string }> = [
      { index: 4, key: 'late_minutes', label: 'Phút đi muộn' },
      { index: 6, key: 'homework_score', label: 'Điểm BTVN' },
      { index: 8, key: 'understanding_score', label: 'Hiểu bài' },
      { index: 9, key: 'attitude_score', label: 'Thái độ' },
      { index: 10, key: 'positive_feedback_count', label: 'Điểm cộng' },
    ]
    for (const column of numberColumns) {
      const value = parseNumber(values[column.index], rowNumber, column.label, issues)
      if (value !== undefined) Object.assign(patch, { [column.key]: value })
    }

    const textColumns: Array<{ index: number; key: keyof AttendanceValue }> = [
      { index: 5, key: 'absence_reason' },
      { index: 7, key: 'homework_note' },
      { index: 11, key: 'positive_feedback_raw' },
      { index: 12, key: 'comment' },
    ]
    for (const column of textColumns) {
      const value = cellText(values[column.index])
      if (value) Object.assign(patch, { [column.key]: value })
    }

    const changedPatch: AttendanceExcelPatch = {}
    for (const [key, value] of Object.entries(patch) as Array<[keyof AttendanceValue, AttendanceValue[keyof AttendanceValue]]>) {
      if (current.attendance[key] !== value) Object.assign(changedPatch, { [key]: value })
    }
    if (!Object.keys(changedPatch).length) continue

    const merged = { ...current.attendance, ...changedPatch }
    if (!merged.status) issues.push({ row_number: rowNumber, message: 'Cần chọn trạng thái điểm danh cho học sinh có dữ liệu thay đổi.' })
    const validationError = attendanceValidationError(merged)
    if (validationError) issues.push({ row_number: rowNumber, message: validationError })
    if ((changedPatch.late_minutes !== undefined && !Number.isInteger(changedPatch.late_minutes))
        || (changedPatch.understanding_score !== undefined && !Number.isInteger(changedPatch.understanding_score))
        || (changedPatch.attitude_score !== undefined && !Number.isInteger(changedPatch.attitude_score))
        || (changedPatch.positive_feedback_count !== undefined && !Number.isInteger(changedPatch.positive_feedback_count))) {
      issues.push({ row_number: rowNumber, message: 'Phút đi muộn, mức hiểu bài, thái độ và điểm cộng phải là số nguyên.' })
    }
    if (changedPatch.comment !== undefined && changedPatch.comment.length > 2000) {
      issues.push({ row_number: rowNumber, message: 'Nhận xét tối đa 2.000 ký tự.' })
    }
    patches.push({ student_id: studentId, patch: changedPatch })
  }

  for (const studentId of expectedIds) {
    if (!seenIds.has(studentId)) {
      issues.push({ row_number: 0, message: 'Tệp thiếu học sinh trong roster. Hãy tải lại mẫu mới và giữ nguyên đầy đủ danh sách.' })
      break
    }
  }

  if (!patches.length && !issues.length) {
    issues.push({ row_number: 0, message: 'Tệp chưa có dữ liệu mới để nạp vào biểu mẫu.' })
  }

  return { patches: issues.length ? [] : patches, issues, roster_count: expectedRosterIds.length }
}
