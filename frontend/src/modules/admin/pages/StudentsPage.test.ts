import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '@/stores/toast.store'
import StudentsPage from './StudentsPage.vue'

const mocks = vi.hoisted(() => ({
  getStudents: vi.fn(),
  adminCreateUser: vi.fn(),
  adminResetPassword: vi.fn(),
  archiveStudent: vi.fn(),
  setAccountStatus: vi.fn(),
  updateStudent: vi.fn(),
}))

vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    constructor(private readonly element: HTMLElement) {}
    show() { this.element.classList.add('show'); this.element.setAttribute('aria-hidden', 'false') }
    hide() { const event = new Event('hide.bs.modal', { cancelable: true }); this.element.dispatchEvent(event); if (event.defaultPrevented) return; this.element.classList.remove('show'); this.element.setAttribute('aria-hidden', 'true'); this.element.dispatchEvent(new Event('hidden.bs.modal')) }
    dispose() {}
  },
}))
vi.mock('@/services/data-queries', () => ({ getStudents: mocks.getStudents }))
vi.mock('@/services/commands', () => ({
  adminCreateUser: mocks.adminCreateUser,
  adminResetPassword: mocks.adminResetPassword,
  archiveStudent: mocks.archiveStudent,
  setAccountStatus: mocks.setAccountStatus,
  updateStudent: mocks.updateStudent,
}))

const student = { id: 'qa-student-1', user_id: 'qa-user-1', student_code: 'QA-S-1', full_name: 'Học sinh QA', phone: null, parent_name: null, parent_phone: null, status: 'ACTIVE', created_at: '2026-09-30T08:00:00Z' }

function mountPage() {
  return mount(StudentsPage, { global: { plugins: [createPinia()], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}

describe('StudentsPage dialogs', () => {
  beforeEach(() => {
    mocks.getStudents.mockReset().mockResolvedValue([student])
    mocks.adminCreateUser.mockReset().mockResolvedValue({ temporary_password: 'QA-temp-pass-42' })
    mocks.adminResetPassword.mockReset().mockResolvedValue({ temporary_password: 'QA-reset-pass-24' })
    mocks.archiveStudent.mockReset().mockResolvedValue(undefined)
    mocks.setAccountStatus.mockReset().mockResolvedValue(undefined)
    mocks.updateStudent.mockReset().mockResolvedValue(undefined)
  })

  it('shows the temporary password only in its result dialog after account creation succeeds', async () => {
    const pinia = createPinia()
    const wrapper = mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === 'Thêm học sinh')?.trigger('click')
    await wrapper.get('#student-name').setValue('QA Học sinh')
    await wrapper.findAll('button').find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect(mocks.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'STUDENT', display_name: 'QA Học sinh' }))
    const passwordDialog = wrapper.findAll('.app-modal').find((modal) => modal.text().includes('Mật khẩu tạm thời'))
    expect(passwordDialog).toBeTruthy()
    expect((passwordDialog!.get('#temporary-password').element as HTMLInputElement).value).toBe('QA-temp-pass-42')
    expect(useToastStore(pinia).items.some((item) => item.message.includes('QA-temp-pass-42'))).toBe(false)
    wrapper.unmount()
  })

  it('confirms archive with the affected student before sending the archive command', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === 'Lưu trữ')?.trigger('click')
    expect(mocks.archiveStudent).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Học sinh QA · QA-S-1')
    await wrapper.findAll('button').find((button) => button.text() === 'Lưu trữ học sinh')?.trigger('click')
    await flushPromises()
    expect(mocks.archiveStudent).toHaveBeenCalledWith('qa-student-1')
    wrapper.unmount()
  })
})
