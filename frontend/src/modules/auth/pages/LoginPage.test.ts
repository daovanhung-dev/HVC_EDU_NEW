import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import LoginPage from './LoginPage.vue'
import AppErrorBanner from '@/app/components/AppErrorBanner.vue'
import { useAppErrorStore } from '@/stores/app-error.store'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ login: mocks.login, loading: false }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/services/supabase', () => ({ isSupabaseConfigured: true }))

const LoginWithGlobalBanner = defineComponent({
  components: { AppErrorBanner, LoginPage },
  template: '<div><AppErrorBanner /><LoginPage /></div>',
})

describe('LoginPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows credential errors only in the login form', async () => {
    mocks.login.mockRejectedValueOnce({ code: 'INVALID_CREDENTIALS', status: 401, message: 'Unauthorized' })
    const pinia = createPinia()
    const wrapper = mount(LoginWithGlobalBanner, { global: { plugins: [pinia] } })
    await wrapper.get('#identifier').setValue('admin@local.vn')
    await wrapper.get('#password').setValue('wrong-password')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text().match(/Tài khoản hoặc mật khẩu không đúng\./g)).toHaveLength(1)
    expect(wrapper.find('.global-error-banner').exists()).toBe(false)
    expect(useAppErrorStore(pinia).current).toBeNull()
  })

  it('clears the prior login error before retrying and after successful login', async () => {
    mocks.login
      .mockRejectedValueOnce({ code: 'INVALID_CREDENTIALS', status: 401 })
      .mockResolvedValueOnce(undefined)
    const pinia = createPinia()
    const wrapper = mount(LoginWithGlobalBanner, { global: { plugins: [pinia] } })
    const errors = useAppErrorStore(pinia)
    errors.report({ code: 'INTERNAL_ERROR', trace_id: 'old-trace' }, 'fallback')
    await wrapper.get('#identifier').setValue('admin@local.vn')
    await wrapper.get('#password').setValue('password123')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Tài khoản hoặc mật khẩu không đúng.')
    expect(errors.current).toBeNull()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.alert-danger').exists()).toBe(false)
    expect(errors.current).toBeNull()
    expect(mocks.push).toHaveBeenCalledWith('/dashboard')
  })
})
