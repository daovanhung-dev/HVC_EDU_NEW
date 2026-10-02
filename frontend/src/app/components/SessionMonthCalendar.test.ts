import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRow } from '@/shared/types/domain'
import { formatBusinessMonth } from '@/shared/utils/session-calendar'
import SessionMonthCalendar from './SessionMonthCalendar.vue'

function makeSession(id: string, date: string, time: string, name: string, status: SessionRow['status'] = 'SCHEDULED'): SessionRow {
  return {
    id,
    class_id: `qa-class-${id}`,
    recurrence_schedule_id: null,
    recurrence_occurrence_date: null,
    scheduled_start_at: `${date}T${time}:00+07:00`,
    scheduled_end_at: `${date}T${time === '09:00' ? '10:00' : '12:00'}:00+07:00`,
    status,
    session_note: `Nội dung ${name}`,
    room: 'QA-01',
    classes: { name },
    session_staff: [],
  }
}

function monthTitle(dateKey: string) {
  return formatBusinessMonth(dateKey).replace(/^./u, (firstLetter) => firstLetter.toLocaleUpperCase('vi-VN'))
}

describe('SessionMonthCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T09:00:00+07:00'))
  })

  afterEach(() => vi.useRealTimers())

  it('shows month navigation, today, and lets a user select a session', async () => {
    const session = makeSession('qa-oct-1', '2026-10-15', '09:00', 'Lớp Toán QA')
    const wrapper = mount(SessionMonthCalendar, { props: { sessions: [session] } })

    expect(wrapper.find('.session-month__grid').exists()).toBe(true)
    expect(wrapper.find('.session-month__title').text()).toContain(monthTitle('2026-10-15'))
    expect(wrapper.findAll('.session-month__day')).toHaveLength(35)
    expect(wrapper.text()).toContain('15 thg 10, 2026')

    await wrapper.get('.session-month__event').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('select')?.[0]).toEqual([session])
    expect(wrapper.find('.session-month__session-card').text()).toContain('Lớp Toán QA')
    expect(wrapper.find('.session-month__date-button[aria-pressed="true"]').attributes('aria-label')).toContain('15 thg 10, 2026')
    wrapper.unmount()
  })

  it('moves between months, returns to today, and shows a date agenda', async () => {
    const session = makeSession('qa-nov-1', '2026-11-04', '11:00', 'Lớp Anh QA', 'IN_PROGRESS')
    const wrapper = mount(SessionMonthCalendar, { props: { sessions: [session] } })

    await wrapper.get('button[aria-label="Tháng sau"]').trigger('click')
    expect(wrapper.find('.session-month__title').text()).toContain(monthTitle('2026-11-01'))

    await wrapper.get('[data-date-key="2026-11-04"] .session-month__date-button').trigger('click')
    expect(wrapper.find('.session-month__agenda-heading').text()).toContain('4 thg 11, 2026')
    expect(wrapper.find('.session-month__agenda').text()).toContain('Lớp Anh QA')
    expect(wrapper.find('.session-month__agenda').text()).toContain('Đang học')

    await wrapper.get('button[aria-label="Tháng trước"]').trigger('click')
    expect(wrapper.find('.session-month__title').text()).toContain(monthTitle('2026-10-01'))
    await wrapper.get('.session-month__today').trigger('click')
    expect(wrapper.find('.session-month__title').text()).toContain(monthTitle('2026-10-15'))
    wrapper.unmount()
  })

  it('switches to a date-sorted list limited to the visible month', async () => {
    const late = makeSession('qa-oct-late', '2026-10-15', '11:00', 'Lớp Lý QA', 'COMPLETED')
    const early = makeSession('qa-oct-early', '2026-10-15', '09:00', 'Lớp Toán QA')
    const outsideMonth = makeSession('qa-sep', '2026-09-30', '09:00', 'Lớp Anh QA')
    const wrapper = mount(SessionMonthCalendar, { props: { sessions: [late, outsideMonth, early] } })

    await wrapper.get('button[aria-pressed="false"]').trigger('click')
    // The first unpressed button is the month toggle; the date selection remains available separately.
    expect(wrapper.find('.session-month__grid').exists()).toBe(false)
    expect(wrapper.findAll('.session-month__session-card').map((item) => item.text())).toEqual([
      expect.stringContaining('Lớp Toán QA'),
      expect.stringContaining('Lớp Lý QA'),
    ])
    expect(wrapper.text()).not.toContain('Lớp Anh QA')
    wrapper.unmount()
  })

  it('keeps an understandable empty state when there are no sessions', () => {
    const wrapper = mount(SessionMonthCalendar, { props: { sessions: [] } })

    expect(wrapper.text()).toContain('Không có buổi học trong ngày này.')
    expect(wrapper.text()).toContain('0 buổi học')
    wrapper.unmount()
  })
})
