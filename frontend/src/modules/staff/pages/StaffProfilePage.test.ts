import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffProfilePage from './StaffProfilePage.vue'

const mocks = vi.hoisted(() => ({
  getMyStaff: vi.fn(),
  updateMyStaffProfile: vi.fn(),
  toastSuccess: vi.fn(),
  auth: {
    isTeacher: true,
    teacherProfileComplete: false as boolean | null,
    displayName: 'QA Teacher',
    username: 'qa-teacher',
    setTeacherProfileCompletion: vi.fn(),
    refreshProfile: vi.fn(),
  },
}))

vi.mock('@/services/commands', () => ({ updateMyStaffProfile: mocks.updateMyStaffProfile }))
vi.mock('@/services/data-queries', () => ({ getMyStaff: mocks.getMyStaff }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/toast.store', () => ({ useToastStore: () => ({ success: mocks.toastSuccess }) }))

describe('StaffProfilePage mandatory teacher profile fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.teacherProfileComplete = false
    mocks.getMyStaff.mockResolvedValue({
      id: 'qa-staff-1',
      full_name: 'QA Teacher',
      phone: null,
      email: null,
      address: null,
    })
    mocks.updateMyStaffProfile.mockResolvedValue({ staff_id: 'qa-staff-1', full_name: 'QA Teacher' })
    mocks.auth.refreshProfile.mockResolvedValue(undefined)
  })

  it('requires name and phone while keeping email and address optional', async () => {
    const wrapper = mount(StaffProfilePage)
    await flushPromises()

    expect(wrapper.text()).toContain('Để tiếp tục sử dụng hệ thống')
    expect(wrapper.get('#profile-full-name').attributes('required')).toBeDefined()
    expect(wrapper.get('#profile-phone').attributes('required')).toBeDefined()
    expect(wrapper.get('#profile-email').attributes('required')).toBeUndefined()
    expect(wrapper.get('#profile-address').attributes('required')).toBeUndefined()
    expect(wrapper.get('button[type="submit"]').element).toHaveProperty('disabled', true)

    await wrapper.get('#profile-phone').setValue('0900000000')
    expect(wrapper.get('button[type="submit"]').element).toHaveProperty('disabled', false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.updateMyStaffProfile).toHaveBeenCalledWith({
      full_name: 'QA Teacher',
      phone: '0900000000',
      email: '',
      address: '',
    })
    expect(mocks.auth.refreshProfile).toHaveBeenCalledOnce()
    expect(mocks.toastSuccess).toHaveBeenCalledOnce()
  })
})
