import type { AdminExportStudentLoginsRow } from '@/services/commands'

const HEADERS = ['Mã học sinh', 'Họ và tên', 'Email đăng nhập']

export function studentLoginExportFilename(date = new Date()): string {
  const vietnamDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
  return `tai-khoan-hoc-sinh-${vietnamDate}.xlsx`
}

export async function downloadStudentLoginExport(rows: AdminExportStudentLoginsRow[]) {
  const XLSX = await import('xlsx')
  const values = [
    HEADERS,
    ...rows.map((row) => [row.student_code, row.full_name, row.login_email || '']),
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(values)

  // Set every exported value as a literal string, including values beginning with "=".
  values.forEach((line, rowIndex) => {
    line.forEach((value, columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      worksheet[address] = { t: 's', v: value }
    })
  })
  worksheet['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 40 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tài khoản học sinh')
  XLSX.writeFileXLSX(workbook, studentLoginExportFilename())
}
