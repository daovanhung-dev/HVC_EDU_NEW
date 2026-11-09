import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClassDetailPage from './ClassDetailPage.vue'

const mocks = vi.hoisted(() => ({
  getClassDetail: vi.fn(),
  getClassActiveMemberships: vi.fn(),
  getStudents: vi.fn(),
  addClassMembership: vi.fn(),
  updateClassMembership: vi.fn(),
  updateClassMembershipStartDateAndSyncFutureRosters: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

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

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ params: { classId: 'qa-class-1' } }),
}))

vi.mock('@/services/data-queries', () => ({
  getClassDetail: mocks.getClassDetail,
  getClassActiveMemberships: mocks.getClassActiveMemberships,
  getStudents: mocks.getStudents,
}))

vi.mock('@/services/commands', () => ({
  addClassMembership: mocks.addClassMembership,
  updateClassMembership: mocks.updateClassMembership,
  updateClassMembershipStartDateAndSyncFutureRosters: mocks.updateClassMembershipStartDateAndSyncFutureRosters,
}))

vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({ success: mocks.success, error: mocks.error }),
}))

const classRow = {
  id: 'qa-class-1', code: 'QA-MATH-08', name: 'QA- Toán 8', subjects: { name: 'QA- Toán' }, grades: { name: 'QA- Khối 8' },
}
const membership = {
  id: 'qa-membership-1', class_id: 'qa-class-1', student_id: 'qa-student-1', start_date: '2026-10-01', end_date: '2050-10-20',
  status: 'ACTIVE', students: { id: 'qa-student-1', student_code: 'QA-S-001', full_name: 'QA- Học sinh', phone: null },
}

function mountPage() {
  return mount(ClassDetailPage, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}

function modalBody() {
  return new DOMWrapper(document.body)
}

function activeModal() {
  return modalBody().get('.modal.show')
}

describe('ClassDetailPage membership start date', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    mocks.getClassDetail.mockReset().mockResolvedValue(classRow)
    mocks.getClassActiveMemberships.mockReset().mockResolvedValue([membership])
    mocks.getStudents.mockReset().mockResolvedValue([membership.students])
    mocks.addClassMembership.mockReset().mockResolvedValue({})
    mocks.updateClassMembership.mockReset().mockResolvedValue({})
    mocks.updateClassMembershipStartDateAndSyncFutureRosters.mockReset().mockResolvedValue({
      membership_id: membership.id,
      previous_start_date: membership.start_date,
      start_date: '2026-10-05',
      changed: true,
      sessions_updated: 2,
      students_added: 1,
      students_removed: 1,
      sessions_skipped_with_attendance: 1,
      roster_rows_retained_with_history: 0,
    })
    mocks.success.mockReset()
    mocks.error.mockReset()
    wrapper = mountPage()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
    document.body.classList.remove('modal-open')
  })

  it('prefills the selected membership and reports the atomic future-roster update', async () => {
    await flushPromises()
    const row = wrapper!.get('tbody tr')
    await row.get('button').trigger('click')
    await flushPromises()

    const input = activeModal().get<HTMLInputElement>('#membership-edit-start')
    expect(input.element.value).toBe('2026-10-01')
    await input.setValue('2026-10-05')
    await activeModal().get('button.btn-primary').trigger('click')
    await flushPromises()

    expect(mocks.updateClassMembershipStartDateAndSyncFutureRosters).toHaveBeenCalledWith({
      membership_id: membership.id,
      start_date: '2026-10-05',
    })
    expect(mocks.getClassActiveMemberships).toHaveBeenCalledTimes(2)
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('Đồng bộ 2 buổi tương lai'))
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('giữ nguyên 1 buổi có attendance'))
  })

  it('does not submit when the start date is unchanged', async () => {
    await flushPromises()
    await wrapper!.get('tbody tr button').trigger('click')
    await flushPromises()

    expect(activeModal().get('button.btn-primary').attributes('disabled')).toBeDefined()
    expect(mocks.updateClassMembershipStartDateAndSyncFutureRosters).not.toHaveBeenCalled()
  })

  it('shows the conflicting session date and keeps the editor open when sync rolls back', async () => {
    const conflict = new Error('MEMBERSHIP_ROSTER_SYNC_CONFLICT') as Error & { details: string }
    conflict.details = JSON.stringify({
      session_id: 'qa-session-1',
      session_date: '2026-10-07',
      reason: 'ROOM_ALREADY_BOOKED',
    })
    mocks.updateClassMembershipStartDateAndSyncFutureRosters.mockRejectedValueOnce(conflict)
    await flushPromises()
    await wrapper!.get('tbody tr button').trigger('click')
    await flushPromises()
    await activeModal().get('#membership-edit-start').setValue('2026-10-05')
    await activeModal().get('button.btn-primary').trigger('click')
    await flushPromises()

    expect(modalBody().text()).toContain('buổi ngày 2026-10-07')
    expect(modalBody().text()).toContain('phòng đã có buổi học khác')
    expect(modalBody().text()).toContain('đã được giữ nguyên')
    expect(activeModal().get('#membership-edit-start').exists()).toBe(true)
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('prevents selecting a start date after the membership end date', async () => {
    await flushPromises()
    const row = wrapper!.get('tbody tr')
    await row.get('button').trigger('click')
    await flushPromises()
    await activeModal().get('#membership-edit-start').setValue('2050-10-21')

    expect(activeModal().text()).toContain('Ngày bắt đầu không được sau ngày kết thúc')
    expect(activeModal().get('button.btn-primary').attributes('disabled')).toBeDefined()
    expect(mocks.updateClassMembershipStartDateAndSyncFutureRosters).not.toHaveBeenCalled()
  })
})
