import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StaffPage from './StaffPage.vue'

const mocks = vi.hoisted(() => ({
  getStaff: vi.fn(),
  adminCreateUser: vi.fn(),
  adminResetPassword: vi.fn(),
  adminResetPasswordBulk: vi.fn(),
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
  adminResetPasswordBulk: mocks.adminResetPasswordBulk,
  archiveStaff: mocks.archiveStaff,
  setAccountStatus: mocks.setAccountStatus,
  updateStaff: mocks.updateStaff,
}))

const staff = {
  id: 'qa-staff-1',
  user_id: 'qa-user-1',
  staff_code: 'QA-T-1',
  full_name: 'Giáo viên QA',
  staff_type: 'TEACHER',
  phone: '0900000001',
  email: 'qa-teacher@example.test',
  address: 'Địa chỉ QA',
  notes: 'Ghi chú QA',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
}
const secondActiveStaff = { id: 'qa-staff-2', user_id: 'qa-user-2', staff_code: 'QA-T-2', full_name: 'Giáo viên QA hai', staff_type: 'TEACHER', phone: null, status: 'ACTIVE' }
const inactiveStaff = { id: 'qa-staff-3', user_id: 'qa-user-3', staff_code: 'QA-T-3', full_name: 'Giáo viên QA nghỉ', staff_type: 'TEACHER', phone: null, status: 'INACTIVE' }

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
    mocks.adminResetPassword.mockReset().mockResolvedValue({ temporary_password: '12345678' })
    mocks.adminResetPasswordBulk.mockReset().mockResolvedValue({ temporary_password: null, results: [] })
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
    await getPageOrBody(wrapper, '#staff-code-edit').setValue('QA-T-UPDATED')
    await getPageOrBody(wrapper, '#staff-phone-edit').setValue('0900000002')
    await getPageOrBody(wrapper, '#staff-email-edit').setValue('qa-updated@example.test')
    await getPageOrBody(wrapper, '#staff-address-edit').setValue('Địa chỉ mới')
    await getPageOrBody(wrapper, '#staff-notes-edit').setValue('Ghi chú mới')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.trigger('click')
    await flushPromises()

    expect(mocks.updateStaff).toHaveBeenCalledWith('qa-staff-1', {
      staff_code: 'QA-T-UPDATED',
      full_name: 'QA Giáo viên cập nhật',
      phone: '0900000002',
      email: 'qa-updated@example.test',
      address: 'Địa chỉ mới',
      notes: 'Ghi chú mới',
    })
    expect(mocks.adminCreateUser).not.toHaveBeenCalled()
  })

  it('saves empty optional profile fields as null', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Sửa')?.trigger('click')
    await getPageOrBody(wrapper, '#staff-code-edit').setValue(' ')
    await getPageOrBody(wrapper, '#staff-phone-edit').setValue(' ')
    await getPageOrBody(wrapper, '#staff-email-edit').setValue('')
    await getPageOrBody(wrapper, '#staff-address-edit').setValue(' ')
    await getPageOrBody(wrapper, '#staff-notes-edit').setValue(' ')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.trigger('click')
    await flushPromises()

    expect(mocks.updateStaff).toHaveBeenCalledWith('qa-staff-1', {
      staff_code: null,
      full_name: 'Giáo viên QA',
      phone: null,
      email: null,
      address: null,
      notes: null,
    })
  })

  it('shows the complete staff profile and formats timestamps in Ho Chi Minh time', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await getPageOrBody(wrapper, '[data-testid="view-staff"]').trigger('click')
    await flushPromises()

    const detail = getPageOrBody(wrapper, '[data-testid="staff-detail"]')
    expect(detail.text()).toContain('QA-T-1')
    expect(detail.text()).toContain('Giáo viên')
    expect(detail.text()).toContain('0900000001')
    expect(detail.text()).toContain('qa-teacher@example.test')
    expect(detail.text()).toContain('Địa chỉ QA')
    expect(detail.text()).toContain('Ghi chú QA')
    expect(detail.text()).toContain('Đang hoạt động')
    expect(detail.text()).toContain('07:00')
  })

  it('shows dashes for optional profile values that are empty', async () => {
    mocks.getStaff.mockResolvedValue([{
      ...staff,
      staff_code: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
      created_at: null,
      updated_at: null,
    }])
    const wrapper = mountPage()
    await flushPromises()

    await getPageOrBody(wrapper, '[data-testid="view-staff"]').trigger('click')
    await flushPromises()

    const detail = getPageOrBody(wrapper, '[data-testid="staff-detail"]')
    expect(detail.text().match(/—/gu)).toHaveLength(7)
  })

  it('opens the edit form from details with the selected profile prefilled', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await getPageOrBody(wrapper, '[data-testid="view-staff"]').trigger('click')
    await getPageOrBody(wrapper, '[data-testid="edit-staff-from-detail"]').trigger('click')
    await flushPromises()

    expect(getPageOrBody(wrapper, '#staff-name-edit').element).toHaveProperty('value', 'Giáo viên QA')
    expect(getPageOrBody(wrapper, '#staff-phone-edit').element).toHaveProperty('value', '0900000001')
    expect(getPageOrBody(wrapper, '#staff-email-edit').element).toHaveProperty('value', 'qa-teacher@example.test')
    expect(getPageOrBody(wrapper, '#staff-address-edit').element).toHaveProperty('value', 'Địa chỉ QA')
    expect(getPageOrBody(wrapper, '#staff-notes-edit').element).toHaveProperty('value', 'Ghi chú QA')
  })

  it('rejects an invalid email and keeps edits open after a failed update', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Sửa')?.trigger('click')
    await getPageOrBody(wrapper, '#staff-email-edit').setValue('not-an-email')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.trigger('click')
    await flushPromises()

    expect(mocks.updateStaff).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Email không đúng định dạng.')

    await getPageOrBody(wrapper, '#staff-email-edit').setValue('qa-valid@example.test')
    mocks.updateStaff.mockRejectedValueOnce(new Error('QA update failure'))
    await allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('QA update failure')
    expect(getPageOrBody(wrapper, '#staff-email-edit').element).toHaveProperty('value', 'qa-valid@example.test')
    expect(mocks.adminCreateUser).not.toHaveBeenCalled()
  })

  it('does not allow an empty staff name to be submitted', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Sửa')?.trigger('click')
    await getPageOrBody(wrapper, '#staff-name-edit').setValue('   ')

    expect(allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.element).toHaveProperty('disabled', true)
    expect(mocks.updateStaff).not.toHaveBeenCalled()
  })

  it('shows the fixed password after resetting a teacher account', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const resetButton = allButtons(wrapper).find((button) => button.text() === 'Đặt lại mật khẩu')
    await resetButton?.trigger('click')
    const confirmButton = new DOMWrapper(document.body).findAll('.app-modal[aria-hidden="false"] button').find((button) => button.text() === 'Đặt lại mật khẩu')
    await confirmButton?.trigger('click')
    await flushPromises()

    expect(mocks.adminResetPassword).toHaveBeenCalledWith('qa-user-1')
    expect((new DOMWrapper(document.body).get('#staff-temporary-password').element as HTMLInputElement).value).toBe('12345678')
  })

  it('selects only active teachers and cancels bulk reset without changing accounts', async () => {
    mocks.getStaff.mockResolvedValue([staff, inactiveStaff])
    const wrapper = mountPage()
    await flushPromises()

    await getPageOrBody(wrapper, '[data-testid="select-all-active-staff"]').setValue(true)
    expect(getPageOrBody(wrapper, '[aria-label="Chọn Giáo viên QA nghỉ"]').element).toHaveProperty('disabled', true)
    expect(wrapper.text()).toContain('1/100 đã chọn')
    await getPageOrBody(wrapper, '[data-testid="bulk-reset-staff"]').trigger('click')
    expect(new DOMWrapper(document.body).text()).toContain('1 tài khoản đang hoạt động được chọn')
    expect(new DOMWrapper(document.body).text()).not.toContain('Giáo viên QA nghỉ')

    await allButtons(wrapper).find((button) => button.text() === 'Hủy')?.trigger('click')
    await flushPromises()
    expect(mocks.adminResetPasswordBulk).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('sends one bulk request and displays separate outcomes for each teacher', async () => {
    mocks.getStaff.mockResolvedValue([staff, secondActiveStaff, inactiveStaff])
    mocks.adminResetPasswordBulk.mockResolvedValue({
      temporary_password: '12345678',
      results: [
        { user_id: staff.user_id, status: 'SUCCESS', password_reset: true, reason_codes: [] },
        { user_id: secondActiveStaff.user_id, status: 'FAILED', password_reset: false, reason_codes: ['PASSWORD_UPDATE_FAILED'] },
      ],
    })
    const wrapper = mountPage()
    await flushPromises()

    await getPageOrBody(wrapper, '[data-testid="select-all-active-staff"]').setValue(true)
    await getPageOrBody(wrapper, '[data-testid="bulk-reset-staff"]').trigger('click')
    await getPageOrBody(wrapper, '[data-testid="confirm-bulk-reset"]').trigger('click')
    await flushPromises()

    expect(mocks.adminResetPasswordBulk).toHaveBeenCalledTimes(1)
    expect(mocks.adminResetPasswordBulk).toHaveBeenCalledWith([staff.user_id, secondActiveStaff.user_id])
    const resultDialog = new DOMWrapper(document.body).findAll('.app-modal[aria-hidden="false"]').find((modal) => modal.text().includes('Kết quả đặt lại mật khẩu'))
    expect(resultDialog).toBeTruthy()
    expect(resultDialog!.text()).toContain('Giáo viên QA hai')
    expect(resultDialog!.text()).toContain('Không thể cập nhật mật khẩu chung; yêu cầu đổi mật khẩu vẫn đang bật.')
    expect(resultDialog!.text()).not.toContain('Giáo viên QA nghỉ')
    expect((resultDialog!.get('#bulk-reset-temporary-password').element as HTMLInputElement).value).toBe('12345678')
    wrapper.unmount()
  })

  it('clears staff selection when search input changes', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await getPageOrBody(wrapper, '[aria-label="Chọn Giáo viên QA"]').setValue(true)
    expect(wrapper.text()).toContain('1/100 đã chọn')
    await getPageOrBody(wrapper, '#staff-search').setValue('QA-T-2')
    await flushPromises()
    expect(wrapper.text()).toContain('0/100 đã chọn')
    expect(getPageOrBody(wrapper, '[data-testid="bulk-reset-staff"]').element).toHaveProperty('disabled', true)
    wrapper.unmount()
  })
})
