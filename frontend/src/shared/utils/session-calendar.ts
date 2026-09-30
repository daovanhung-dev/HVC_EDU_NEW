const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateKeyFromUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new RangeError(`Invalid calendar date: ${dateKey}`)

  const [, year, month, day] = match.map(Number)
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Invalid calendar date: ${dateKey}`)
  }

  return { year, month, day }
}

function asBusinessDate(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

export function getBusinessDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid session date')

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function addCalendarDays(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey)
  return dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1, day + days)))
}

export function shiftCalendarMonth(dateKey: string, months: number): string {
  const { year, month } = parseDateKey(dateKey)
  return dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1 + months, 1)))
}

export function getMonthGridDateKeys(dateKey: string): string[] {
  const { year, month } = parseDateKey(dateKey)
  const firstDate = new Date(Date.UTC(year, month - 1, 1))
  const mondayOffset = (firstDate.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const numberOfCells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7
  const gridStart = dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1, 1 - mondayOffset)))

  return Array.from({ length: numberOfCells }, (_, index) => addCalendarDays(gridStart, index))
}

export function getWeekDateKeys(dateKey: string): string[] {
  const { year, month, day } = parseDateKey(dateKey)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  const monday = addCalendarDays(dateKey, -mondayOffset)
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index))
}

export function groupSessionsByBusinessDate<T extends { scheduled_start_at: string }>(sessions: readonly T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  const sorted = [...sessions].sort((left, right) => Date.parse(left.scheduled_start_at) - Date.parse(right.scheduled_start_at))

  for (const session of sorted) {
    const dateKey = getBusinessDateKey(session.scheduled_start_at)
    ;(groups[dateKey] ||= []).push(session)
  }

  return groups
}

export function formatBusinessMonth(dateKey: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: BUSINESS_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(asBusinessDate(dateKey))
}

export function formatBusinessDate(dateKey: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: BUSINESS_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(asBusinessDate(dateKey))
}

export function formatBusinessTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}
