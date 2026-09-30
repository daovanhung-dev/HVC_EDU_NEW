import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRow } from '@/shared/types/domain'
import { addCalendarDays, formatBusinessDate, formatBusinessMonth, getBusinessDateKey, shiftCalendarMonth } from '@/shared/utils/session-calendar'
import AdminSessionsPage from './AdminSessionsPage.vue'

const mockState = vi.hoisted(() => ({
  route: { query: { class_id: '' } },
  getMySessions: vi.fn(),
  getSessionStudents: vi.fn(),
  getClasses: vi.fn(),
  getStaff: vi.fn(),
  getClassSchedules: vi.fn(),
  getClassActiveRosterSize: vi.fn(),
  updateSessionOccurrence: vi.fn(),
  createManualSession: vi.fn(),
  applyWeekToMonth: vi.fn(),
  updateSessionTeachers: vi.fn(),
  addTeacherToClassSchedule: vi.fn(),
  createClassSchedule: vi.fn(),
  removeTeacherFromClassSchedule: vi.fn(),
  setClassScheduleStatus: vi.fn(),
  updateClassSchedule: vi.fn(),
}))

vi.mock('@/services/data-queries', () => ({
  getMySessions: mockState.getMySessions,
  getSessionStudents: mockState.getSessionStudents,
  getClasses: mockState.getClasses,
  getStaff: mockState.getStaff,
  getClassSchedules: mockState.getClassSchedules,
  getClassActiveRosterSize: mockState.getClassActiveRosterSize,
}))

vi.mock('@/services/commands', () => ({
  updateSessionOccurrence: mockState.updateSessionOccurrence,
  createManualSession: mockState.createManualSession,
  applyWeekToMonth: mockState.applyWeekToMonth,
  updateSessionTeachers: mockState.updateSessionTeachers,
  addTeacherToClassSchedule: mockState.addTeacherToClassSchedule,
  createClassSchedule: mockState.createClassSchedule,
  removeTeacherFromClassSchedule: mockState.removeTeacherFromClassSchedule,
  setClassScheduleStatus: mockState.setClassScheduleStatus,
  updateClassSchedule: mockState.updateClassSchedule,
}))

vi.mock('vue-router', () => ({ useRoute: () => mockState.route }))

function makeSession(
  id = 'qa-session-1',
  className = 'Lớp Toán QA',
  start = '10:00',
  end = '12:00',
  date = getBusinessDateKey(new Date()),
  staffIds: string[] = [],
): SessionRow {
  return {
    id,
    class_id: 'qa-class-1',
    scheduled_start_at: `${date}T${start}:00+07:00`,
    scheduled_end_at: `${date}T${end}:00+07:00`,
    status: 'SCHEDULED',
    session_note: null,
    classes: { id: 'qa-class-1', name: className },
    session_staff: staffIds.map((staff_id) => ({ staff_id, assignment_role: 'TEACHER', staff: { id: staff_id, full_name: 'Giáo viên QA' } })),
    session_students: [],
  }
}

function mountPage() {
  return mount(AdminSessionsPage)
}

async function clickButtonWithText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  await button.trigger('click')
}

