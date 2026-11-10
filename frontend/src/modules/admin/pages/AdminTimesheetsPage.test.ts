import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast.store'
import type { TimesheetRow, TimesheetStatus } from '@/shared/types/domain'
import { formatBusinessMonth, getBusinessDateKey, shiftCalendarMonth } from '@/shared/utils/session-calendar'
import AdminTimesheetsPage from './AdminTimesheetsPage.vue'

const mocks = vi.hoisted(() => ({ getTimesheets: vi.fn(), reviewTimesheet: vi.fn() }))
vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    constructor(private readonly element: HTMLElement) {}
    show() { this.element.classList.add('show'); this.element.setAttribute('aria-hidden', 'false') }
    hide() {
      const event = new Event('hide.bs.modal', { cancelable: true })
      this.element.dispatchEvent(event)
      if (event.defaultPrevented) return
      this.element.classList.remove('show')
      this.element.setAttribute('aria-hidden', 'true')
      this.element.dispatchEvent(new Event('hidden.bs.modal'))
    }
    dispose() {}
  },
}))
vi.mock('@/services/data-queries', () => ({ getTimesheets: mocks.getTimesheets }))
vi.mock('@/services/commands', () => ({ reviewTimesheet: mocks.reviewTimesheet }))

function getPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.find(selector).exists() ? wrapper.get(selector) : new DOMWrapper(document.body).get(selector)
}

