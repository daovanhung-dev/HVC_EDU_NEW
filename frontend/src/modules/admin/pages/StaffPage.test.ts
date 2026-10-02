import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StaffPage from './StaffPage.vue'

const mocks = vi.hoisted(() => ({
  getStaff: vi.fn(),
  adminCreateUser: vi.fn(),
  adminResetPassword: vi.fn(),
  archiveStaff: vi.fn(),
  setAccountStatus: vi.fn(),
  updateStaff: vi.fn(),
}))

vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    constructor(private readonly element: HTMLElement) {}
    show() { this.element.classList.add('show'); this.element.setAttribute('aria-hidden', 'false') }
    hide() { const event = new Event('hide.bs.modal', { cancelable: true }); this.element.dispatchEvent(event); if (event.defaultPrevented) return; this.element.classList.remove('show'); this.element.setAttribute('aria-hidden', 'true'); this.element.dispatchEvent(new Event('hidden.bs.modal')) }
    dispose() {}
  },
}))
vi.mock('@/services/data-queries', () => ({ getStaff: mocks.getStaff }))
vi.mock('@/services/commands', () => ({
  adminCreateUser: mocks.adminCreateUser,
  adminResetPassword: mocks.adminResetPassword,
  archiveStaff: mocks.archiveStaff,
  setAccountStatus: mocks.setAccountStatus,
  updateStaff: mocks.updateStaff,
}))

const staff = { id: 'qa-staff-1', user_id: 'qa-user-1', staff_code: 'QA-T-1', full_name: 'Giáo viên QA', staff_type: 'TEACHER', phone: null, status: 'ACTIVE' }

const mountedWrappers: Array<{ unmount: () => void }> = []

function track<T extends { unmount: () => void }>(wrapper: T) {
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountPage() {
  return track(mount(StaffPage, { global: { plugins: [createPinia()] } }))
}

function getPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.find(selector).exists() ? wrapper.get(selector) : new DOMWrapper(document.body).get(selector)
}

function allButtons(wrapper: ReturnType<typeof mount>) {
  return [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
}

describe('StaffPage account creation', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
    document.body.classList.remove('modal-open')
  })

  beforeEach(() => {
    mocks.getStaff.mockReset().mockResolvedValue([staff])
    mocks.adminCreateUser.mockReset().mockResolvedValue({ temporary_password: 'QA-generated-value' })
    mocks.adminResetPassword.mockReset().mockResolvedValue({ temporary_password: 'QA-reset-value' })
    mocks.archiveStaff.mockReset().mockResolvedValue(undefined)
    mocks.setAccountStatus.mockReset().mockResolvedValue(undefined)
    mocks.updateStaff.mockReset().mockResolvedValue(undefined)
  })

  it('sends optional teacher email and initial password and does not display the supplied password', async () => {
    const email = `qa-${crypto.randomUUID()}@example.test`
    const suppliedPassword = `QA-${crypto.randomUUID()}`
    mocks.adminCreateUser.mockResolvedValue({ temporary_password: suppliedPassword })
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Thêm nhân sự')?.trigger('click')
    await getPageOrBody(wrapper, '#staff-name').setValue('QA Giáo viên mới')
    await getPageOrBody(wrapper, '#staff-email').setValue(email)
    await getPageOrBody(wrapper, '#staff-password').setValue(suppliedPassword)
    expect((getPageOrBody(wrapper, '#staff-password').element as HTMLInputElement).type).toBe('password')
    await allButtons(wrapper).find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect(mocks.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'TEACHER', email, password: suppliedPassword }))
    expect(new DOMWrapper(document.body).findAll('.app-modal[aria-hidden="false"]')).toHaveLength(0)
  })

  it('keeps profile edits on the update command without creating another account', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Sửa')?.trigger('click')
    await getPageOrBody(wrapper, '#staff-name-edit').setValue('QA Giáo viên cập nhật')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.trigger('click')
    await flushPromises()

    expect(mocks.updateStaff).toHaveBeenCalledWith('qa-staff-1', expect.objectContaining({ full_name: 'QA Giáo viên cập nhật' }))
    expect(mocks.adminCreateUser).not.toHaveBeenCalled()
  })
})
