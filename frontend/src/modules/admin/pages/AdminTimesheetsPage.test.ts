import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('AdminTimesheetsPage', () => {
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
    const wrapper = mount(AdminTimesheetsPage, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.text()).toContain('QA class')

    await wrapper.findAll('button').find((button) => button.text() === 'Từ chối')?.trigger('click')
    expect(wrapper.find('textarea[required]').exists()).toBe(true)
    expect(mocks.reviewTimesheet).not.toHaveBeenCalled()
    await wrapper.get('textarea[required]').setValue('QA: lý do xác nhận')
    await wrapper.findAll('button').find((button) => button.text() === 'Hủy')?.trigger('click')

    await wrapper.findAll('button').find((button) => button.text() === 'Duyệt')?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === 'Duyệt chấm công')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'qa-timesheet', approve: true, reason: null })
    expect(useToastStore(pinia).items.map((item) => item.message)).toContain('Đã duyệt chấm công.')
  })

  it('sends a required rejection reason to the review command', async () => {
    const pinia = createPinia()
    const wrapper = mount(AdminTimesheetsPage, { global: { plugins: [pinia] } })
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === 'Từ chối')?.trigger('click')
    await wrapper.get('textarea[required]').setValue('QA: cần bổ sung ghi chú')
    await wrapper.findAll('button').find((button) => button.text() === 'Từ chối chấm công')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'qa-timesheet', approve: false, reason: 'QA: cần bổ sung ghi chú' })
    expect(useToastStore(pinia).items.map((item) => item.message)).toContain('Đã từ chối chấm công.')
  })
})
