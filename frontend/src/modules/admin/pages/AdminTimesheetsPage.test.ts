import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminTimesheetsPage from './AdminTimesheetsPage.vue'

const mocks = vi.hoisted(() => ({ getTimesheets: vi.fn(), reviewTimesheet: vi.fn() }))
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
    const wrapper = mount(AdminTimesheetsPage)
    await flushPromises()
    expect(wrapper.text()).toContain('QA class')

    await wrapper.findAll('button').find((button) => button.text() === 'Từ chối')?.trigger('click')
    expect(wrapper.text()).toContain('Nhập lý do trước khi từ chối chấm công.')
    expect(mocks.reviewTimesheet).not.toHaveBeenCalled()

    await wrapper.findAll('button').find((button) => button.text() === 'Duyệt')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'qa-timesheet', approve: true, reason: null })
    expect(wrapper.text()).toContain('Đã duyệt chấm công.')
  })

  it('sends a required rejection reason to the review command', async () => {
    const wrapper = mount(AdminTimesheetsPage)
    await flushPromises()
    await wrapper.get('input[aria-label="Lý do từ chối"]').setValue('QA: cần bổ sung ghi chú')
    await wrapper.findAll('button').find((button) => button.text() === 'Từ chối')?.trigger('click')
    await flushPromises()
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith({ timesheet_id: 'qa-timesheet', approve: false, reason: 'QA: cần bổ sung ghi chú' })
    expect(wrapper.text()).toContain('Đã từ chối chấm công.')
  })
})
