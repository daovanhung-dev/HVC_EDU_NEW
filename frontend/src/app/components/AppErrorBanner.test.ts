import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import AppErrorBanner from './AppErrorBanner.vue'
import { useAppErrorStore } from '@/stores/app-error.store'

describe('AppErrorBanner', () => {
  it('shows a safe message and trace id and can be dismissed', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AppErrorBanner, { global: { plugins: [pinia] } })
    const errors = useAppErrorStore()

    errors.report({ code: 'INTERNAL_ERROR', trace_id: 'trace-banner' }, 'fallback')
    await nextTick()

    expect(wrapper.text()).toContain('Hệ thống gặp lỗi khi xử lý yêu cầu')
    expect(wrapper.text()).toContain('trace-banner')

    await wrapper.get('button').trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
