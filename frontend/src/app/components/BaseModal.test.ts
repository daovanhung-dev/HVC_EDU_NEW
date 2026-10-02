import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import BaseModal from './BaseModal.vue'

vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    constructor(private readonly element: HTMLElement) {}
    show() {
      this.element.style.display = 'block'
      this.element.classList.add('show')
      this.element.setAttribute('aria-hidden', 'false')
      this.element.dispatchEvent(new Event('shown.bs.modal'))
    }
    hide() {
      const event = new Event('hide.bs.modal', { cancelable: true })
      this.element.dispatchEvent(event)
      if (event.defaultPrevented) return
      this.element.style.display = 'none'
      this.element.classList.remove('show')
      this.element.setAttribute('aria-hidden', 'true')
      this.element.dispatchEvent(new Event('hidden.bs.modal'))
    }
    dispose() {}
  },
}))

const ModalHost = defineComponent({
  components: { BaseModal },
  setup() {
    const open = ref(false)
    const dirty = ref(false)
    return { open, dirty }
  },
  template: `<button id="opener" @click="open = true">Mở</button><BaseModal v-model="open" title="Hộp thoại QA" :dirty="dirty"><button data-modal-autofocus>Nội dung</button></BaseModal>`,
})

const TeleportedModalHost = defineComponent({
  components: { BaseModal },
  setup() {
    const open = ref(true)
    return { open }
  },
  template: `<BaseModal v-model="open" title="Hộp thoại QA" class="qa-teleported-modal" teleport-to-body><button>Nội dung</button></BaseModal>`,
})

describe('BaseModal', () => {
  it('teleports to body and forwards caller attributes to the modal element', async () => {
    const wrapper = mount(TeleportedModalHost, { attachTo: document.body })
    await flushPromises()
    await nextTick()

    const element = document.body.querySelector<HTMLElement>('.qa-teleported-modal')
    expect(element?.parentElement).toBe(document.body)
    expect(element).not.toBeNull()
    expect(new DOMWrapper(element!).classes()).toContain('app-modal')
    expect(new DOMWrapper(element!).classes()).toContain('show')

    wrapper.unmount()
  })

  it('moves focus into the dialog and restores it to the opener after closing', async () => {
    const wrapper = mount(ModalHost, { attachTo: document.body })
    const opener = wrapper.get('#opener')
    opener.element.focus()
    await opener.trigger('click')
    await flushPromises()
    await nextTick()

    expect(document.activeElement?.textContent).toBe('Nội dung')
    await wrapper.get('.app-modal__close').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(opener.element)
    wrapper.unmount()
  })

  it('keeps keyboard focus inside the open dialog', async () => {
    const wrapper = mount(ModalHost, { attachTo: document.body })
    await wrapper.get('#opener').trigger('click')
    await flushPromises()
    const close = wrapper.get('.app-modal__close')
    const content = wrapper.get('[data-modal-autofocus]')

    content.element.focus()
    await content.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(close.element)

    close.element.focus()
    await close.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(content.element)
    wrapper.unmount()
  })

  it('asks before discarding a dirty form when Escape is pressed', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(ModalHost, { attachTo: document.body })
    const opener = wrapper.get('#opener')
    await opener.trigger('click')
    await flushPromises()
    ;(wrapper.vm as unknown as { dirty: boolean }).dirty = true
    await nextTick()
    await wrapper.get('.app-modal').trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(confirm).toHaveBeenCalledWith('Bạn đã thay đổi nội dung. Bỏ các thay đổi này?')
    expect(wrapper.get('.app-modal').classes()).toContain('show')
    confirm.mockReturnValue(true)
    await wrapper.get('.app-modal').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.get('.app-modal').classes()).not.toContain('show')
    expect(confirm).toHaveBeenCalledTimes(2)
    wrapper.unmount()
    confirm.mockRestore()
  })

  it('asks once before dismissing a dirty form through the backdrop event', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(ModalHost, { attachTo: document.body })
    await wrapper.get('#opener').trigger('click')
    await flushPromises()
    ;(wrapper.vm as unknown as { dirty: boolean }).dirty = true
    await nextTick()

    const hideEvent = new Event('hide.bs.modal', { cancelable: true })
    wrapper.get('.app-modal').element.dispatchEvent(hideEvent)
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.app-modal').classes()).not.toContain('show')
    wrapper.unmount()
    confirm.mockRestore()
  })
})