describe('AdminSessionsPage calendar', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  beforeEach(() => {
    mockState.route.query.class_id = ''
    mockState.getMySessions.mockReset().mockResolvedValue([])
    mockState.getSessionStudents.mockReset().mockResolvedValue([])
    mockState.getClasses.mockReset().mockResolvedValue([{ id: 'qa-class-1', code: 'QA-CODE-1', name: 'Lớp Toán QA', status: 'ACTIVE' }])
    mockState.getStaff.mockReset().mockResolvedValue([
      { id: 'qa-teacher-1', full_name: 'Giáo viên QA 1', status: 'ACTIVE' },
      { id: 'qa-teacher-2', full_name: 'Giáo viên QA 2', status: 'ACTIVE' },
    ])
    mockState.getClassSchedules.mockReset().mockResolvedValue([])
    mockState.getClassActiveRosterSize.mockReset().mockResolvedValue(0)
    mockState.updateSessionOccurrence.mockReset().mockResolvedValue(undefined)
    mockState.createManualSession.mockReset().mockResolvedValue({ session_id: 'qa-new-session' })
    mockState.applyWeekToMonth.mockReset().mockResolvedValue({ created: 4 })
    mockState.updateSessionTeachers.mockReset().mockResolvedValue({})
    mockState.addTeacherToClassSchedule.mockReset().mockResolvedValue({})
    mockState.createClassSchedule.mockReset().mockResolvedValue({ id: 'qa-schedule' })
    mockState.removeTeacherFromClassSchedule.mockReset().mockResolvedValue(undefined)
    mockState.setClassScheduleStatus.mockReset().mockResolvedValue({})
    mockState.updateClassSchedule.mockReset().mockResolvedValue({})
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
    expect(wrapper.find('thead').text()).toContain('Thời gian')
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

  it('refreshes the default date when opening the form and preserves a calendar date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-31T12:00:00+07:00'))
    const wrapper = mountPage()
    await flushPromises()

    vi.setSystemTime(new Date('2026-09-01T12:00:00+07:00'))
    await clickButtonWithText(wrapper, 'Thêm buổi')
    expect((wrapper.get('input[type="date"]').element as HTMLInputElement).value).toBe('2026-09-01')

    await wrapper.get(`button[aria-label="Thêm buổi ngày ${formatBusinessDate('2026-09-03')}"]`).trigger('click')
    expect((wrapper.get('input[type="date"]').element as HTMLInputElement).value).toBe('2026-09-03')
  })

  it('reschedules and cancels a selected future session through the existing admin command', async () => {
    const session = makeSession('qa-session-edit', 'Lớp Lịch QA', '10:00', '12:00', addCalendarDays(getBusinessDateKey(new Date()), 1))
    mockState.getMySessions.mockResolvedValue([session])
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()

    await clickButtonWithText(wrapper, 'Lưu lịch mới')
    expect(mockState.updateSessionOccurrence).toHaveBeenCalledWith(expect.objectContaining({ session_id: session.id, start: expect.any(String), end: expect.any(String) }))

    vi.stubGlobal('confirm', vi.fn(() => true))
    await clickButtonWithText(wrapper, 'Hủy buổi học')
    expect(mockState.updateSessionOccurrence).toHaveBeenLastCalledWith({ session_id: session.id, cancel: true })
  })

  it('applies future sessions from the visible week to the month in view', async () => {
    const today = getBusinessDateKey(new Date())
    const session = makeSession('qa-week-template', 'Lớp Mẫu QA', '17:30', '19:30', addCalendarDays(today, 1), ['qa-teacher-1'])
    mockState.getMySessions.mockResolvedValue([session])
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Tuần')

    vi.stubGlobal('confirm', vi.fn(() => true))
    await clickButtonWithText(wrapper, 'Áp dụng tuần này cho tháng')
    await flushPromises()

    expect(mockState.applyWeekToMonth).toHaveBeenCalledWith({
      source_session_ids: [session.id],
      month_start: `${today.slice(0, 7)}-01`,
    })
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

  it('keeps class choices available when the sessions request fails', async () => {
    mockState.getMySessions.mockRejectedValue(new Error('Không thể tải buổi học.'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Không thể tải buổi học.')
    expect(wrapper.find('#session-class-filter option[value="qa-class-1"]').exists()).toBe(true)

    await clickButtonWithText(wrapper, 'Thêm buổi')
    expect(wrapper.find('.session-create-form select option[value="qa-class-1"]').exists()).toBe(true)
    expect(wrapper.find('.session-create-form select option[value="qa-teacher-1"]').exists()).toBe(true)
  })

  it('opens integrated schedule management from the Buổi học page', async () => {
    const wrapper = mountPage()
    await clickButtonWithText(wrapper, 'Chỉnh sửa lịch')
    expect(wrapper.text()).toContain('Khung lịch cố định')
    expect(wrapper.text()).toContain('Chọn một lớp ở bộ lọc để quản lý lịch cố định.')
  })

  it('creates a fixed weekly schedule and assigns its default teacher', async () => {
    mockState.route.query.class_id = 'qa-class-1'
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Chỉnh sửa lịch')
    await wrapper.findAll('.schedule-editor-form select').at(-1)?.setValue('qa-teacher-1')
    await wrapper.get('.schedule-editor-form').trigger('submit')
    await flushPromises()

    expect(mockState.createClassSchedule).toHaveBeenCalledWith({
      class_id: 'qa-class-1', day_of_week: 1, start_time: '17:30', end_time: '19:30', room: null,
    })
    expect(mockState.addTeacherToClassSchedule).toHaveBeenCalledWith('qa-schedule', 'qa-teacher-1')
  })

  it('creates a date-specific session and preselects the fixed teacher for a matching slot', async () => {
    const date = getBusinessDateKey(new Date())
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
    mockState.getClassSchedules.mockResolvedValue([{
      id: 'qa-fixed-slot', class_id: 'qa-class-1', day_of_week: weekday,
      start_time: '17:30:00', end_time: '19:30:00', room: null, status: 'ACTIVE', reviewed_at: null,
      class_schedule_staff: [{ staff_id: 'qa-teacher-1', staff: { id: 'qa-teacher-1', full_name: 'Giáo viên QA 1' } }],
    }])
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await wrapper.get('.session-create-form select').setValue('qa-class-1')
    await flushPromises()

    expect((wrapper.get('select[multiple]').element as HTMLSelectElement).selectedOptions[0]?.value).toBe('qa-teacher-1')
    await wrapper.get('.session-create-form').trigger('submit')
    await flushPromises()

    expect(mockState.createManualSession).toHaveBeenCalledWith({
      class_id: 'qa-class-1',
      start: new Date(`${date}T17:30:00+07:00`).toISOString(),
      end: new Date(`${date}T19:30:00+07:00`).toISOString(),
      staff_ids: ['qa-teacher-1'],
    })
  })
})
