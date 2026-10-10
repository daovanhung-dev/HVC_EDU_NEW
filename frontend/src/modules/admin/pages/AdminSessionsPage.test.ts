import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import * as XLSX from 'xlsx'
import type { SessionRow } from '@/shared/types/domain'
import { addCalendarDays, formatBusinessDate, formatBusinessMonth, getBusinessDateKey, shiftCalendarMonth } from '@/shared/utils/session-calendar'
import { MONTH_WEEK_SCHEDULE_HEADERS } from '@/modules/admin/utils/month-week-schedule-import'
import AdminSessionsPage from './AdminSessionsPage.vue'

const mockState = vi.hoisted(() => ({
  route: { query: { class_id: '' } },
  getMySessions: vi.fn(),
  getSessionStudents: vi.fn(),
  getClasses: vi.fn(),
  getStaff: vi.fn(),
  getClassSchedules: vi.fn(),
  getClassSchedulesForClasses: vi.fn(),
  getClassMembershipsForSessionDate: vi.fn(),
  getClassActiveRosterSize: vi.fn(),
  updateSessionOccurrence: vi.fn(),
  correctSessionSchedule: vi.fn(),
  correctSessionLearning: vi.fn(),
  createManualSession: vi.fn(),
  previewMonthWeekTemplateReplacement: vi.fn(),
  replaceMonthWithWeekTemplate: vi.fn(),
  getMonthWeekScheduleTemplate: vi.fn(),
  previewMonthWeekScheduleImport: vi.fn(),
  importMonthWeekSchedule: vi.fn(),
  updateSessionTeachers: vi.fn(),
  addTeacherToClassSchedule: vi.fn(),
  createClassSchedule: vi.fn(),
  removeTeacherFromClassSchedule: vi.fn(),
  setClassScheduleStatus: vi.fn(),
  updateClassSchedule: vi.fn(),
  previewDeleteSessionsForMonth: vi.fn(),
  deleteSessionsForMonth: vi.fn(),
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
  getClassSchedulesForClasses: mockState.getClassSchedulesForClasses,
  getClassMembershipsForSessionDate: mockState.getClassMembershipsForSessionDate,
  getClassActiveRosterSize: mockState.getClassActiveRosterSize,
}))

