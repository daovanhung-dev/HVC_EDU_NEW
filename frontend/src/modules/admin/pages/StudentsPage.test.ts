import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const mountedWrappers: Array<{ unmount: () => void }> = []

function track<T extends { unmount: () => void }>(wrapper: T) {
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountPage() {
  return track(mount(StudentsPage, { global: { plugins: [createPinia()], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
}

function getPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.find(selector).exists() ? wrapper.get(selector) : new DOMWrapper(document.body).get(selector)
}

function findAllPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  const pageMatches = wrapper.findAll(selector)
  return pageMatches.length ? pageMatches : new DOMWrapper(document.body).findAll(selector)
}

function allButtons(wrapper: ReturnType<typeof mount>) {
  return [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
}

describe('StudentsPage dialogs', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
    document.body.classList.remove('modal-open')
  })

  beforeEach(() => {
    mocks.getStudents.mockReset().mockResolvedValue([student])
    mocks.adminCreateUser.mockReset().mockResolvedValue({ temporary_password: 'QA-temp-pass-42' })
    mocks.adminResetPassword.mockReset().mockResolvedValue({ temporary_password: '12345678' })
    mocks.archiveStudent.mockReset().mockResolvedValue(undefined)
    mocks.setAccountStatus.mockReset().mockResolvedValue(undefined)
    mocks.updateStudent.mockReset().mockResolvedValue(undefined)
  })

  it('shows a retryable load error instead of a misleading empty list', async () => {
    mocks.getStudents.mockRejectedValueOnce(new Error('QA roster failure'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.app-state--error').text()).toContain('QA roster failure')
    expect(wrapper.text()).not.toContain('Chưa có học sinh phù hợp')
    await wrapper.find('.app-state--error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(student.full_name)
    wrapper.unmount()
  })

  it('shows the temporary password only in its result dialog after account creation succeeds', async () => {
    const pinia = createPinia()
    const wrapper = track(mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Thêm học sinh')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name').setValue('QA Học sinh')
    await allButtons(wrapper).find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect(mocks.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'STUDENT', display_name: 'QA Học sinh' }))
    const passwordDialog = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('Mật khẩu tạm thời'))
    expect(passwordDialog).toBeTruthy()
    expect(findAllPageOrBody(wrapper, '.app-modal[aria-hidden="false"]')).toHaveLength(1)
    expect((passwordDialog!.get('#temporary-password').element as HTMLInputElement).value).toBe('QA-temp-pass-42')
    expect(useToastStore(pinia).items.some((item) => item.message.includes('QA-temp-pass-42'))).toBe(false)
  })

  it('sends an optional initial password without showing it as a generated password', async () => {
    const suppliedPassword = `QA-${crypto.randomUUID()}`
    mocks.adminCreateUser.mockResolvedValue({ temporary_password: suppliedPassword })
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Thêm học sinh')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name').setValue('QA Học sinh mới')
    await getPageOrBody(wrapper, '#student-password').setValue(suppliedPassword)
    expect((getPageOrBody(wrapper, '#student-password').element as HTMLInputElement).type).toBe('password')
    await allButtons(wrapper).find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect(mocks.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'STUDENT', password: suppliedPassword }))
    expect(findAllPageOrBody(wrapper, '.app-modal[aria-hidden="false"]')).toHaveLength(0)
  })

  it('clears the initial password after a failed create and leaves existing profile updates separate', async () => {
    const suppliedPassword = `QA-${crypto.randomUUID()}`
    mocks.adminCreateUser.mockRejectedValueOnce(new Error('QA simulated create failure'))
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Thêm học sinh')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name').setValue('QA Học sinh mới')
    await getPageOrBody(wrapper, '#student-password').setValue(suppliedPassword)
    await allButtons(wrapper).find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect((getPageOrBody(wrapper, '#student-password').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('QA simulated create failure')
    expect(wrapper.text()).not.toContain(suppliedPassword)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await allButtons(wrapper).find((button) => button.text() === 'Hủy')?.trigger('click')
    confirmSpy.mockRestore()
    await wrapper.findAll('button').find((button) => button.text() === 'Sửa')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name-edit').setValue('QA Học sinh đã cập nhật')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.trigger('click')
    await flushPromises()
    expect(mocks.updateStudent).toHaveBeenCalledWith('qa-student-1', expect.objectContaining({ full_name: 'QA Học sinh đã cập nhật' }))
    expect(mocks.adminCreateUser).toHaveBeenCalledTimes(1)
  })

  it('confirms archive with the affected student before sending the archive command', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Lưu trữ')?.trigger('click')
    expect(mocks.archiveStudent).not.toHaveBeenCalled()
    expect(`${wrapper.text()} ${document.body.textContent || ''}`).toContain('Học sinh QA · QA-S-1')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu trữ học sinh')?.trigger('click')
    await flushPromises()
    expect(mocks.archiveStudent).toHaveBeenCalledWith('qa-student-1')
  })

  it('shows the fixed password after resetting a student account', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const resetButton = allButtons(wrapper).find((button) => button.text() === 'Đặt lại mật khẩu')
    await resetButton?.trigger('click')
    expect(new DOMWrapper(document.body).text()).toContain('Mật khẩu sẽ được đặt lại thành 12345678')
    expect(new DOMWrapper(document.body).text()).toContain('cần đổi mật khẩu này trước khi sử dụng cổng học tập')
    const confirmButton = new DOMWrapper(document.body).findAll('.app-modal[aria-hidden="false"] button').find((button) => button.text() === 'Đặt lại mật khẩu')
    await confirmButton?.trigger('click')
    await flushPromises()

    expect(mocks.adminResetPassword).toHaveBeenCalledWith('qa-user-1')
    expect((new DOMWrapper(document.body).get('#temporary-password').element as HTMLInputElement).value).toBe('12345678')
    expect(new DOMWrapper(document.body).text()).toContain('sẽ cần đổi mật khẩu ở lần đăng nhập kế tiếp')
  })
})
