import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast.store'
import StaffTimesheetsPage from './StaffTimesheetsPage.vue'

const mocks = vi.hoisted(() => ({
  getMySessions: vi.fn(),
  getMyStaff: vi.fn(),
  getMyTimesheets: vi.fn(),
  submitTimesheet: vi.fn(),
}))

vi.mock('@/services/data-queries', () => ({ getMySessions: mocks.getMySessions, getMyStaff: mocks.getMyStaff, getMyTimesheets: mocks.getMyTimesheets }))
vi.mock('@/services/commands', () => ({ submitTimesheet: mocks.submitTimesheet }))

describe('StaffTimesheetsPage', () => {
  beforeEach(() => {
    mocks.getMySessions.mockReset().mockResolvedValue([{
      id: 'qa-session', class_id: 'qa-class', scheduled_start_at: '2026-09-30T10:00:00+07:00',
      scheduled_end_at: '2026-09-30T12:00:00+07:00', status: 'COMPLETED',
      session_note: null, classes: { name: 'QA class' },
      session_staff: [{ staff_id: 'qa-teacher', assignment_role: 'TEACHER', timesheet_eligible: null }],
    }])
    mocks.getMyStaff.mockReset().mockResolvedValue({ id: 'qa-teacher' })
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

  it('shows an admin no-pay decision and hides the teacher submission form', async () => {
    mocks.getMySessions.mockResolvedValue([{
      id: 'qa-session', class_id: 'qa-class', scheduled_start_at: '2026-09-30T10:00:00+07:00',
      scheduled_end_at: '2026-09-30T12:00:00+07:00', status: 'COMPLETED', session_note: null,
      classes: { name: 'QA class' }, session_staff: [{ staff_id: 'qa-teacher', assignment_role: 'TEACHER', timesheet_eligible: false }],
    }])
    const wrapper = mount(StaffTimesheetsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Không tính công')
    expect(wrapper.text()).toContain('Admin xác nhận buổi này không tính công cho bạn.')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(mocks.submitTimesheet).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows revoked admin timesheets as history with the revocation reason', async () => {
    mocks.getMyTimesheets.mockResolvedValue([{
      id: 'qa-revoked', session_id: 'qa-session', staff_id: 'qa-teacher', status: 'REVOKED',
      submitted_at: '2026-09-30T10:00:00Z', approved_at: '2026-09-30T12:00:00Z', approved_by: 'qa-admin',
      rejection_reason: null, revoked_at: '2026-10-01T12:00:00Z', revoked_by: 'qa-admin',
      revoked_reason: 'Admin xác nhận buổi học không tính công.', notes: null,
    }])
    const wrapper = mount(StaffTimesheetsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Đã thu hồi công')
    expect(wrapper.text()).toContain('Admin xác nhận buổi học không tính công.')
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
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

  it('shows a retryable load error instead of an empty completed-session state', async () => {
    mocks.getMySessions.mockRejectedValueOnce(new Error('QA session load failure'))
    const wrapper = mount(StaffTimesheetsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.find('.app-state--error').text()).toContain('Không thể tải dữ liệu chấm công.')
    expect(wrapper.text()).not.toContain('Chưa có buổi học hoàn tất')
    await wrapper.find('.app-state--error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('QA class')
    wrapper.unmount()
  })
})
