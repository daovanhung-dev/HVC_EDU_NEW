import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    const wrapper = mount(StaffTimesheetsPage)
    await flushPromises()

    expect(wrapper.text()).toContain('QA class')
    await wrapper.get('textarea').setValue('QA attendance completed')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.submitTimesheet).toHaveBeenCalledWith({ session_id: 'qa-session', notes: 'QA attendance completed' })
    expect(wrapper.text()).toContain('Đã gửi chấm công, đang chờ Admin duyệt.')
  })

  it('allows resubmission after rejection, but not after approval', async () => {
    mocks.getMyTimesheets.mockResolvedValue([{
      id: 'qa-timesheet', session_id: 'qa-session', staff_id: 'qa-teacher', status: 'REJECTED',
      submitted_at: '2026-09-30T10:00:00Z', approved_at: null, approved_by: null,
      rejection_reason: 'QA: bổ sung thông tin', notes: null,
    }])
    const wrapper = mount(StaffTimesheetsPage)
    await flushPromises()
    expect(wrapper.text()).toContain('Gửi lại chấm công')
    expect(wrapper.text()).toContain('QA: bổ sung thông tin')

    mocks.getMyTimesheets.mockResolvedValue([{ id: 'qa-approved', session_id: 'qa-session', staff_id: 'qa-teacher', status: 'APPROVED' }])
    await wrapper.findAll('button').find((button) => button.text() === 'Làm mới')?.trigger('click')
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
