import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
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
  previewAllSchedulesReset: vi.fn(),
  resetAllSchedules: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
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
  previewAllSchedulesReset: mockState.previewAllSchedulesReset,
  resetAllSchedules: mockState.resetAllSchedules,
}))

vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    constructor(private readonly element: HTMLElement) {}
    show() { this.element.classList.add('show'); this.element.setAttribute('aria-hidden', 'false') }
    hide() { const event = new Event('hide.bs.modal', { cancelable: true }); this.element.dispatchEvent(event); if (event.defaultPrevented) return; this.element.classList.remove('show'); this.element.setAttribute('aria-hidden', 'true'); this.element.dispatchEvent(new Event('hidden.bs.modal')) }
    dispose() {}
  },
}))

vi.mock('vue-router', () => ({ useRoute: () => mockState.route }))
vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({ success: mockState.toastSuccess, info: mockState.toastInfo, error: mockState.toastError }),
}))

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
    recurrence_schedule_id: null,
    recurrence_occurrence_date: null,
    scheduled_start_at: `${date}T${start}:00+07:00`,
    scheduled_end_at: `${date}T${end}:00+07:00`,
    status: 'SCHEDULED',
    session_note: null,
    classes: { id: 'qa-class-1', name: className },
    session_staff: staffIds.map((staff_id) => ({ staff_id, assignment_role: 'TEACHER', staff: { id: staff_id, full_name: 'Giáo viên QA' } })),
    session_students: [],
  }
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

function mountPage() {
  const wrapper = mount(AdminSessionsPage, { global: { plugins: [createPinia()] } })
  mountedWrappers.push(wrapper)
  return wrapper
}

function getPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.find(selector).exists() ? wrapper.get(selector) : new DOMWrapper(document.body).get(selector)
}

function findPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.find(selector).exists() ? wrapper.find(selector) : new DOMWrapper(document.body).find(selector)
}

function findAllPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  const pageMatches = wrapper.findAll(selector)
  return pageMatches.length ? pageMatches : new DOMWrapper(document.body).findAll(selector)
}

function pageAndBodyText(wrapper: ReturnType<typeof mount>) {
  return `${wrapper.text()} ${document.body.textContent || ''}`
}

async function clickButtonWithText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
    .find((candidate) => candidate.text().trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  await button.trigger('click')
}

async function chooseTeacher(wrapper: ReturnType<typeof mount>, pickerId: string, teacherId: string) {
  const picker = getPageOrBody(wrapper, `#${pickerId}`)
  await picker.trigger('focus')
  await getPageOrBody(wrapper, `#${pickerId}-option-${teacherId}`).setValue(true)
}

