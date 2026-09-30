import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRow } from '@/shared/types/domain'
import { formatBusinessMonth, getBusinessDateKey, shiftCalendarMonth } from '@/shared/utils/session-calendar'
import AdminSessionsPage from './AdminSessionsPage.vue'

const mockState = vi.hoisted(() => ({
  getMySessions: vi.fn(),
  getSessionStudents: vi.fn(),
  updateSessionOccurrence: vi.fn(),
}))

vi.mock('@/services/data-queries', () => ({
  getMySessions: mockState.getMySessions,
  getSessionStudents: mockState.getSessionStudents,
}))

vi.mock('@/services/commands', () => ({
  updateSessionOccurrence: mockState.updateSessionOccurrence,
}))

function makeSession(
  id = 'qa-session-1',
  className = 'Lớp Toán QA',
  start = '10:00',
  end = '12:00',
): SessionRow {
  const businessDate = getBusinessDateKey(new Date())
  return {
    id,
    class_id: 'qa-class-1',
    scheduled_start_at: `${businessDate}T${start}:00+07:00`,
    scheduled_end_at: `${businessDate}T${end}:00+07:00`,
    status: 'SCHEDULED',
    session_note: null,
    classes: { id: 'qa-class-1', name: className },
    session_staff: [],
    session_students: [],
  }
}

function mountPage() {
  return mount(AdminSessionsPage, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

async function clickButtonWithText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  await button.trigger('click')
}

describe('AdminSessionsPage calendar', () => {
  beforeEach(() => {
    mockState.getMySessions.mockReset().mockResolvedValue([])
    mockState.getSessionStudents.mockReset().mockResolvedValue([])
    mockState.updateSessionOccurrence.mockReset().mockResolvedValue(undefined)
  })

  it('defaults to month view and supports month, week, and list modes', async () => {
    mockState.getMySessions.mockResolvedValue([
      makeSession('qa-session-late', 'Lớp Lý QA', '11:30', '12:30'),
      makeSession('qa-session-early', 'Lớp Toán QA', '08:30', '09:30'),
    ])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.calendar-grid-month').exists()).toBe(true)
    expect([28, 35, 42]).toContain(wrapper.findAll('.calendar-day').length)
    expect(wrapper.find('.calendar-weekdays').text()).toContain('Thứ Hai')
    expect(wrapper.findAll('.calendar-event-name').map((event) => event.text())).toEqual(['Lớp Toán QA', 'Lớp Lý QA'])
    expect(wrapper.findAll('.calendar-event').map((event) => event.text())).toContainEqual(expect.stringContaining('SCHEDULED'))

    await wrapper.get('button[aria-label="Kỳ trước"]').trigger('click')
    const previousMonth = shiftCalendarMonth(getBusinessDateKey(new Date()), -1)
    expect(wrapper.find('.calendar-period-title').text()).toBe(formatBusinessMonth(previousMonth))
    expect(wrapper.find('.calendar-grid-month').exists()).toBe(true)

    await clickButtonWithText(wrapper, 'Tuần')
    expect(wrapper.find('.calendar-grid-week').exists()).toBe(true)
    expect(wrapper.findAll('.calendar-day')).toHaveLength(7)

    await clickButtonWithText(wrapper, 'Danh sách')
    expect(wrapper.find('.session-list').text()).toContain('Lớp Toán QA')
    expect(wrapper.find('.session-list').text()).toContain('Lớp Lý QA')
    expect(wrapper.find('.calendar-grid').exists()).toBe(false)
    expect(previousMonth).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('opens the selected session details and displays the class name', async () => {
    const session = makeSession()
    mockState.getMySessions.mockResolvedValue([session])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.calendar-event-name').text()).toBe('Lớp Toán QA')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()

    expect(mockState.getSessionStudents).toHaveBeenCalledWith(session.id)
    expect(wrapper.findAll('h2').at(-1)?.text()).toBe('Lớp Toán QA')
    expect(wrapper.text()).not.toContain('QA-CLASS-1')
  })

  it('shows the empty state and reports load errors without claiming there are no sessions', async () => {
    mockState.getMySessions.mockResolvedValue([])
    const emptyPage = mountPage()
    await flushPromises()
    expect(emptyPage.text()).toContain('Chưa có buổi học.')
    await clickButtonWithText(emptyPage, 'Danh sách')
    expect(emptyPage.find('.session-list').text()).toContain('Chưa có buổi học.')

    mockState.getMySessions.mockRejectedValue(new Error('Không thể kết nối.'))
    const failedPage = mountPage()
    await flushPromises()
    expect(failedPage.text()).toContain('Không thể kết nối.')
    expect(failedPage.text()).not.toContain('Chưa có buổi học.')
    await clickButtonWithText(failedPage, 'Danh sách')
    expect(failedPage.find('.session-list').text()).not.toContain('Chưa có buổi học.')
  })

  it('links admins to class scheduling', () => {
    const wrapper = mountPage()
    const scheduleLink = wrapper.findComponent(RouterLinkStub)
    expect(scheduleLink.exists()).toBe(true)
    expect(scheduleLink.props('to')).toBe('/admin/classes')
    expect(scheduleLink.text()).toBe('Xếp lịch lớp')
  })
})
