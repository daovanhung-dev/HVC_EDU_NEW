import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  formatBusinessTime,
  getBusinessDateKey,
  getBusinessTimeMinutes,
  getMonthGridDateKeys,
  getTimetableTimeRange,
  getWeekDateKeys,
  groupSessionsByBusinessDate,
  layoutTimedEvents,
  shiftCalendarMonth,
} from './session-calendar'

describe('session calendar date helpers', () => {
  it('builds Monday-first month grids across month boundaries', () => {
    const dates = getMonthGridDateKeys('2024-01-18')

    expect(dates).toHaveLength(35)
    expect(dates[0]).toBe('2024-01-01')
    expect(dates.at(-1)).toBe('2024-02-04')
  })

  it('moves month and week ranges across year boundaries', () => {
    expect(shiftCalendarMonth('2026-12-30', 1)).toBe('2027-01-01')
    expect(shiftCalendarMonth('2027-01-01', -1)).toBe('2026-12-01')
    expect(getWeekDateKeys('2027-01-01')).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
      '2027-01-01', '2027-01-02', '2027-01-03',
    ])
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('groups and sorts sessions by their Ho Chi Minh business date', () => {
    const grouped = groupSessionsByBusinessDate([
      { id: 'late', scheduled_start_at: '2026-09-30T16:00:00.000Z' },
      { id: 'next-day', scheduled_start_at: '2026-09-30T17:30:00.000Z' },
      { id: 'early', scheduled_start_at: '2026-09-30T14:00:00.000Z' },
    ])

    expect(getBusinessDateKey('2026-09-30T17:30:00.000Z')).toBe('2026-10-01')
    expect(grouped['2026-09-30']?.map((session) => session.id)).toEqual(['early', 'late'])
    expect(grouped['2026-10-01']?.map((session) => session.id)).toEqual(['next-day'])
    expect(formatBusinessTime('2026-09-30T17:30:00.000Z')).toContain('00:30')
    expect(getBusinessTimeMinutes('2026-09-30T17:30:00.000Z')).toBe(30)
  })

  it('uses the default timetable range and expands it to half-hour boundaries', () => {
    expect(getTimetableTimeRange([])).toEqual({ startMinute: 360, endMinute: 1320 })
    expect(getTimetableTimeRange([
      { id: 'early', startsAt: '2026-09-30T05:12:00+07:00', endsAt: '2026-09-30T06:10:00+07:00' },
      { id: 'late', startsAt: '2026-09-30T21:30:00+07:00', endsAt: '2026-09-30T23:11:00+07:00' },
    ])).toEqual({ startMinute: 300, endMinute: 1410 })
  })

  it('places overlapping events in parallel lanes and reuses lanes at touching boundaries', () => {
    const placements = layoutTimedEvents([
      { id: 'long', startsAt: '2026-09-30T08:00:00+07:00', endsAt: '2026-09-30T10:00:00+07:00' },
      { id: 'overlap', startsAt: '2026-09-30T08:30:00+07:00', endsAt: '2026-09-30T09:30:00+07:00' },
      { id: 'touching', startsAt: '2026-09-30T09:30:00+07:00', endsAt: '2026-09-30T10:30:00+07:00' },
      { id: 'after', startsAt: '2026-09-30T10:30:00+07:00', endsAt: '2026-09-30T11:00:00+07:00' },
    ])

    expect(placements.map(({ event }) => event.id)).toEqual(['long', 'overlap', 'touching', 'after'])
    expect(placements.map(({ lane, laneCount }) => [lane, laneCount])).toEqual([
      [0, 2], [1, 2], [1, 2], [0, 1],
    ])
    expect(placements[0].endMinute - placements[0].startMinute).toBe(120)
  })
})