vi.mock('@/services/commands', () => ({
  updateSessionOccurrence: mockState.updateSessionOccurrence,
  correctSessionSchedule: mockState.correctSessionSchedule,
  correctSessionLearning: mockState.correctSessionLearning,
  createManualSession: mockState.createManualSession,
  previewMonthWeekTemplateReplacement: mockState.previewMonthWeekTemplateReplacement,
  replaceMonthWithWeekTemplate: mockState.replaceMonthWithWeekTemplate,
  getMonthWeekScheduleTemplate: mockState.getMonthWeekScheduleTemplate,
  previewMonthWeekScheduleImport: mockState.previewMonthWeekScheduleImport,
  importMonthWeekSchedule: mockState.importMonthWeekSchedule,
  updateSessionTeachers: mockState.updateSessionTeachers,
  addTeacherToClassSchedule: mockState.addTeacherToClassSchedule,
  createClassSchedule: mockState.createClassSchedule,
  removeTeacherFromClassSchedule: mockState.removeTeacherFromClassSchedule,
  setClassScheduleStatus: mockState.setClassScheduleStatus,
  updateClassSchedule: mockState.updateClassSchedule,
  previewDeleteSessionsForMonth: mockState.previewDeleteSessionsForMonth,
  deleteSessionsForMonth: mockState.deleteSessionsForMonth,
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

function qaScheduleWorkbook(month: string): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [...MONTH_WEEK_SCHEDULE_HEADERS],
    ['00000000-0000-4000-8000-000000000004', 'Thứ Hai', 'QA-CODE-1', '08:00', '09:30', 'QA-A1', 'QA-T-001'],
  ]), 'Mẫu tuần')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Tháng áp dụng', month.slice(0, 7)],
    ['Mục', 'Hướng dẫn'],
  ]), 'Hướng dẫn')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const buffer = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const file = new File([buffer], 'QA-lich-thang.xlsx')
  Object.defineProperty(file, 'arrayBuffer', { value: async () => buffer })
  return file
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
    mockState.getClassSchedulesForClasses.mockReset().mockResolvedValue([])
    mockState.getClassMembershipsForSessionDate.mockReset().mockResolvedValue([])
    mockState.getClassActiveRosterSize.mockReset().mockResolvedValue(0)
    mockState.updateSessionOccurrence.mockReset().mockResolvedValue(undefined)
    mockState.correctSessionSchedule.mockReset().mockResolvedValue(undefined)
    mockState.correctSessionLearning.mockReset().mockResolvedValue({ session_id: 'qa-session-1', students_updated: 1 })
    mockState.createManualSession.mockReset().mockResolvedValue({ session_id: 'qa-new-session' })
    mockState.previewMonthWeekTemplateReplacement.mockReset().mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      session_count: 6,
      status_counts: { SCHEDULED: 3, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 1 },
      session_student_count: 2,
      assessment_count: 2,
      session_staff_count: 1,
      staff_replacement_count: 1,
      attendance_count: 2,
      timesheet_count: 1,
      payroll_item_count: 1,
      new_session_count: 10,
    })
    mockState.replaceMonthWithWeekTemplate.mockReset().mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      deleted_sessions: 6,
      deleted_status_counts: { SCHEDULED: 3, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 1 },
      deleted_session_students: 2,
      deleted_session_staff: 1,
      deleted_staff_replacements: 1,
      deleted_attendances: 2,
      deleted_timesheets: 1,
      deleted_payroll_items: 1,
      created_sessions: 10,
    })
    mockState.getMonthWeekScheduleTemplate.mockReset().mockResolvedValue(null)
    mockState.previewMonthWeekScheduleImport.mockReset().mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      create_count: 3,
      update_count: 2,
      cancel_future_count: 1,
      preserve_history_count: 2,
      blockers: [],
      actions: [],
    })
    mockState.importMonthWeekSchedule.mockReset().mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      created_sessions: 3,
      updated_sessions: 2,
      cancelled_sessions: 1,
      preserved_sessions: 2,
      slot_count: 1,
    })
    mockState.updateSessionTeachers.mockReset().mockResolvedValue({})
    mockState.addTeacherToClassSchedule.mockReset().mockResolvedValue({})
    mockState.createClassSchedule.mockReset().mockResolvedValue({ id: 'qa-schedule' })
    mockState.removeTeacherFromClassSchedule.mockReset().mockResolvedValue(undefined)
    mockState.setClassScheduleStatus.mockReset().mockResolvedValue({})
    mockState.updateClassSchedule.mockReset().mockResolvedValue({})
    mockState.previewDeleteSessionsForMonth.mockReset().mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      schedule_count: 2,
      schedule_staff_count: 2,
      session_count: 6,
      status_counts: { SCHEDULED: 3, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 1 },
      session_student_count: 2,
      assessment_count: 2,
      session_staff_count: 1,
      staff_replacement_count: 1,
      attendance_count: 2,
      timesheet_count: 1,
      payroll_item_count: 1,
    })
    mockState.deleteSessionsForMonth.mockReset().mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      deleted_sessions: 6,
      deleted_schedules: 2,
      deleted_schedule_staff: 2,
      deleted_status_counts: { SCHEDULED: 3, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 1 },
      deleted_session_students: 2,
      deleted_session_staff: 1,
      deleted_staff_replacements: 1,
      deleted_attendances: 2,
      deleted_timesheets: 1,
      deleted_payroll_items: 1,
    })
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

  it('previews an Excel month template and applies only after a conflict-free preview', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Nhập lịch Excel')
    const input = getPageOrBody(wrapper, '#month-week-schedule-file')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [qaScheduleWorkbook(getBusinessDateKey(new Date()).slice(0, 7) + '-01')] })
    await input.trigger('change')
    await flushPromises()

    expect(mockState.previewMonthWeekScheduleImport).toHaveBeenCalledWith(
      `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      [expect.objectContaining({ class_id: 'qa-class-1', staff_ids: ['qa-teacher-1'], day_of_week: 1 })],
    )
    expect(pageAndBodyText(wrapper)).toContain('3')
    const apply = [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
      .find((button) => button.text().trim() === 'Áp dụng lịch tháng')
    expect(apply).toBeTruthy()
    expect(apply?.attributes('disabled')).toBeUndefined()
    await apply!.trigger('click')
    await flushPromises()
    expect(mockState.importMonthWeekSchedule).toHaveBeenCalledTimes(1)
    expect(mockState.toastSuccess).toHaveBeenCalled()
  })

  it('keeps the month import disabled when backend preview finds a conflict', async () => {
    mockState.previewMonthWeekScheduleImport.mockResolvedValueOnce({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      create_count: 0,
      update_count: 1,
      cancel_future_count: 0,
      preserve_history_count: 0,
      blockers: [{ code: 'SCHEDULE_CONFLICT', date: getBusinessDateKey(new Date()), message: 'Lịch QA bị trùng.' }],
      actions: [],
    })
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Nhập lịch Excel')
    const input = getPageOrBody(wrapper, '#month-week-schedule-file')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [qaScheduleWorkbook(`${getBusinessDateKey(new Date()).slice(0, 7)}-01`)] })
    await input.trigger('change')
    await flushPromises()

    expect(pageAndBodyText(wrapper)).toContain('Lịch QA bị trùng.')
    const apply = [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
      .find((button) => button.text().trim() === 'Áp dụng lịch tháng')
    expect(apply?.attributes('disabled')).toBeDefined()
    expect(mockState.importMonthWeekSchedule).not.toHaveBeenCalled()
  })

  it('refreshes the preview when the server rejects a stale month import', async () => {
    const monthStart = `${getBusinessDateKey(new Date()).slice(0, 7)}-01`
    mockState.previewMonthWeekScheduleImport
      .mockResolvedValueOnce({
        month_start: monthStart,
        create_count: 1,
        update_count: 0,
        cancel_future_count: 0,
        preserve_history_count: 0,
        blockers: [],
        actions: [],
      })
      .mockResolvedValueOnce({
        month_start: monthStart,
        create_count: 0,
        update_count: 1,
        cancel_future_count: 0,
        preserve_history_count: 0,
        blockers: [{ code: 'TEACHER_SCHEDULE_CONFLICT', slot_id: '00000000-0000-4000-8000-000000000004', date: getBusinessDateKey(new Date()), message: 'Giáo viên QA đã có lịch trùng.' }],
        actions: [],
      })
    mockState.importMonthWeekSchedule.mockRejectedValueOnce(new Error('IMPORT_BLOCKED'))
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Nhập lịch Excel')
    const input = getPageOrBody(wrapper, '#month-week-schedule-file')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [qaScheduleWorkbook(monthStart)] })
    await input.trigger('change')
    await flushPromises()
    await clickButtonWithText(wrapper, 'Áp dụng lịch tháng')
    await flushPromises()

    expect(mockState.previewMonthWeekScheduleImport).toHaveBeenCalledTimes(2)
    expect(pageAndBodyText(wrapper)).toContain('Giáo viên QA đã có lịch trùng.')
    const apply = [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
      .find((button) => button.text().trim() === 'Áp dụng lịch tháng')
    expect(apply?.attributes('disabled')).toBeDefined()
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

  it('explains when the selected period contains only sessions hidden by the history filter', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T12:00:00+07:00'))
    const today = getBusinessDateKey(new Date())
    mockState.getMySessions.mockResolvedValue([
      makeSession('qa-session-hidden-past', 'Buổi cũ QA', '10:00', '12:00', addCalendarDays(today, -1)),
      { ...makeSession('qa-session-hidden-cancelled', 'Buổi hủy QA', '10:00', '12:00', addCalendarDays(today, 1)), status: 'CANCELLED' as const },
    ])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.session-calendar-empty').text()).toContain('Không có buổi học nào hiển thị trong kỳ này. 2 buổi cũ hoặc đã hủy đang ẩn.')
    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    expect(wrapper.findAll('.calendar-event-name').map((event) => event.text())).toEqual(['Buổi cũ QA', 'Buổi hủy QA'])
  })

  it('explains when sessions in the selected period are hidden by the class filter', async () => {
    mockState.route.query.class_id = 'qa-class-2'
    mockState.getMySessions.mockResolvedValue([makeSession('qa-session-other-class', 'Lớp Toán QA')])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.session-calendar-empty').text()).toContain('1 buổi ở lớp khác đang bị bộ lọc lớp ẩn.')
  })

  it('previews permanent deletion for every status, supports cancel, and reports deleted counts', async () => {
    mockState.route.query.class_id = 'qa-class-1'
    const wrapper = mountPage()
    await flushPromises()

    const monthStart = `${getBusinessDateKey(new Date()).slice(0, 7)}-01`
    await clickButtonWithText(wrapper, 'Xóa toàn bộ buổi trong tháng')
    expect(mockState.previewDeleteSessionsForMonth).toHaveBeenCalledWith(monthStart)
    const confirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('Bộ lọc lớp không làm thay đổi phạm vi xóa'))
    if (!confirmation) throw new Error('Month deletion confirmation dialog not found')
    expect(confirmation.text()).toContain(formatBusinessMonth(monthStart))
    expect(confirmation.text()).toContain('6 buổi (3 đã lên lịch · 1 đang diễn ra · 1 đã hoàn tất · 1 đã hủy)')
    expect(confirmation.text()).toContain('2 mẫu lịch lặp')
    expect(confirmation.text()).toContain('2 phân công giáo viên trên mẫu lịch')
    expect(confirmation.text()).toContain('2 điểm danh')
    expect(confirmation.text()).toContain('1 mục lương')
    expect(confirmation.text()).toContain('XÓA VĨNH VIỄN')
    expect(confirmation.text()).toContain('buổi thuộc tháng khác được giữ')
    await confirmation.get('.btn-outline-secondary').trigger('click')
    await flushPromises()
    expect(mockState.deleteSessionsForMonth).not.toHaveBeenCalled()

    await clickButtonWithText(wrapper, 'Xóa toàn bộ buổi trong tháng')
    const secondConfirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('Bộ lọc lớp không làm thay đổi phạm vi xóa'))
    if (!secondConfirmation) throw new Error('Month deletion confirmation dialog not found after reopening')
    await secondConfirmation.get('.btn-danger').trigger('click')
    await flushPromises()

    expect(mockState.deleteSessionsForMonth).toHaveBeenCalledWith(monthStart)
    expect(mockState.getMySessions).toHaveBeenCalledTimes(2)
    expect(mockState.toastSuccess).toHaveBeenCalledWith('Đã xóa vĩnh viễn 6 buổi học trong tháng và 2 mẫu lịch lặp của trung tâm.')
  })

  it('allows deletion of all linked records and every session status after preview', async () => {
    mockState.previewDeleteSessionsForMonth.mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      schedule_count: 1,
      schedule_staff_count: 1,
      session_count: 2,
      status_counts: { SCHEDULED: 0, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 0 },
      session_student_count: 2,
      assessment_count: 1,
      session_staff_count: 1,
      staff_replacement_count: 0,
      attendance_count: 2,
      timesheet_count: 1,
      payroll_item_count: 1,
    })
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Xóa toàn bộ buổi trong tháng')
    expect(findAllPageOrBody(wrapper, '.app-modal').some((modal) => modal.text().includes('1 đang diễn ra · 1 đã hoàn tất'))).toBe(true)
    expect(pageAndBodyText(wrapper)).not.toContain('đã gắn dữ liệu điểm danh')
    expect(mockState.deleteSessionsForMonth).not.toHaveBeenCalled()

    const confirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('1 đang diễn ra · 1 đã hoàn tất'))
    if (!confirmation) throw new Error('Month deletion confirmation dialog not found')
    await confirmation.get('.btn-danger').trigger('click')
    await flushPromises()
    expect(mockState.deleteSessionsForMonth).toHaveBeenCalled()
  })

  it('reports preview failures without opening the delete confirmation', async () => {
    mockState.previewDeleteSessionsForMonth.mockRejectedValue(new Error('QA preview failure'))
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Xóa toàn bộ buổi trong tháng')
    await flushPromises()

    expect(findAllPageOrBody(wrapper, '.app-modal').some((modal) => modal.text().includes('XÓA VĨNH VIỄN'))).toBe(false)
    expect(mockState.deleteSessionsForMonth).not.toHaveBeenCalled()
    expect(mockState.toastError).toHaveBeenCalledWith('Không thể xem trước phạm vi xóa lịch.')
  })

  it('keeps confirmation open and reports a delete failure', async () => {
    mockState.deleteSessionsForMonth.mockRejectedValue({
      code: '23503',
      message: 'foreign key constraint prevents delete',
      details: 'QA-INTERNAL-ROW-VALUE',
    })
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Xóa toàn bộ buổi trong tháng')
    const confirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('XÓA VĨNH VIỄN'))
    if (!confirmation) throw new Error('Month deletion confirmation dialog not found')
    await confirmation.get('.btn-danger').trigger('click')
    await flushPromises()

    const openConfirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('XÓA VĨNH VIỄN'))
    expect(openConfirmation).toBeDefined()
    expect(openConfirmation?.find('.app-confirm [role="alert"]').text()).toContain('dữ liệu liên kết chưa được xử lý')
    expect(openConfirmation?.find('.app-confirm [role="alert"]').text()).toContain('23503')
    expect(openConfirmation?.find('.app-confirm [role="alert"]').text()).not.toContain('QA-INTERNAL-ROW-VALUE')
    expect(mockState.toastError).toHaveBeenCalledWith(expect.stringContaining('23503'))
    expect(mockState.getMySessions).toHaveBeenCalledTimes(1)
  })

  it('does not open confirmation when the selected month has no sessions or schedules', async () => {
    mockState.previewDeleteSessionsForMonth.mockResolvedValue({
      month_start: `${getBusinessDateKey(new Date()).slice(0, 7)}-01`,
      schedule_count: 0,
      schedule_staff_count: 0,
      session_count: 0,
      status_counts: { SCHEDULED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 },
      session_student_count: 0,
      assessment_count: 0,
      session_staff_count: 0,
      staff_replacement_count: 0,
      attendance_count: 0,
      timesheet_count: 0,
      payroll_item_count: 0,
    })
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Xóa toàn bộ buổi trong tháng')
    await flushPromises()

    expect(findAllPageOrBody(wrapper, '.app-modal').some((modal) => modal.text().includes('Xóa toàn bộ buổi học'))).toBe(false)
    expect(mockState.toastInfo).toHaveBeenCalledWith('Không có buổi học hoặc mẫu lịch lặp nào để xóa.')
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

  it.each(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] as const)(
    'allows Admin to edit a past %s session while preserving its status',
    async (status) => {
      const pastDate = addCalendarDays(getBusinessDateKey(new Date()), -1)
      const session = { ...makeSession(`qa-session-past-${status.toLowerCase()}`, 'Lớp Lịch sử QA', '10:00', '12:00', pastDate), status }
      mockState.getMySessions.mockResolvedValue([session])
      const wrapper = mountPage()
      await flushPromises()

      await clickButtonWithText(wrapper, 'Hiện lịch sử')
      await wrapper.get('.calendar-event').trigger('click')
      await flushPromises()

      const detail = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.find('input[type="datetime-local"]').exists())
      if (!detail) throw new Error('Selected past session detail modal not found')
      expect((detail.get('input[type="datetime-local"]').element as HTMLInputElement).disabled).toBe(false)
      expect(pageAndBodyText(wrapper)).toContain('Lưu phân công buổi này')
      expect(pageAndBodyText(wrapper)).toContain('Sửa danh sách học sinh')
      expect(pageAndBodyText(wrapper)).toContain('Sửa nội dung, điểm danh và đánh giá')
      expect(detail.text()).toContain(status)
      expect(pageAndBodyText(wrapper)).not.toContain('Xóa buổi học')
    },
  )

  it('keeps cancelled sessions read-only and lets an overdue scheduled session move to the future', async () => {
    const today = getBusinessDateKey(new Date())
    const pastDate = addCalendarDays(today, -1)
    const cancelled = { ...makeSession('qa-session-cancelled-edit', 'Buổi hủy QA', '10:00', '12:00', pastDate), status: 'CANCELLED' as const }
    const overdue = makeSession('qa-session-overdue-edit', 'Buổi quá hạn QA', '10:00', '12:00', pastDate)
    mockState.getMySessions.mockResolvedValue([cancelled, overdue])
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    const cancelledEvent = wrapper.findAll('.calendar-event').find((event) => event.text().includes('Buổi hủy QA'))
    if (!cancelledEvent) throw new Error('Cancelled session not found in history')
    await cancelledEvent.trigger('click')
    await flushPromises()
    expect(pageAndBodyText(wrapper)).not.toContain('Sửa nội dung, điểm danh và đánh giá')

    const overdueEvent = wrapper.findAll('.calendar-event').find((event) => event.text().includes('Buổi quá hạn QA'))
    if (!overdueEvent) throw new Error('Overdue scheduled session not found in history')
    await overdueEvent.trigger('click')
    await flushPromises()
    const futureDate = addCalendarDays(today, 1)
    const scheduleInputs = findAllPageOrBody(wrapper, 'input[type="datetime-local"]')
    await scheduleInputs[0].setValue(`${futureDate}T10:00`)
    await scheduleInputs[1].setValue(`${futureDate}T12:00`)
    await clickButtonWithText(wrapper, 'Lưu thông tin buổi học')

    expect(mockState.correctSessionSchedule).toHaveBeenCalledWith({
      session_id: overdue.id,
      start: new Date(`${futureDate}T10:00:00+07:00`).toISOString(),
      end: new Date(`${futureDate}T12:00:00+07:00`).toISOString(),
      room: null,
    })
    expect(mockState.correctSessionSchedule).not.toHaveBeenCalledWith(expect.objectContaining({ session_id: cancelled.id }))
  })

  it('saves historical lesson content and all attendance and assessment fields', async () => {
    const pastDate = addCalendarDays(getBusinessDateKey(new Date()), -1)
    const session = { ...makeSession('qa-session-learning-edit', 'Lớp Kết quả QA', '10:00', '12:00', pastDate), status: 'COMPLETED' as const }
    const sourceRow = {
      student_id: 'qa-student-1',
      students: { full_name: 'QA Học sinh Một', student_code: 'QA-ST-001' },
      assessment_snapshot: {},
      student_attendances: [{
        status: 'PRESENT', late_minutes: null, absence_reason: null,
        homework_score: 6, homework_note: null, understanding_score: 3, attitude_score: 4,
        positive_feedback_count: null, positive_feedback_raw: null, comment: null,
      }],
    }
    const updatedRow = { ...sourceRow, student_attendances: [{ ...sourceRow.student_attendances[0], status: 'LATE', late_minutes: 7, homework_score: 8.5, understanding_score: 4, attitude_score: 5, positive_feedback_count: 2, positive_feedback_raw: 'QA tích cực', comment: 'QA nhận xét', homework_note: 'QA BTVN' }] }
    mockState.getMySessions.mockResolvedValue([session])
    mockState.getSessionStudents.mockReset().mockResolvedValueOnce([sourceRow]).mockResolvedValueOnce([updatedRow])
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()
    await clickButtonWithText(wrapper, 'Sửa nội dung, điểm danh và đánh giá')
    await getPageOrBody(wrapper, '#admin-session-note').setValue('QA ghi chú đã sửa')
    await getPageOrBody(wrapper, '#admin-session-youtube').setValue('https://youtu.be/dQw4w9WgXcQ')
    await getPageOrBody(wrapper, '#admin-attendance-status-qa-student-1').setValue('LATE')
    await getPageOrBody(wrapper, '#admin-late-qa-student-1').setValue('7')
    await getPageOrBody(wrapper, '#admin-homework-qa-student-1').setValue('8.5')
    await getPageOrBody(wrapper, '#admin-homework-note-qa-student-1').setValue('QA BTVN')
    await getPageOrBody(wrapper, '#admin-understanding-qa-student-1').setValue('4')
    await getPageOrBody(wrapper, '#admin-attitude-qa-student-1').setValue('5')
    await getPageOrBody(wrapper, '#admin-feedback-count-qa-student-1').setValue('2')
    await getPageOrBody(wrapper, '#admin-feedback-raw-qa-student-1').setValue('QA tích cực')
    await getPageOrBody(wrapper, '#admin-attendance-comment-qa-student-1').setValue('QA nhận xét')
    await clickButtonWithText(wrapper, 'Lưu nội dung và kết quả')
    await flushPromises()

    expect(mockState.correctSessionLearning).toHaveBeenCalledWith({
      session_id: session.id,
      session_note: 'QA ghi chú đã sửa',
      lesson_youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
      students: [{
        student_id: 'qa-student-1', status: 'LATE', late_minutes: 7, absence_reason: null,
        homework_score: 8.5, homework_note: 'QA BTVN', understanding_score: 4, attitude_score: 5,
        positive_feedback_count: 2, positive_feedback_raw: 'QA tích cực', comment: 'QA nhận xét',
      }],
    })
    expect(mockState.toastSuccess).toHaveBeenCalledWith('Đã lưu nội dung buổi học, điểm danh và đánh giá.')
  })

  it('preserves unsaved learning edits when the schedule group is saved', async () => {
    const originalDate = addCalendarDays(getBusinessDateKey(new Date()), -2)
    const movedDate = addCalendarDays(originalDate, -1)
    const session = { ...makeSession('qa-session-independent-save', 'Lớp Lưu riêng QA', '10:00', '12:00', originalDate), status: 'COMPLETED' as const }
    const updatedSession = {
      ...session,
      scheduled_start_at: `${movedDate}T10:00:00+07:00`,
      scheduled_end_at: `${movedDate}T12:00:00+07:00`,
    }
    const sourceRow = {
      student_id: 'qa-student-independent-save',
      students: { full_name: 'QA Học sinh Lưu riêng', student_code: 'QA-ST-SAVE' },
      assessment_snapshot: {},
      student_attendances: [{ status: 'PRESENT', homework_score: 6 }],
    }
    mockState.getMySessions.mockReset().mockResolvedValueOnce([session]).mockResolvedValueOnce([updatedSession])
    mockState.getSessionStudents.mockReset().mockResolvedValue([sourceRow])
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()
    await clickButtonWithText(wrapper, 'Sửa nội dung, điểm danh và đánh giá')
    await getPageOrBody(wrapper, '#admin-session-note').setValue('QA ghi chú chưa lưu')
    await getPageOrBody(wrapper, '#admin-homework-qa-student-independent-save').setValue('8')
    const scheduleInputs = findAllPageOrBody(wrapper, 'input[type="datetime-local"]')
    await scheduleInputs[0].setValue(`${movedDate}T10:00`)
    await scheduleInputs[1].setValue(`${movedDate}T12:00`)
    await clickButtonWithText(wrapper, 'Lưu thông tin buổi học')
    await flushPromises()

    expect(mockState.correctSessionSchedule).toHaveBeenCalledOnce()
    expect(mockState.getSessionStudents).toHaveBeenCalledOnce()
    expect((getPageOrBody(wrapper, '#admin-session-note').element as HTMLTextAreaElement).value).toBe('QA ghi chú chưa lưu')
    expect((getPageOrBody(wrapper, '#admin-homework-qa-student-independent-save').element as HTMLInputElement).value).toBe('8')
    const saveLearningButton = findAllPageOrBody(wrapper, 'button').find((button) => button.text().trim() === 'Lưu nội dung và kết quả')
    expect(saveLearningButton?.attributes('disabled')).toBeUndefined()
  })

  it('preserves unsaved learning edits when the teacher assignment group is saved', async () => {
    const pastDate = addCalendarDays(getBusinessDateKey(new Date()), -2)
    const session = { ...makeSession('qa-session-teacher-independent-save', 'Lớp Giáo viên QA', '10:00', '12:00', pastDate, ['qa-teacher-1']), status: 'COMPLETED' as const }
    const updatedSession = {
      ...session,
      session_staff: [
        ...(session.session_staff || []),
        { staff_id: 'qa-teacher-2', assignment_role: 'TEACHER' as const, staff: { id: 'qa-teacher-2', full_name: 'Giáo viên QA 2' } },
      ],
    }
    const sourceRow = {
      student_id: 'qa-student-teacher-independent',
      students: { full_name: 'QA Học sinh Giáo viên', student_code: 'QA-ST-TEACHER' },
      assessment_snapshot: {},
      student_attendances: [{ status: 'PRESENT', homework_score: 6 }],
    }
    mockState.getMySessions.mockReset().mockResolvedValueOnce([session]).mockResolvedValueOnce([updatedSession])
    mockState.getSessionStudents.mockReset().mockResolvedValue([sourceRow])
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()
    await clickButtonWithText(wrapper, 'Sửa nội dung, điểm danh và đánh giá')
    await getPageOrBody(wrapper, '#admin-session-note').setValue('QA ghi chú chưa lưu')
    await getPageOrBody(wrapper, '#admin-homework-qa-student-teacher-independent').setValue('8')
    await chooseTeacher(wrapper, 'session-detail-teachers', 'qa-teacher-2')
    await clickButtonWithText(wrapper, 'Lưu phân công buổi này')
    await flushPromises()

    expect(mockState.updateSessionTeachers).toHaveBeenCalledWith({ session_id: session.id, staff_ids: ['qa-teacher-1', 'qa-teacher-2'] })
    expect(mockState.getSessionStudents).toHaveBeenCalledOnce()
    expect((getPageOrBody(wrapper, '#admin-session-note').element as HTMLTextAreaElement).value).toBe('QA ghi chú chưa lưu')
    expect((getPageOrBody(wrapper, '#admin-homework-qa-student-teacher-independent').element as HTMLInputElement).value).toBe('8')
  })

  it('keeps learning edits and prevents roster sync until those edits are saved', async () => {
    const pastDate = addCalendarDays(getBusinessDateKey(new Date()), -1)
    const session = { ...makeSession('qa-session-roster-guard', 'Lớp Roster QA', '10:00', '12:00', pastDate), status: 'COMPLETED' as const }
    const sourceRow = {
      student_id: 'qa-student-roster-guard',
      students: { full_name: 'QA Học sinh Roster', student_code: 'QA-ST-ROSTER' },
      assessment_snapshot: {},
      student_attendances: [{ status: 'PRESENT', homework_score: 6 }],
    }
    mockState.getMySessions.mockResolvedValue([session])
    mockState.getSessionStudents.mockResolvedValue([sourceRow])
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()
    await clickButtonWithText(wrapper, 'Sửa nội dung, điểm danh và đánh giá')
    await getPageOrBody(wrapper, '#admin-homework-qa-student-roster-guard').setValue('9')
    await clickButtonWithText(wrapper, 'Đồng bộ học sinh theo lớp')

    expect(pageAndBodyText(wrapper)).toContain('Hãy lưu nội dung, điểm danh và đánh giá đang sửa trước khi thay đổi danh sách học sinh.')
    expect(findAllPageOrBody(wrapper, '.app-modal').some((modal) => modal.text().includes('Đồng bộ học sinh của buổi học?'))).toBe(false)
    expect((getPageOrBody(wrapper, '#admin-homework-qa-student-roster-guard').element as HTMLInputElement).value).toBe('9')
  })

  it('requires an attendance status and retains edits after a failed historical correction', async () => {
    const pastDate = addCalendarDays(getBusinessDateKey(new Date()), -1)
    const session = { ...makeSession('qa-session-learning-error', 'Lớp Lỗi QA', '10:00', '12:00', pastDate), status: 'COMPLETED' as const }
    const sourceRow = {
      student_id: 'qa-student-2',
      students: { full_name: 'QA Học sinh Hai', student_code: 'QA-ST-002' },
      assessment_snapshot: {},
      student_attendances: [],
    }
    mockState.getMySessions.mockResolvedValue([session])
    mockState.getSessionStudents.mockResolvedValue([sourceRow])
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Hiện lịch sử')
    await wrapper.get('.calendar-event').trigger('click')
    await flushPromises()
    await clickButtonWithText(wrapper, 'Sửa nội dung, điểm danh và đánh giá')
    const homework = getPageOrBody(wrapper, '#admin-homework-qa-student-2')
    await homework.setValue('8')
    await clickButtonWithText(wrapper, 'Lưu nội dung và kết quả')
    expect(pageAndBodyText(wrapper)).toContain('Chọn trạng thái điểm danh.')
    expect(mockState.correctSessionLearning).not.toHaveBeenCalled()

    await getPageOrBody(wrapper, '#admin-attendance-status-qa-student-2').setValue('PRESENT')
    mockState.correctSessionLearning.mockRejectedValueOnce(new Error('QA correction failure'))
    await clickButtonWithText(wrapper, 'Lưu nội dung và kết quả')
    await flushPromises()
    expect((getPageOrBody(wrapper, '#admin-homework-qa-student-2').element as HTMLInputElement).value).toBe('8')
    expect(pageAndBodyText(wrapper)).toContain('Không thể lưu nội dung buổi học, điểm danh và đánh giá.')
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

    await clickButtonWithText(wrapper, 'Lưu thông tin buổi học')
    expect(mockState.correctSessionSchedule).toHaveBeenCalledWith(expect.objectContaining({ session_id: session.id, start: expect.any(String), end: expect.any(String) }))

    await clickButtonWithText(wrapper, 'Hủy buổi học')
    const confirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('Buổi học sẽ được đánh dấu đã hủy'))
    if (!confirmation) throw new Error('Cancel confirmation dialog not found')
    await confirmation.get('.btn-danger').trigger('click')
    expect(mockState.updateSessionOccurrence).toHaveBeenLastCalledWith({ session_id: session.id, cancel: true, room: null })
  })

  it('creates a seven-day editable template and confirms replacement across the selected month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T12:00:00+07:00'))
    const wrapper = mountPage()
    await flushPromises()

    await clickButtonWithText(wrapper, 'Tạo lịch mẫu')
    expect(findAllPageOrBody(wrapper, '.weekly-template-day')).toHaveLength(7)
    expect(pageAndBodyText(wrapper)).toContain('Thứ Hai')
    expect(pageAndBodyText(wrapper)).toContain('Chủ nhật')

    const weekdays = findAllPageOrBody(wrapper, '.weekly-template-day')
    await weekdays[0].get('button').trigger('click')
    await weekdays[1].get('button').trigger('click')
    const rows = findAllPageOrBody(wrapper, '.weekly-template-slot')
    const mondaySlotId = findPageOrBody(wrapper, '.weekly-template-day .weekly-template-slot select').attributes('id')!.replace('weekly-template-class-', '')
    const tuesdaySlotId = findPageOrBody(wrapper, '.weekly-template-day:nth-child(2) .weekly-template-slot select').attributes('id')!.replace('weekly-template-class-', '')

    await getPageOrBody(wrapper, `#weekly-template-class-${mondaySlotId}`).setValue('qa-class-1')
    await getPageOrBody(wrapper, `#weekly-template-room-${mondaySlotId}`).setValue('QA-A1')
    await getPageOrBody(wrapper, `#weekly-template-start-${mondaySlotId}`).setValue('17:30')
    await getPageOrBody(wrapper, `#weekly-template-end-${mondaySlotId}`).setValue('19:30')
    await chooseTeacher(wrapper, `weekly-template-teachers-${mondaySlotId}`, 'qa-teacher-1')
    await getPageOrBody(wrapper, `#weekly-template-class-${tuesdaySlotId}`).setValue('qa-class-2')
    await getPageOrBody(wrapper, `#weekly-template-room-${tuesdaySlotId}`).setValue('QA-B1')
    await getPageOrBody(wrapper, `#weekly-template-start-${tuesdaySlotId}`).setValue('18:00')
    await getPageOrBody(wrapper, `#weekly-template-end-${tuesdaySlotId}`).setValue('20:00')
    await chooseTeacher(wrapper, `weekly-template-teachers-${tuesdaySlotId}`, 'qa-teacher-2')

    expect(rows).toHaveLength(2)
    await clickButtonWithText(wrapper, 'Xem phạm vi thay lịch')
    await flushPromises()

    const confirmation = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('Thay toàn bộ lịch tháng'))
    if (!confirmation) throw new Error('Month replacement confirmation was not opened')
    expect(confirmation.text()).toContain('Thay toàn bộ lịch tháng 10 năm 2026?')
    expect(confirmation.text()).toContain('tất cả lớp')
    expect(confirmation.text()).toContain('đang diễn ra')
    expect(confirmation.text()).toContain('10 buổi mới sẽ được tạo')
    expect(mockState.previewMonthWeekTemplateReplacement).toHaveBeenCalledWith('2026-10-01', [
      { day_of_week: 1, class_id: 'qa-class-1', start_time: '17:30', end_time: '19:30', room: 'QA-A1', staff_ids: ['qa-teacher-1'] },
      { day_of_week: 2, class_id: 'qa-class-2', start_time: '18:00', end_time: '20:00', room: 'QA-B1', staff_ids: ['qa-teacher-2'] },
    ])

    await clickButtonWithText(wrapper, 'Xóa lịch cũ và tạo lịch mới')
    await flushPromises()
    expect(mockState.replaceMonthWithWeekTemplate).toHaveBeenCalledWith('2026-10-01', [
      { day_of_week: 1, class_id: 'qa-class-1', start_time: '17:30', end_time: '19:30', room: 'QA-A1', staff_ids: ['qa-teacher-1'] },
      { day_of_week: 2, class_id: 'qa-class-2', start_time: '18:00', end_time: '20:00', room: 'QA-B1', staff_ids: ['qa-teacher-2'] },
    ])
    expect(mockState.toastSuccess).toHaveBeenCalledWith('Đã xóa 6 buổi cũ và tạo 10 buổi mới cho tháng 10 năm 2026.')
  })

  it('returns to the editor and preserves the template when replacement fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T12:00:00+07:00'))
    mockState.replaceMonthWithWeekTemplate.mockRejectedValue(new Error('SCHEDULE_CONFLICT'))
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Tạo lịch mẫu')
    const monday = findAllPageOrBody(wrapper, '.weekly-template-day')[0]
    await monday.get('button').trigger('click')
    const slotId = findPageOrBody(wrapper, '.weekly-template-day .weekly-template-slot select').attributes('id')!.replace('weekly-template-class-', '')
    await getPageOrBody(wrapper, `#weekly-template-class-${slotId}`).setValue('qa-class-1')
    await getPageOrBody(wrapper, `#weekly-template-start-${slotId}`).setValue('17:30')
    await getPageOrBody(wrapper, `#weekly-template-end-${slotId}`).setValue('19:30')
    await chooseTeacher(wrapper, `weekly-template-teachers-${slotId}`, 'qa-teacher-1')
    await clickButtonWithText(wrapper, 'Xem phạm vi thay lịch')
    await flushPromises()
    await clickButtonWithText(wrapper, 'Xóa lịch cũ và tạo lịch mới')
    await flushPromises()

    expect(findAllPageOrBody(wrapper, '.weekly-template-slot')).toHaveLength(1)
    expect(pageAndBodyText(wrapper)).toContain('Không thể xếp lịch vì lớp hoặc học sinh đã có buổi học trùng giờ.')
    expect(mockState.toastError).toHaveBeenCalledWith('Không thể xếp lịch vì lớp hoặc học sinh đã có buổi học trùng giờ.')
  })

  it('shows separate empty and error states with a retry action', async () => {
    mockState.getMySessions.mockResolvedValue([])
    const emptyPage = mountPage()
    await flushPromises()
    expect(emptyPage.text()).toContain('Chưa có buổi học nào.')
    await clickButtonWithText(emptyPage, 'Danh sách')
    expect(emptyPage.find('.session-list').text()).toContain('Chưa có buổi học nào.')

    mockState.getMySessions.mockRejectedValue(new Error('Không thể kết nối.'))
    const failedPage = mountPage()
    await flushPromises()
    expect(failedPage.text()).toContain('Không thể kết nối.')
    expect(failedPage.text()).not.toContain('Chưa có buổi học nào.')
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
    expect(wrapper.text()).not.toContain('Chưa có buổi học nào.')
    await clickButtonWithText(wrapper, 'Danh sách')
    expect(wrapper.text()).toContain('Đang tải buổi học…')
    expect(wrapper.text()).not.toContain('Chưa có buổi học nào.')

    resolveSessions([])
    await flushPromises()
    expect(wrapper.text()).toContain('Chưa có buổi học nào.')
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

  it('reports that creation succeeded when the refresh request fails', async () => {
    mockState.getMySessions.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Không thể kết nối sau khi tạo.'))
    const wrapper = mountPage()
    await flushPromises()
    await clickButtonWithText(wrapper, 'Thêm buổi')
    await getPageOrBody(wrapper, '#session-class').setValue('qa-class-1')
    await getPageOrBody(wrapper, '#session-date').setValue(addCalendarDays(getBusinessDateKey(new Date()), 2))
    await flushPromises()
    await chooseTeacher(wrapper, 'session-teachers', 'qa-teacher-1')
    await getPageOrBody(wrapper, '.session-create-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.app-state--error').text()).toContain('Buổi học đã được tạo nhưng không tải lại được danh sách.')
    expect(wrapper.text()).not.toContain('Chưa có buổi học nào.')
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
    const session = {
      ...makeSession('qa-room-session', 'Lớp Toán QA', '10:00', '12:00', addCalendarDays(getBusinessDateKey(new Date()), 1)),
      room: 'QA-Room-A',
    }
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
    await clickButtonWithText(wrapper, 'Lưu thông tin buổi học')

    expect(mockState.correctSessionSchedule).toHaveBeenCalledWith(expect.objectContaining({
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
