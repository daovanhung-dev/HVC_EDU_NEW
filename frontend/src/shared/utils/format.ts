export function formatVnd(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('vi-VN').format(Number(value))} ₫`
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}