describe('AdminSessionsPage calendar', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
    document.body.classList.remove('modal-open')
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  beforeEach(() => {
    mockState.route.query.class_id = ''
    mockState.getMySessions.mockReset().mockResolvedValue([])
    mockState.getSessionStudents.mockReset().mockResolvedValue([])
    mockState.getClasses.mockReset().mockResolvedValue([
      { id: 'qa-class-1', code: 'QA-CODE-1', name: 'Lớp Toán QA', status: 'ACTIVE' },
      { id: 'qa-class-2', code: 'QA-CODE-4', name: 'Lớp khác QA', status: 'ACTIVE' },
      { id: 'qa-class-inactive', code: 'QA-CODE-2', name: 'Lớp ngừng hoạt động QA', status: 'INACTIVE' },
      { id: 'qa-class-archived', code: 'QA-CODE-3', name: 'Lớp lưu trữ QA', status: 'ARCHIVED' },
    ])
    mockState.getStaff.mockReset().mockResolvedValue([
      { id: 'qa-teacher-1', staff_code: 'QA-T-001', full_name: 'Giáo viên QA 1', status: 'ACTIVE' },
      { id: 'qa-teacher-2', staff_code: 'QA-T-002', full_name: 'Giáo viên QA 2', status: 'ACTIVE' },
      { id: 'qa-teacher-3', staff_code: 'QA-T-003', full_name: 'Giáo viên QA 3', status: 'ACTIVE' },
      { id: 'qa-teacher-4', staff_code: 'QA-T-004', full_name: 'Giáo viên QA 4', status: 'ACTIVE' },
      { id: 'qa-teacher-5', staff_code: 'QA-T-005', full_name: 'Giáo viên QA 5', status: 'ACTIVE' },
      { id: 'qa-teacher-6', staff_code: 'QA-T-006', full_name: 'Giáo viên QA 6', status: 'ACTIVE' },
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
    mockState.previewAllSchedulesReset.mockReset().mockResolvedValue({ schedule_count: 2, session_count: 4 })
    mockState.resetAllSchedules.mockReset().mockResolvedValue({ archived_schedules: 2, cancelled_sessions: 4 })
    mockState.toastSuccess.mockReset()
    mockState.toastInfo.mockReset()
    mockState.toastError.mockReset()
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

  it('hides past and cancelled sessions by default and restores them in every view with history enabled', async () => {
    const today = getBusinessDateKey(new Date())
    const past = makeSession('qa-session-past', 'Buổi cũ QA', '10:00', '12:00', addCalendarDays(today, -1))
    const cancelled = { ...makeSession('qa-session-cancelled', 'Buổi đã hủy QA', '10:00', '12:00', addCalendarDays(today, 1)), status: 'CANCELLED' as const }
    const current = makeSession('qa-session-current', 'Buổi hiện tại QA')
    mockState.getMySessions.mockResolvedValue([past, cancelled, current])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.findAll('.calendar-event-name').map((event) => event.text())).toEqual(['Buổi hiện tại QA'])
    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    expect(wrapper.findAll('.calendar-event-name').map((event) => event.text())).toHaveLength(3)

    await clickButtonWithText(wrapper, 'Tuần')
    expect(wrapper.findAll('.session-agenda__item')).toHaveLength(3)
    await clickButtonWithText(wrapper, 'Danh sách')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.find('.session-list').text()).toContain('Buổi đã hủy QA')

    await clickButtonWithText(wrapper, 'Ẩn lịch sử')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.find('.session-list').text()).not.toContain('Buổi cũ QA')
    expect(wrapper.find('.session-list').text()).not.toContain('Buổi đã hủy QA')
  })

  it('previews a global reset, supports cancel, and reports the actual counts after confirmation', async () => {
    mockState.route.query.class_id = 'qa-class-1'
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Đặt lại tất cả lịch')
    expect(mockState.previewAllSchedulesReset).toHaveBeenCalledOnce()
    const confirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('không phụ thuộc lớp đang lọc'))
    if (!confirmation) throw new Error('Global reset confirmation dialog not found')
    expect(confirmation.text()).toContain('2 khung lịch lặp · 4 buổi học')
    expect(confirmation.text()).toContain('Buổi đang diễn ra hoặc đã hoàn tất không bị thay đổi')
    await confirmation.get('.btn-outline-secondary').trigger('click')
    await flushPromises()
    expect(mockState.resetAllSchedules).not.toHaveBeenCalled()

    await clickButtonWithText(wrapper, 'Đặt lại tất cả lịch')
    const secondConfirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('không phụ thuộc lớp đang lọc'))
    if (!secondConfirmation) throw new Error('Global reset confirmation dialog not found after reopening')
    await secondConfirmation.get('.btn-danger').trigger('click')
    await flushPromises()

    expect(mockState.resetAllSchedules).toHaveBeenCalledOnce()
    expect(mockState.getMySessions).toHaveBeenCalledTimes(2)
    expect(mockState.toastSuccess).toHaveBeenCalledWith('Đã lưu trữ 2 khung lịch lặp và hủy 4 buổi học. Lịch sử vẫn được giữ.')
  })

  it('opens the selected session details and displays the class name', async () => {
    const session = { ...makeSession(), lesson_youtube_url: 'https://youtu.be/dQw4w9WgXcQ' }
    mockState.getMySessions.mockResolvedValue([session])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.calendar-event-name').text()).toBe('Lớp Toán QA')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()

    expect(mockState.getSessionStudents).toHaveBeenCalledWith(session.id)
    expect(findAllPageOrBody(wrapper, '.app-modal .modal-title').map((title) => title.text())).toContain('Lớp Toán QA')
    expect(pageAndBodyText(wrapper)).not.toContain('QA-CLASS-1')
    expect(findPageOrBody(wrapper, '.app-modal iframe').attributes('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('refreshes the default date when opening the form and preserves a calendar date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-31T12:00:00+07:00'))
    const wrapper = mountPage()
    await flushPromises()

    vi.setSystemTime(new Date('2026-09-01T12:00:00+07:00'))
    await clickButtonWithText(wrapper, 'Thêm buổi')
    expect((getPageOrBody(wrapper, 'input[type="date"]').element as HTMLInputElement).value).toBe('2026-09-01')

    await wrapper.get(`button[aria-label="Thêm buổi ngày ${formatBusinessDate('2026-09-03')}"]`).trigger('click')
    expect((getPageOrBody(wrapper, 'input[type="date"]').element as HTMLInputElement).value).toBe('2026-09-03')
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

    await clickButtonWithText(wrapper, 'Hủy buổi học')
    const confirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('Buổi học sẽ được đánh dấu đã hủy'))
    if (!confirmation) throw new Error('Cancel confirmation dialog not found')
    await confirmation.get('.btn-danger').trigger('click')
    expect(mockState.updateSessionOccurrence).toHaveBeenLastCalledWith({ session_id: session.id, cancel: true, room: null })
  })

  it('applies future sessions from the visible week to the month in view', async () => {
    const today = getBusinessDateKey(new Date())
    const session = makeSession('qa-week-template', 'Lớp Mẫu QA', '17:30', '19:30', addCalendarDays(today, 1), ['qa-teacher-1'])
    mockState.getMySessions.mockResolvedValue([session])
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Tuần')

    await clickButtonWithText(wrapper, 'Áp dụng tuần này cho tháng')
    await clickButtonWithText(wrapper, 'Áp dụng tuần mẫu')
    await flushPromises()

    expect(mockState.applyWeekToMonth).toHaveBeenCalledWith({
      source_session_ids: [session.id],
      month_start: `${today.slice(0, 7)}-01`,
    })
  })

  it('shows separate empty and error states with a retry action', async () => {
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
    expect(failedPage.find('.app-state--error').text()).toContain('Không thể kết nối.')
    expect(failedPage.find('.session-list').exists()).toBe(false)
    expect(failedPage.find('.app-state--error button').text()).toBe('Thử lại')
  })

  it('does not show the empty state while sessions are still loading', async () => {
    let resolveSessions!: (rows: SessionRow[]) => void
    mockState.getMySessions.mockImplementationOnce(() => new Promise((resolve) => { resolveSessions = resolve }))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Đang tải buổi học…')
    expect(wrapper.text()).not.toContain('Chưa có buổi học.')
    await clickButtonWithText(wrapper, 'Danh sách')
    expect(wrapper.text()).toContain('Đang tải buổi học…')
    expect(wrapper.text()).not.toContain('Chưa có buổi học.')

    resolveSessions([])
    await flushPromises()
    expect(wrapper.text()).toContain('Chưa có buổi học.')
  })

  it('keeps class choices available when the sessions request fails', async () => {
    mockState.getMySessions.mockRejectedValue(new Error('Không thể tải buổi học.'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Không thể tải buổi học.')
    expect(wrapper.find('#session-class-filter option[value="qa-class-1"]').exists()).toBe(true)
    expect(wrapper.find('#session-class-filter option[value="qa-class-archived"]').exists()).toBe(false)

    await clickButtonWithText(wrapper, 'Thêm buổi')
    expect(getPageOrBody(wrapper, '.session-create-form select option[value="qa-class-1"]').exists()).toBe(true)
    expect(getPageOrBody(wrapper, '#session-teachers').exists()).toBe(true)
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
    await clickButtonWithText(wrapper, 'Thêm khung lịch')
    await chooseTeacher(wrapper, 'schedule-teacher', 'qa-teacher-1')
    await getPageOrBody(wrapper, '.schedule-editor-form').trigger('submit')
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
      start_time: '17:30:00', end_time: '19:30:00', room: 'QA-Room-A', status: 'ACTIVE', reviewed_at: null,
      class_schedule_staff: [{ staff_id: 'qa-teacher-1', staff: { id: 'qa-teacher-1', full_name: 'Giáo viên QA 1' } }],
    }])
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-1')
    await flushPromises()

    await getPageOrBody(wrapper, '#session-teachers').trigger('focus')
    expect((getPageOrBody(wrapper, '#session-teachers-option-qa-teacher-1').element as HTMLInputElement).checked).toBe(true)
    expect((getPageOrBody(wrapper, '.session-create-form input[placeholder="Ví dụ: A1"]').element as HTMLInputElement).value).toBe('QA-Room-A')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(mockState.createManualSession).toHaveBeenCalledWith({
      class_id: 'qa-class-1',
      start: new Date(`${date}T17:30:00+07:00`).toISOString(),
      end: new Date(`${date}T19:30:00+07:00`).toISOString(),
      staff_ids: ['qa-teacher-1'],
      room: 'QA-Room-A',
    })
  })

  it('keeps a manually chosen teacher when changing the date after applying the fixed-schedule default', async () => {
    const date = getBusinessDateKey(new Date())
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
    mockState.getClassSchedules.mockResolvedValue([{
      id: 'qa-fixed-slot', class_id: 'qa-class-1', day_of_week: weekday,
      start_time: '17:30:00', end_time: '19:30:00', room: 'QA-Room-A', status: 'ACTIVE', reviewed_at: null,
      class_schedule_staff: [{ staff_id: 'qa-teacher-1', staff: { id: 'qa-teacher-1', full_name: 'Giáo viên QA 1' } }],
    }])
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-1')
    await flushPromises()

    await getPageOrBody(wrapper, '#session-teachers').trigger('focus')
    expect((getPageOrBody(wrapper, '#session-teachers-option-qa-teacher-1').element as HTMLInputElement).checked).toBe(true)
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-2')
    await getPageOrBody(wrapper, '#session-date').setValue(addCalendarDays(date, 1))
    await flushPromises()

    expect(getPageOrBody(wrapper, 'button[aria-label="Bỏ chọn Giáo viên QA 1"]').exists()).toBe(true)
    expect(getPageOrBody(wrapper, 'button[aria-label="Bỏ chọn Giáo viên QA 2"]').exists()).toBe(true)
  })

  it('shows the active-roster reason when the server rejects session creation', async () => {
    mockState.createManualSession.mockRejectedValue(new Error('NO_ACTIVE_STUDENTS'))
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-1')
    await getPageOrBody(wrapper, '#session-date').setValue('2099-01-01')
    await flushPromises()
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-1')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(mockState.createManualSession).toHaveBeenCalledOnce()
    expect(pageAndBodyText(wrapper)).toContain('Lớp chưa có thành viên trong ngày đã chọn.')
    expect(pageAndBodyText(wrapper)).not.toContain('Không thể tạo buổi học.')
  })

  it('reveals a newly created past session and switches away from a filter that excludes it', async () => {
    const today = getBusinessDateKey(new Date())
    const createdDate = shiftCalendarMonth(today, -1)
    const createdSession = {
      ...makeSession('qa-created-past', 'Lớp mới QA', '17:30', '19:30', createdDate),
      class_id: 'qa-class-2',
      classes: { id: 'qa-class-2', name: 'Lớp mới QA' },
    }
    mockState.route.query.class_id = 'qa-class-1'
    mockState.getMySessions.mockResolvedValueOnce([]).mockResolvedValueOnce([createdSession])
    mockState.createManualSession.mockResolvedValue({ session_id: createdSession.id })
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-2')
    await getPageOrBody(wrapper, '#session-date').setValue(createdDate)
    await flushPromises()
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-1')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(mockState.createManualSession).toHaveBeenCalledOnce()
    expect((wrapper.get('#session-class-filter').element as HTMLSelectElement).value).toBe('qa-class-2')
    expect(wrapper.find('.calendar-period-title').text()).toBe(formatBusinessMonth(createdDate))
    expect(wrapper.find('.calendar-event-name').text()).toBe('Lớp mới QA')
    const historyButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Ẩn lịch sử')
    expect(historyButton?.attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).not.toContain('Buổi học đã được tạo nhưng chưa xuất hiện')
  })

  it('moves the calendar to a new future session outside the displayed month', async () => {
    const today = getBusinessDateKey(new Date())
    const createdDate = addCalendarDays(shiftCalendarMonth(today, 2), 8)
    const createdSession = {
      ...makeSession('qa-created-future', 'Lớp tương lai QA', '17:30', '19:30', createdDate),
      class_id: 'qa-class-2',
      classes: { id: 'qa-class-2', name: 'Lớp tương lai QA' },
    }
    mockState.route.query.class_id = 'qa-class-1'
    mockState.getMySessions.mockResolvedValueOnce([]).mockResolvedValueOnce([createdSession])
    mockState.createManualSession.mockResolvedValue({ session_id: createdSession.id })
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-2')
    await getPageOrBody(wrapper, '#session-date').setValue(createdDate)
    await flushPromises()
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-1')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(mockState.createManualSession).toHaveBeenCalledOnce()
    expect(wrapper.find('.calendar-period-title').text()).toBe(formatBusinessMonth(createdDate))
    expect(wrapper.find('.calendar-event-name').text()).toBe('Lớp tương lai QA')
    expect((wrapper.get('#session-class-filter').element as HTMLSelectElement).value).toBe('qa-class-2')
    const historyButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Hiện lịch sử')
    expect(historyButton?.attributes('aria-pressed')).toBe('false')
  })

  it('shows a refresh message when creation succeeds but the new session is absent after reload', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-1')
    await getPageOrBody(wrapper, '#session-date').setValue(addCalendarDays(getBusinessDateKey(new Date()), 2))
    await flushPromises()
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-1')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Buổi học đã được tạo nhưng chưa xuất hiện sau khi tải lại.')
    expect(wrapper.text()).not.toContain('Chưa có buổi học.')
  })

  it('creates past sessions and still rejects reversed manual session times', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-1')
    await getPageOrBody(wrapper, '#session-date').setValue('2020-01-01')
    await flushPromises()
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-1')
    expect(pageAndBodyText(wrapper)).toContain('Buổi điểm danh bù')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(mockState.createManualSession).toHaveBeenCalledWith(expect.objectContaining({
      class_id: 'qa-class-1',
      start: new Date('2020-01-01T17:30:00+07:00').toISOString(),
      end: new Date('2020-01-01T19:30:00+07:00').toISOString(),
    }))

    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-1')
    await getPageOrBody(wrapper, '#session-date').setValue('2099-01-01')
    await getPageOrBody(wrapper, '#session-start-time').setValue('19:30')
    await getPageOrBody(wrapper, '#session-end-time').setValue('18:30')
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-1')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(mockState.createManualSession).toHaveBeenCalledOnce()
    expect(pageAndBodyText(wrapper)).toContain('Giờ kết thúc phải sau giờ bắt đầu.')
  })

  it('offers every class for a past session and only active classes for a future session', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-date').setValue('2099-01-01')
    expect(findPageOrBody(wrapper, '#session-class option[value="qa-class-inactive"]').exists()).toBe(false)
    expect(findPageOrBody(wrapper, '#session-class option[value="qa-class-archived"]').exists()).toBe(false)

    await getPageOrBody(wrapper, '#session-date').setValue('2020-01-01')
    expect(findPageOrBody(wrapper, '#session-class option[value="qa-class-inactive"]').exists()).toBe(true)
    expect(findPageOrBody(wrapper, '#session-class option[value="qa-class-archived"]').exists()).toBe(true)
    expect(getPageOrBody(wrapper, '#session-class option[value="qa-class-archived"]').text()).toContain('Đã lưu trữ')

    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-archived')
    await getPageOrBody(wrapper, '#session-date').setValue('2099-01-01')
    await flushPromises()
    expect((getPageOrBody(wrapper, '#session-class').element as HTMLSelectElement).value).toBe('')
    expect(findPageOrBody(wrapper, '#session-class option[value="qa-class-archived"]').exists()).toBe(false)
  })

  it('shows and updates the room on a selected session', async () => {
    const session = { ...makeSession('qa-room-session'), room: 'QA-Room-A' }
    mockState.getMySessions.mockResolvedValue([session])
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('.calendar-event-room').text()).toBe('QA-Room-A')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()

    const detailModal = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.find('input[type="datetime-local"]').exists())
    if (!detailModal) throw new Error('Selected session detail sheet not found')
    const roomInput = detailModal.get('input:not([type])')
    expect((roomInput.element as HTMLInputElement).value).toBe('QA-Room-A')
    await roomInput.setValue('QA-Room-B')
    await clickButtonWithText(wrapper, 'Lưu lịch mới')

    expect(mockState.updateSessionOccurrence).toHaveBeenCalledWith(expect.objectContaining({
      session_id: session.id,
      room: 'QA-Room-B',
    }))
  })

  it('shows the class total and prevents choosing a sixth distinct teacher for a new session', async () => {
    const date = getBusinessDateKey(new Date())
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
    mockState.getMySessions.mockResolvedValue([
      makeSession('qa-existing-teacher-5', 'Lớp Toán QA', '08:00', '09:00', date, ['qa-teacher-5']),
    ])
    mockState.getClassSchedules.mockResolvedValue([{
      id: 'qa-fixed-slot', class_id: 'qa-class-1', day_of_week: weekday,
      start_time: '17:30:00', end_time: '19:30:00', room: null, status: 'ACTIVE', reviewed_at: null,
      class_schedule_staff: ['qa-teacher-1', 'qa-teacher-2', 'qa-teacher-3', 'qa-teacher-4']
        .map((staff_id) => ({ staff_id, staff: { id: staff_id, full_name: staff_id } })),
    }])
    mockState.route.query.class_id = 'qa-class-1'

    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Chỉnh sửa lịch')
    expect(wrapper.text()).toContain('Giáo viên của lớp: 5/5')
    await clickButtonWithText(wrapper, 'Thêm khung lịch')
    await getPageOrBody(wrapper, '#schedule-teacher').trigger('focus')
    expect(getPageOrBody(wrapper, '#schedule-teacher-option-qa-teacher-6').attributes('disabled')).toBeDefined()

    await clickButtonWithText(wrapper, 'Thêm buổi')
    await flushPromises()
    expect(findAllPageOrBody(wrapper, '.session-create-form label').map((label) => label.text()).find((text) => text.includes('Giáo viên'))).toContain('5/5')
    await getPageOrBody(wrapper, '#session-teachers').trigger('focus')
    expect(getPageOrBody(wrapper, '#session-teachers-option-qa-teacher-6').attributes('disabled')).toBeDefined()
    expect(getPageOrBody(wrapper, '#session-teachers-option-qa-teacher-1').attributes('disabled')).toBeUndefined()
  })

  it('allows replacing a selected-session teacher while keeping the class at five', async () => {
    const date = addCalendarDays(getBusinessDateKey(new Date()), 1)
    mockState.getMySessions.mockResolvedValue([
      makeSession('qa-edited-session', 'Lớp Toán QA', '17:30', '19:30', date, ['qa-teacher-5']),
    ])
    mockState.getClassSchedules.mockResolvedValue([{
      id: 'qa-fixed-slot', class_id: 'qa-class-1', day_of_week: 1,
      start_time: '17:30:00', end_time: '19:30:00', room: null, status: 'ACTIVE', reviewed_at: null,
      class_schedule_staff: ['qa-teacher-1', 'qa-teacher-2', 'qa-teacher-3', 'qa-teacher-4']
        .map((staff_id) => ({ staff_id, staff: { id: staff_id, full_name: staff_id } })),
    }])

    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()

    const detailModal = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.find('input[type="datetime-local"]').exists())
    if (!detailModal) throw new Error('Selected session detail sheet not found')
    const teacherPicker = detailModal.get('#session-detail-teachers')
    await teacherPicker.trigger('focus')
    expect(pageAndBodyText(wrapper)).toContain('5/5')
    expect(detailModal.get('#session-detail-teachers-option-qa-teacher-6').attributes('disabled')).toBeDefined()
    await detailModal.get('#session-detail-teachers-option-qa-teacher-5').setValue(false)
    expect(detailModal.get('#session-detail-teachers-option-qa-teacher-6').attributes('disabled')).toBeUndefined()
    await detailModal.get('#session-detail-teachers-option-qa-teacher-6').setValue(true)
    expect(pageAndBodyText(wrapper)).toContain('5/5')
  })
})
