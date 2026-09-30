import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast.store'
import StaffTimesheetsPage from './StaffTimesheetsPage.vue'

const mocks = vi.hoisted(() => ({
  getMySessions: vi.fn(),
  getMyTimesheets: vi.fn(),
  submitTimesheet: vi.fn(),
}))

vi.mock('@/services/data-queries', () => ({ getMySessions: mocks.getMySessions, getMyTimesheets: mocks.getMyTimesheets }))
vi.mock('@/services/commands', () => ({ submitTimesheet: mocks.submitTimesheet }))

describe('StaffTimesheetsPage', () => {
  beforeEach(() => {
    mocks.getMySessions.mockReset().mockResolvedValue([{
      id: 'qa-session', class_id: 'qa-class', scheduled_start_at: '2026-09-30T10:00:00+07:00',
      scheduled_end_at: '2026-09-30T12:00:00+07:00', status: 'COMPLETED',
      session_note: null, classes: { name: 'QA class' },
    }])
    mocks.getMyTimesheets.mockReset().mockResolvedValue([])
    mocks.submitTimesheet.mockReset().mockResolvedValue({ timesheet_id: 'qa-timesheet', status: 'PENDING' })
  })

  it('allows the assigned teacher to submit a completed session for review', async () => {
    const pinia = createPinia()
    const wrapper = mount(StaffTimesheetsPage, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('QA class')
    await wrapper.get('textarea').setValue('QA attendance completed')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.submitTimesheet).toHaveBeenCalledWith({ session_id: 'qa-session', notes: 'QA attendance completed' })
    expect(useToastStore(pinia).items.map((item) => item.message)).toContain('Đã gửi chấm công, đang chờ Admin duyệt.')
  })

  it('allows resubmission after rejection, but not after approval', async () => {
    mocks.getMyTimesheets.mockResolvedValue([{
      id: 'qa-timesheet', session_id: 'qa-session', staff_id: 'qa-teacher', status: 'REJECTED',
      submitted_at: '2026-09-30T10:00:00Z', approved_at: null, approved_by: null,
      rejection_reason: 'QA: bổ sung thông tin', notes: null,
    }])
    const wrapper = mount(StaffTimesheetsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Gửi lại chấm công')
    expect(wrapper.text()).toContain('QA: bổ sung thông tin')

    mocks.getMyTimesheets.mockResolvedValue([{ id: 'qa-approved', session_id: 'qa-session', staff_id: 'qa-teacher', status: 'APPROVED' }])
    await wrapper.findAll('button').find((button) => button.text() === 'Làm mới')?.trigger('click')
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('locks duplicate submissions while the request is pending', async () => {
    let finishSubmission: (value: unknown) => void = () => undefined
    mocks.submitTimesheet.mockImplementation(() => new Promise((resolve) => { finishSubmission = resolve }))
    const wrapper = mount(StaffTimesheetsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const form = wrapper.get('form')
    await form.trigger('submit')
    const submitButton = form.get('button')
    expect(submitButton.attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    expect(mocks.submitTimesheet).toHaveBeenCalledTimes(1)

    finishSubmission({ timesheet_id: 'qa-timesheet', status: 'PENDING' })
    await flushPromises()
    expect(wrapper.get('form button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps the note and announces an error when submission fails', async () => {
    mocks.submitTimesheet.mockRejectedValue(new Error('QA: không thể gửi chấm công'))
    const wrapper = mount(StaffTimesheetsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()
    await wrapper.get('textarea').setValue('QA: ghi chú giữ lại')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Không thể gửi chấm công.')
    expect(wrapper.get('[role="alert"]').text()).not.toContain('QA: không thể gửi chấm công')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('QA: ghi chú giữ lại')
    wrapper.unmount()
  })
})
