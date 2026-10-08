import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordPage from './ChangePasswordPage.vue'

const mocks = vi.hoisted(() => ({
  auth: { isStudent: true, isTeacher: false, forcePasswordChange: true, loading: false, updatePassword: vi.fn() },
  push: vi.fn(),
  report: vi.fn(),
}))

vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/app-error.store', () => ({ useAppErrorStore: () => ({ report: mocks.report }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.isStudent = true
    mocks.auth.isTeacher = false
    mocks.auth.forcePasswordChange = true
    mocks.auth.updatePassword.mockResolvedValue(undefined)
    mocks.report.mockImplementation((error: unknown) => ({ message: error instanceof Error ? error.message : 'QA password failure' }))
  })

  it('explains that students must change the temporary password before seeing their schedule', () => {
    const wrapper = mount(ChangePasswordPage)
    expect(wrapper.text()).toContain('Bạn cần đổi mật khẩu tạm trước khi xem lịch học và dữ liệu học tập.')
  })

  it('explains the mandatory change for a teacher using the reset password', () => {
    mocks.auth.isStudent = false
    mocks.auth.isTeacher = true
    const wrapper = mount(ChangePasswordPage)
    expect(wrapper.text()).toContain('Hãy đổi mật khẩu tạm để tiếp tục sử dụng ứng dụng.')
  })

  it('requires a matching password of at least eight characters before submission', async () => {
    const wrapper = mount(ChangePasswordPage)
    await wrapper.get('#new-password').setValue('short')
    await wrapper.get('#confirm-password').setValue('short')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Mật khẩu phải có ít nhất 8 ký tự.')
    expect(mocks.auth.updatePassword).not.toHaveBeenCalled()

    await wrapper.get('#new-password').setValue('QA-NewPassword-123')
    await wrapper.get('#confirm-password').setValue('QA-DifferentPassword-123')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Hai mật khẩu không khớp.')
    expect(mocks.auth.updatePassword).not.toHaveBeenCalled()
  })

  it('updates the password then routes back to the app', async () => {
    mocks.auth.updatePassword.mockImplementationOnce(async () => {
      mocks.auth.forcePasswordChange = false
    })
    const wrapper = mount(ChangePasswordPage)
    await wrapper.get('#new-password').setValue('QA-NewPassword-123')
    await wrapper.get('#confirm-password').setValue('QA-NewPassword-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.auth.updatePassword).toHaveBeenCalledWith('QA-NewPassword-123')
    expect(mocks.push).toHaveBeenCalledWith('/student/schedule')
    expect(wrapper.text()).toContain('Đổi mật khẩu thành công.')
  })

  it('keeps a forced-change student on the form when the refreshed profile still requires a change', async () => {
    const wrapper = mount(ChangePasswordPage)
    await wrapper.get('#new-password').setValue('QA-NewPassword-123')
    await wrapper.get('#confirm-password').setValue('QA-NewPassword-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Chưa thể xác nhận yêu cầu đổi mật khẩu đã hoàn tất nên chưa mở quyền xem lịch học.')
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('keeps the student on the password form when the secure update fails', async () => {
    mocks.auth.updatePassword.mockRejectedValueOnce(new Error('QA_EDGE_UPDATE_FAILED'))
    const wrapper = mount(ChangePasswordPage)
    await wrapper.get('#new-password').setValue('QA-NewPassword-123')
    await wrapper.get('#confirm-password').setValue('QA-NewPassword-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('QA_EDGE_UPDATE_FAILED')
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
