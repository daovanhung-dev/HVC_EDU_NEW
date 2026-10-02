import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast.store'
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

const mountedWrappers: Array<{ unmount: () => void }> = []

function track<T extends { unmount: () => void }>(wrapper: T) {
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('AdminTimesheetsPage', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
    document.body.classList.remove('modal-open')
  })

  beforeEach(() => {
    mocks.getTimesheets.mockReset().mockResolvedValue([{
      id: 'qa-timesheet', session_id: 'qa-session', staff_id: 'qa-teacher', status: 'PENDING',
      submitted_at: '2026-09-30T10:00:00Z', approved_at: null, approved_by: null,
      rejection_reason: null, notes: 'QA lesson complete',
      sessions: { id: 'qa-session', scheduled_start_at: '2026-09-30T10:00:00Z', scheduled_end_at: '2026-09-30T12:00:00Z', status: 'COMPLETED', classes: { name: 'QA class' } },
      staff: { id: 'qa-teacher', staff_code: 'QA-T-1', full_name: 'QA teacher' },
    }])
    mocks.reviewTimesheet.mockReset().mockResolvedValue({ timesheet_id: 'qa-timesheet', status: 'APPROVED' })
  })

  it('requires a reason for rejection and sends an approval decision', async () => {
    const pinia = createPinia()
    const wrapper = track(mount(AdminTimesheetsPage, { global: { plugins: [pinia] } }))
    await flushPromises()
    expect(wrapper.text()).toContain('QA class')

    await allButtons(wrapper).find((button) => button.text() === 'Từ chối')?.trigger('click')
    expect(getPageOrBody(wrapper, 'textarea[required]').exists()).toBe(true)
    expect(mocks.reviewTimesheet).not.toHaveBeenCalled()
    await getPageOrBody(wrapper, 'textarea[required]').setValue('QA: lý do xác nhận')
    await allButtons(wrapper).find((button) => button.text() === 'Hủy')?.trigger('click')

    await allButtons(wrapper).find((button) => button.text() === 'Duyệt')?.trigger('click')
    await allButtons(wrapper).find((button) => button.text() === 'Duyệt chấm công')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'qa-timesheet', approve: true, reason: null })
    expect(useToastStore(pinia).items.map((item) => item.message)).toContain('Đã duyệt chấm công.')
  })

  it('sends a required rejection reason to the review command', async () => {
    const pinia = createPinia()
    const wrapper = track(mount(AdminTimesheetsPage, { global: { plugins: [pinia] } }))
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Từ chối')?.trigger('click')
    await getPageOrBody(wrapper, 'textarea[required]').setValue('QA: cần bổ sung ghi chú')
    await allButtons(wrapper).find((button) => button.text() === 'Từ chối chấm công')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'qa-timesheet', approve: false, reason: 'QA: cần bổ sung ghi chú' })
    expect(useToastStore(pinia).items.map((item) => item.message)).toContain('Đã từ chối chấm công.')
  })
})
