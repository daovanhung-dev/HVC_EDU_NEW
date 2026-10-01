import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, onMounted } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import AppLayout from './AppLayout.vue'

const root = defineComponent({ render: () => h(RouterView) })
const adminPaths = [
  ['/admin/students', 'students'],
  ['/admin/staff', 'staff'],
  ['/admin/classes', 'classes'],
  ['/admin/sessions', 'sessions'],
  ['/admin/timesheets', 'timesheets'],
] as const

function page(name: string, onMount: () => void) {
  return defineComponent({
    name,
    setup() {
      onMounted(onMount)
      return () => h('div', { 'data-testid': name }, name)
    },
  })
}

describe('AppLayout route view lifecycle', () => {
  it('renders and mounts the selected sidebar page after each path change', async () => {
    const mounts = {
      students: vi.fn(),
      staff: vi.fn(),
      classes: vi.fn(),
      sessions: vi.fn(),
      timesheets: vi.fn(),
    }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/change-password', component: page('change-password', vi.fn()) },
        ...adminPaths.map(([path, name]) => ({
          path,
          component: AppLayout,
          children: [{ path: '', component: page(name, mounts[name]) }],
        })),
      ],
    })

    await router.push('/admin/students')
    await router.isReady()
    const wrapper = mount(root, { global: { plugins: [createPinia(), router] } })
    await flushPromises()
    await nextTick()
    expect(wrapper.find('[data-testid="students"]').exists()).toBe(true)

    for (const [path, name] of adminPaths.slice(1)) {
      const link = wrapper.find(`.app-sidebar a[href="${path}"]`)
      expect(link.exists()).toBe(true)
      await link.trigger('click')
      await flushPromises()
      await nextTick()

      expect(router.currentRoute.value.path).toBe(path)
      expect(wrapper.find(`[data-testid="${name}"]`).exists()).toBe(true)
      expect(mounts[name]).toHaveBeenCalledTimes(1)
    }

    wrapper.unmount()
  })

  it('remounts a shared page component when the route path changes', async () => {
    const mountPage = vi.fn()
    const SharedPage = page('shared-page', mountPage)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/change-password', component: page('change-password', vi.fn()) },
        ...adminPaths.map(([path]) => ({
          path,
          component: AppLayout,
          children: [{ path: '', component: SharedPage }],
        })),
      ],
    })

    await router.push('/admin/students')
    await router.isReady()
    const wrapper = mount(root, { global: { plugins: [createPinia(), router] } })
    await flushPromises()
    await nextTick()
    expect(mountPage).toHaveBeenCalledTimes(1)

    await wrapper.find('.app-sidebar a[href="/admin/staff"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/admin/staff')
    expect(wrapper.find('[data-testid="shared-page"]').exists()).toBe(true)
    expect(mountPage).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('does not remount the page when only query parameters change', async () => {
    const mountPage = vi.fn()
    const SessionsPage = page('sessions-query', mountPage)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/change-password', component: page('change-password', vi.fn()) },
        ...adminPaths.map(([path, name]) => ({
          path,
          component: AppLayout,
          children: [{ path: '', component: name === 'sessions' ? SessionsPage : page(name, vi.fn()) }],
        })),
      ],
    })

    await router.push('/admin/sessions')
    await router.isReady()
    const wrapper = mount(root, { global: { plugins: [createPinia(), router] } })
    await flushPromises()
    await nextTick()
    await router.push('/admin/sessions?class_id=QA-CLASS')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-testid="sessions-query"]').exists()).toBe(true)
    expect(mountPage).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
