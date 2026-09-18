import * as XLSX from 'npm:xlsx@0.18.5'
import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

type ReportType = 'STUDENTS' | 'ATTENDANCE' | 'HOMEWORK' | 'MONTHLY'
type ReportFormat = 'XLSX' | 'PDF'
interface Filters { year: number; month: number; class_id?: string; student_id?: string; staff_id?: string }
function one<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value || undefined }

function inMonth(value: string | null | undefined, filters: Filters): boolean {
  if (!value) return false
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric' }).formatToParts(date)
  return Number(parts.find((part) => part.type === 'year')?.value) === filters.year && Number(parts.find((part) => part.type === 'month')?.value) === filters.month
}

function flatten(type: ReportType, source: any, filters: Filters): Record<string, unknown>[] {
  if (type === 'STUDENTS') return source.map((row: any) => ({ 'Mã học sinh': row.student_code, 'Họ tên': row.full_name, 'Điện thoại': row.phone || '', 'Phụ huynh': row.parent_name || '', 'Trạng thái': row.status }))
  if (type === 'ATTENDANCE' || type === 'HOMEWORK') return source.filter((row: any) => inMonth(one(row.sessions)?.scheduled_start_at, filters) && (!filters.student_id || row.student_id === filters.student_id)).map((row: any) => ({ 'Mã học sinh': one(row.students)?.student_code || '', 'Học sinh': one(row.students)?.full_name || '', 'Lớp': one(one(one(row.sessions)?.class_months)?.classes)?.name || '', 'Thời gian': one(row.sessions)?.scheduled_start_at || '', 'Điểm danh': row.status, 'BTVN': row.homework_score ?? '', 'Nhận xét': row.comment || '' }))
  const sessions = source.sessions || []; const attendance = source.attendance || []; const timesheets = source.timesheets || []
  const marked = attendance.filter((row: any) => row.status)
  const comments = marked.filter((row: any) => String(row.comment || '').trim())
  return [{ 'Chỉ số': 'Buổi đã hoàn thành', 'Giá trị': sessions.filter((row: any) => row.status === 'COMPLETED').length }, { 'Chỉ số': 'Buổi sắp tới', 'Giá trị': sessions.filter((row: any) => row.status === 'SCHEDULED').length }, { 'Chỉ số': 'Tỷ lệ điểm danh', 'Giá trị': marked.length ? `${Math.round((marked.filter((row: any) => row.status === 'PRESENT' || row.status === 'LATE').length / marked.length) * 100)}%` : '0%' }, { 'Chỉ số': 'Độ đầy đủ nhận xét', 'Giá trị': marked.length ? `${Math.round((comments.length / marked.length) * 100)}%` : '0%' }, { 'Chỉ số': 'Công chờ duyệt', 'Giá trị': timesheets.filter((row: any) => row.status === 'PENDING').length }]
}

function pdfEscape(value: string) { return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)').replaceAll('\n', ' ') }
function makePdf(title: string, rows: Record<string, unknown>[]): Uint8Array {
  const lines = [title, `Tạo lúc: ${new Date().toISOString()}`, ...rows.flatMap((row) => Object.entries(row).map(([key, value]) => `${key}: ${String(value ?? '')}`)), '']
  const content = ['BT', '/F1 9 Tf', '50 800 Td', ...lines.slice(0, 52).map((line, index) => `${index ? '0 -14 Td ' : ''}(${pdfEscape(line.slice(0, 150))}) Tj`), 'ET'].join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const chunks = ['%PDF-1.4\n']; const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) { offsets.push(new TextEncoder().encode(chunks.join('')).length); chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`) }
  const xrefOffset = new TextEncoder().encode(chunks.join('')).length
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  return new TextEncoder().encode(chunks.join(''))
}

function base64(bytes: Uint8Array) { let value = ''; for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(value) }

async function readData(type: ReportType, filters: Filters) {
  const admin = adminClient()
  if (type === 'STUDENTS') { const result = await admin.from('students').select('student_code,full_name,phone,parent_name,status').order('full_name'); if (result.error) throw result.error; return result.data || [] }
  if (type === 'ATTENDANCE' || type === 'HOMEWORK') { const result = await admin.from('student_attendances').select('status,homework_score,comment,student_id,sessions(scheduled_start_at,class_months(classes(name,code),class_id)),students(student_code,full_name)'); if (result.error) throw result.error; return result.data || [] }
  const [sessions, attendance, timesheets] = await Promise.all([
    admin.from('sessions').select('status,scheduled_start_at').gte('scheduled_start_at', `${filters.year}-${String(filters.month).padStart(2, '0')}-01T00:00:00+07:00`).lte('scheduled_start_at', `${filters.year}-${String(filters.month).padStart(2, '0')}-31T23:59:59+07:00`),
    admin.from('student_attendances').select('status,comment,updated_at').gte('updated_at', `${filters.year}-${String(filters.month).padStart(2, '0')}-01T00:00:00+07:00`).lte('updated_at', `${filters.year}-${String(filters.month).padStart(2, '0')}-31T23:59:59+07:00`),
    admin.from('timesheets').select('status,submitted_at').gte('submitted_at', `${filters.year}-${String(filters.month).padStart(2, '0')}-01T00:00:00+07:00`).lte('submitted_at', `${filters.year}-${String(filters.month).padStart(2, '0')}-31T23:59:59+07:00`),
  ])
  const error = [sessions.error, attendance.error, timesheets.error].find(Boolean); if (error) throw error
  return { sessions: sessions.data || [], attendance: attendance.data || [], timesheets: timesheets.data || [] }
}

Deno.serve(async (req) => {
  const options = handleOptions(req); if (options) return options
  try {
    await requirePermission(req, 'REPORTS_EXPORT')
    const body = await req.json() as { type?: ReportType; format?: ReportFormat; filters?: Filters }
    const type = body.type; const format = body.format; const filters = body.filters
    if (['TUITION', 'PAYROLL', 'ACCOUNTING'].includes(String(type))) return fail('FEATURE_DISABLED', 'Báo cáo tài chính đã được ngừng sử dụng.', 410)
    if (!type || !format || !filters || !['STUDENTS', 'ATTENDANCE', 'HOMEWORK', 'MONTHLY'].includes(type) || !['XLSX', 'PDF'].includes(format)) return fail('INVALID_INPUT', 'Loại hoặc định dạng báo cáo không hợp lệ.')
    if (!filters.year || !filters.month || filters.month < 1 || filters.month > 12) return fail('INVALID_INPUT', 'Tháng báo cáo không hợp lệ.')
    const data = await readData(type, filters); const rows = flatten(type, data, filters); const stamp = `${filters.year}-${String(filters.month).padStart(2, '0')}`
    if (format === 'XLSX') { const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Thông báo': 'Không có dữ liệu' }]); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Report'); return ok({ filename: `hvc-edu-${type.toLowerCase()}-${stamp}.xlsx`, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content_base64: XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' }) }) }
    return ok({ filename: `hvc-edu-${type.toLowerCase()}-${stamp}.pdf`, mime_type: 'application/pdf', content_base64: base64(makePdf(`HVC_EDU - ${type} - ${stamp}`, rows)) })
  } catch (error) { return fromError(error) }
})
