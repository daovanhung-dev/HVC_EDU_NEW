import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  formatBusinessTime,
  getBusinessDateKey,
  getMonthGridDateKeys,
  getWeekDateKeys,
  groupSessionsByBusinessDate,
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
  })
})
