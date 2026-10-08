import type { ClassRosterExportStudent } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'

const HEADERS = ['Mã', 'Họ tên', 'SĐT', 'Phụ huynh', 'Trạng thái', 'Ngày tạo']

export function studentClassRosterExportFilename(classCode: string, date = new Date()): string {
  const vietnamDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
  const safeClassCode = classCode.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-').replace(/[. ]+$/u, '') || 'lop'
  return `danh-sach-hoc-sinh-${safeClassCode}-${vietnamDate}.xlsx`
}

function displayStudentStatus(status: string): string {
  if (status === 'ACTIVE') return 'Đang hoạt động'
  if (status === 'LOCKED') return 'Đã khóa'
  return status || '—'
}

export async function downloadStudentClassRosterExport(classCode: string, rows: ClassRosterExportStudent[]) {
  const XLSX = await import('xlsx')
  const values = [
    HEADERS,
    ...rows.map((row) => [
      row.student_code || '—',
      row.full_name || '—',
      row.phone || '—',
      row.parent_name || '—',
      displayStudentStatus(row.status),
      formatDateTime(row.created_at),
    ]),
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(values)

  // Keep identifiers, phone numbers, and user-provided text literal in Excel.
  values.forEach((line, rowIndex) => {
    line.forEach((value, columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      worksheet[address] = { t: 's', v: value }
    })
  })
  worksheet['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 28 }, { wch: 20 }, { wch: 24 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách học sinh')
  XLSX.writeFileXLSX(workbook, studentClassRosterExportFilename(classCode))
}
