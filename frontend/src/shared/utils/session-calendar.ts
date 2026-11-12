const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export const TIMETABLE_TICK_MINUTES = 30
export const DEFAULT_TIMETABLE_START_MINUTE = 6 * 60
export const DEFAULT_TIMETABLE_END_MINUTE = 22 * 60

export type TimedCalendarEvent = { id: string; startsAt: string; endsAt: string }
export type TimetableTimeRange = { startMinute: number; endMinute: number }
export type TimedEventPlacement<T> = {
  event: T
  startMinute: number
  endMinute: number
  lane: number
  laneCount: number
}

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

export function getBusinessTimeMinutes(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid calendar time')

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value)
  return part('hour') * 60 + part('minute')
}

function eventInterval(event: TimedCalendarEvent) {
  const start = Date.parse(event.startsAt)
  const end = Date.parse(event.endsAt)
  const durationMinutes = (end - start) / 60_000
  if (!Number.isFinite(start) || !Number.isFinite(end) || durationMinutes <= 0) {
    throw new RangeError(`Invalid event time range: ${event.id}`)
  }

  const startMinute = getBusinessTimeMinutes(new Date(start))
  return { startMinute, endMinute: startMinute + durationMinutes }
}

export function getTimetableTimeRange(events: readonly TimedCalendarEvent[]): TimetableTimeRange {
  if (!events.length) {
    return { startMinute: DEFAULT_TIMETABLE_START_MINUTE, endMinute: DEFAULT_TIMETABLE_END_MINUTE }
  }

  const intervals = events.map(eventInterval)
  const earliest = Math.min(...intervals.map(({ startMinute }) => startMinute))
  const latest = Math.max(...intervals.map(({ endMinute }) => endMinute))
  return {
    startMinute: Math.min(DEFAULT_TIMETABLE_START_MINUTE, Math.floor(earliest / TIMETABLE_TICK_MINUTES) * TIMETABLE_TICK_MINUTES),
    endMinute: Math.max(DEFAULT_TIMETABLE_END_MINUTE, Math.ceil(latest / TIMETABLE_TICK_MINUTES) * TIMETABLE_TICK_MINUTES),
  }
}

export function layoutTimedEvents<T extends TimedCalendarEvent>(events: readonly T[]): TimedEventPlacement<T>[] {
  const sorted = events
    .map((event) => ({ event, ...eventInterval(event), lane: 0 }))
    .sort((left, right) => left.startMinute - right.startMinute
      || left.endMinute - right.endMinute
      || left.event.id.localeCompare(right.event.id))
  const placements: TimedEventPlacement<T>[] = []
  let group: typeof sorted = []
  let groupEnd = Number.NEGATIVE_INFINITY

  const flushGroup = () => {
    if (!group.length) return
    const laneEnds: number[] = []
    for (const item of group) {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMinute)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = item.endMinute
      item.lane = lane
    }
    for (const item of group) {
      placements.push({
        event: item.event,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        lane: item.lane,
        laneCount: laneEnds.length,
      })
    }
    group = []
    groupEnd = Number.NEGATIVE_INFINITY
  }

  for (const item of sorted) {
    if (group.length && item.startMinute >= groupEnd) flushGroup()
    group.push(item)
    groupEnd = Math.max(groupEnd, item.endMinute)
  }
  flushGroup()
  return placements
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