function allButtons(wrapper: ReturnType<typeof mount>) {
  return [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
}

function makeTimesheet(id: string, status: TimesheetStatus, scheduledStartAt: string): TimesheetRow {
  const scheduledStart = new Date(scheduledStartAt)
  const scheduledEndAt = new Date(scheduledStart.getTime() + 60 * 60 * 1000).toISOString()
  return {
    id,
    session_id: `qa-session-${id}`,
    staff_id: `qa-teacher-${id}`,
    status,
    submitted_at: scheduledStartAt,
    approved_at: status === 'APPROVED' ? scheduledEndAt : null,
    approved_by: status === 'APPROVED' ? 'qa-admin' : null,
    rejection_reason: status === 'REJECTED' ? 'QA: cần bổ sung thông tin' : null,
    revoked_reason: status === 'REVOKED' ? 'QA: buổi không tính công' : null,
    notes: `QA note ${id}`,
    sessions: {
      id: `qa-session-${id}`,
      scheduled_start_at: scheduledStartAt,
      scheduled_end_at: scheduledEndAt,
      status: 'COMPLETED',
      classes: { name: `QA class ${id}` },
    },
    staff: { id: `qa-teacher-${id}`, staff_code: `QA-T-${id}`, full_name: `QA teacher ${id}` },
  }
}

const mountedWrappers: Array<{ unmount: () => void }> = []
const qaTimesheets: TimesheetRow[] = []

function track<T extends { unmount: () => void }>(wrapper: T) {
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountPage() {
  return track(mount(AdminTimesheetsPage, { global: { plugins: [createPinia()] } }))
}

function clickButtonWithText(wrapper: ReturnType<typeof mount>, label: string) {
  const button = allButtons(wrapper).find((item) => item.text().trim() === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button.trigger('click')
}

describe('AdminTimesheetsPage', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
    document.body.classList.remove('modal-open')
  })

  beforeEach(() => {
    const today = getBusinessDateKey(new Date())
    qaTimesheets.splice(0, qaTimesheets.length, makeTimesheet('pending', 'PENDING', `${today}T10:00:00+07:00`))
    mocks.getTimesheets.mockReset().mockImplementation(async () => structuredClone(qaTimesheets))
    mocks.reviewTimesheet.mockReset().mockImplementation(async (input: { timesheet_id: string; approve: boolean; reason?: string | null }) => {
      const row = qaTimesheets.find((item) => item.id === input.timesheet_id)
      if (row) {
        row.status = input.approve ? 'APPROVED' : 'REJECTED'
        row.rejection_reason = input.reason || null
      }
      return { timesheet_id: input.timesheet_id, status: input.approve ? 'APPROVED' : 'REJECTED' }
    })
  })

  it('opens the current month with the earliest pending date selected and marks pending counts red', async () => {
    const today = getBusinessDateKey(new Date())
    const monthStart = `${today.slice(0, 7)}-01`
    const laterPendingDate = `${today.slice(0, 7)}-03`
    const boundaryUtcDate = new Date(`${monthStart}T00:30:00+07:00`).toISOString().slice(0, 10)
    qaTimesheets.splice(0, qaTimesheets.length,
      makeTimesheet('boundary-pending-1', 'PENDING', `${boundaryUtcDate}T17:30:00.000Z`),
      makeTimesheet('boundary-pending-2', 'PENDING', `${monthStart}T01:30:00+07:00`),
      makeTimesheet('later-pending', 'PENDING', `${laterPendingDate}T10:00:00+07:00`),
      makeTimesheet('approved-only-day', 'APPROVED', `${today.slice(0, 7)}-04T10:00:00+07:00`),
    )
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.timesheet-calendar').exists()).toBe(true)
    expect(wrapper.get('.timesheet-calendar-period').text()).toBe(formatBusinessMonth(today))
    expect(wrapper.findAll('.timesheet-calendar-cell--pending')).toHaveLength(2)
    expect(wrapper.get(`[data-date="${monthStart}"] .timesheet-calendar-count`).text()).toBe('2 chờ duyệt')
    expect(wrapper.get(`[data-date="${laterPendingDate}"] .timesheet-calendar-count`).text()).toBe('1 chờ duyệt')
    expect(wrapper.get(`[data-date="${monthStart}"] button`).attributes('aria-pressed')).toBe('true')
    expect(wrapper.get(`[data-date="${monthStart}"] button`).attributes('aria-label')).toContain('2 yêu cầu chờ duyệt')
    expect(wrapper.find(`[data-date="${today.slice(0, 7)}-04"]`).classes()).not.toContain('timesheet-calendar-cell--pending')
    expect(wrapper.find('.timesheet-calendar-grid').exists()).toBe(true)
  })

  it('groups a UTC boundary timestamp on its Ho Chi Minh business date', async () => {
    const today = getBusinessDateKey(new Date())
    const monthStart = `${today.slice(0, 7)}-01`
    const previousUtcDate = new Date(`${monthStart}T00:30:00+07:00`).toISOString().slice(0, 10)
    qaTimesheets.splice(0, qaTimesheets.length,
      makeTimesheet('utc-boundary', 'PENDING', `${previousUtcDate}T17:30:00.000Z`),
    )
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get(`[data-date="${monthStart}"] .timesheet-calendar-count`).text()).toBe('1 chờ duyệt')
    expect(wrapper.find(`[data-date="${previousUtcDate}"] .timesheet-calendar-count`).exists()).toBe(false)
  })

  it('shows every status for a selected date and keeps approval actions only for pending rows', async () => {
    const today = getBusinessDateKey(new Date())
    const approvedDate = `${today.slice(0, 7)}-04`
    qaTimesheets.splice(0, qaTimesheets.length,
      makeTimesheet('day-pending', 'PENDING', `${today}T09:00:00+07:00`),
      makeTimesheet('day-approved', 'APPROVED', `${today}T11:00:00+07:00`),
      makeTimesheet('approved-only', 'APPROVED', `${approvedDate}T10:00:00+07:00`),
      makeTimesheet('rejected-only', 'REJECTED', `${approvedDate}T12:00:00+07:00`),
      makeTimesheet('revoked-only', 'REVOKED', `${approvedDate}T14:00:00+07:00`),
    )
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get(`[data-date="${approvedDate}"] button`).trigger('click')
    expect(wrapper.text()).toContain('QA class approved-only')
    expect(wrapper.text()).toContain('Đã duyệt')
    expect(wrapper.text()).toContain('Bị từ chối')
    expect(wrapper.text()).toContain('Đã thu hồi công')
    expect(wrapper.findAll('button').some((button) => ['Duyệt', 'Từ chối'].includes(button.text().trim()))).toBe(false)

    await wrapper.get(`[data-date="${today}"] button`).trigger('click')
    expect(wrapper.text()).toContain('QA class day-pending')
    expect(wrapper.text()).toContain('QA class day-approved')
    expect(wrapper.findAll('button').some((button) => button.text().trim() === 'Duyệt')).toBe(true)
  })

  it('falls back to today when the current month has no pending request and preserves the full list view', async () => {
    const today = getBusinessDateKey(new Date())
    qaTimesheets.splice(0, qaTimesheets.length,
      makeTimesheet('approved', 'APPROVED', `${today}T10:00:00+07:00`),
      makeTimesheet('rejected', 'REJECTED', `${today}T12:00:00+07:00`),
    )
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get(`[data-date="${today}"] button`).attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.timesheet-calendar-cell--pending')).toHaveLength(0)
    expect(wrapper.get(`[data-date="${today}"] .timesheet-calendar-count`).text()).toBe('2 yêu cầu')

    await clickButtonWithText(wrapper, 'Danh sách')
    expect(wrapper.find('.timesheet-calendar').exists()).toBe(false)
    expect(wrapper.findAll('.timesheet-review-table tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Đã duyệt')
    expect(wrapper.text()).toContain('Bị từ chối')
  })

  it('navigates to another month and selects its earliest pending date', async () => {
    const today = getBusinessDateKey(new Date())
    const nextMonth = shiftCalendarMonth(today, 1)
    const pendingDate = `${nextMonth.slice(0, 7)}-05`
    qaTimesheets.splice(0, qaTimesheets.length,
      makeTimesheet('next-month-pending', 'PENDING', `${pendingDate}T10:00:00+07:00`),
    )
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('button[aria-label="Tháng sau"]').trigger('click')
    expect(wrapper.get('.timesheet-calendar-period').text()).toBe(formatBusinessMonth(nextMonth))
    expect(wrapper.get(`[data-date="${pendingDate}"] button`).attributes('aria-pressed')).toBe('true')
    expect(wrapper.get(`[data-date="${pendingDate}"] .timesheet-calendar-count`).text()).toBe('1 chờ duyệt')

    await clickButtonWithText(wrapper, 'Tháng hiện tại')
    expect(wrapper.get('.timesheet-calendar-period').text()).toBe(formatBusinessMonth(today))
    expect(wrapper.get(`[data-date="${today}"] button`).attributes('aria-pressed')).toBe('true')
  })

  it('requires a reason for rejection, submits the review decision, and refreshes the pending marker', async () => {
    const today = getBusinessDateKey(new Date())
    const pinia = createPinia()
    const wrapper = track(mount(AdminTimesheetsPage, { global: { plugins: [pinia] } }))
    await flushPromises()
    expect(wrapper.text()).toContain('QA class pending')
    expect(wrapper.get(`[data-date="${today}"] .timesheet-calendar-count`).text()).toBe('1 chờ duyệt')

    await allButtons(wrapper).find((button) => button.text() === 'Từ chối')?.trigger('click')
    expect(getPageOrBody(wrapper, 'textarea[required]').exists()).toBe(true)
    expect(mocks.reviewTimesheet).not.toHaveBeenCalled()
    await getPageOrBody(wrapper, 'textarea[required]').setValue('QA: lý do xác nhận')
    await allButtons(wrapper).find((button) => button.text() === 'Hủy')?.trigger('click')

    await allButtons(wrapper).find((button) => button.text() === 'Duyệt')?.trigger('click')
    await allButtons(wrapper).find((button) => button.text() === 'Duyệt chấm công')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'pending', approve: true, reason: null })
    expect(useToastStore(pinia).items.map((item) => item.message)).toContain('Đã duyệt chấm công.')
    expect(wrapper.findAll('.timesheet-calendar-cell--pending')).toHaveLength(0)
    expect(wrapper.find('.timesheet-review-table').text()).toContain('Đã duyệt')
  })

  it('shows revoked timesheet history without review actions', async () => {
    const today = getBusinessDateKey(new Date())
    qaTimesheets.splice(0, qaTimesheets.length, makeTimesheet('revoked', 'REVOKED', `${today}T10:00:00+07:00`))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Đã thu hồi công')
    expect(wrapper.text()).toContain('QA: buổi không tính công')
    expect(wrapper.findAll('button').some((button) => ['Duyệt', 'Từ chối'].includes(button.text().trim()))).toBe(false)
  })

  it('sends the required rejection reason to the review command', async () => {
    const pinia = createPinia()
    const wrapper = track(mount(AdminTimesheetsPage, { global: { plugins: [pinia] } }))
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Từ chối')?.trigger('click')
    await getPageOrBody(wrapper, 'textarea[required]').setValue('QA: cần bổ sung ghi chú')
    await allButtons(wrapper).find((button) => button.text() === 'Từ chối chấm công')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'pending', approve: false, reason: 'QA: cần bổ sung ghi chú' })
    expect(useToastStore(pinia).items.map((item) => item.message)).toContain('Đã từ chối chấm công.')
  })

  it('shows a retryable error instead of an empty calendar when loading fails', async () => {
    mocks.getTimesheets.mockRejectedValueOnce(new Error('QA timesheet failure'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.app-state--error').text()).toContain('Không thể tải danh sách chấm công.')
    expect(wrapper.text()).not.toContain('Ngày này chưa có yêu cầu chấm công')
    await wrapper.find('.app-state--error button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.timesheet-calendar').exists()).toBe(true)
    expect(wrapper.text()).toContain('QA class pending')
  })

  it('shows an empty day and keeps the calendar available when there are no timesheets', async () => {
    mocks.getTimesheets.mockResolvedValueOnce([])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.timesheet-calendar-grid').exists()).toBe(true)
    expect(wrapper.find('.timesheet-day-details').text()).toContain('Ngày này chưa có yêu cầu chấm công')
    await clickButtonWithText(wrapper, 'Danh sách')
    expect(wrapper.find('.app-state--empty').text()).toContain('Chưa có yêu cầu chấm công')
  })
})
