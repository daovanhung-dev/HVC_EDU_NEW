import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import BaseModal from './BaseModal.vue'

const modalControls = vi.hoisted(() => ({ hide: new Map<HTMLElement, () => void>() }))

vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    private backdrop: HTMLElement | null = null
    private isShown = false

    constructor(private readonly element: HTMLElement) {
      modalControls.hide.set(element, () => this.hide())
    }

    show() {
      if (this.isShown) return
      this.isShown = true
      this.element.style.display = 'block'
      this.element.classList.add('show')
      this.element.setAttribute('aria-hidden', 'false')
      document.body.classList.add('modal-open')
      this.backdrop?.remove()
      this.backdrop = document.createElement('div')
      this.backdrop.className = 'modal-backdrop fade show'
      document.body.append(this.backdrop)
      this.element.dispatchEvent(new Event('shown.bs.modal'))
    }

    hide() {
      if (!this.isShown) return
      const event = new Event('hide.bs.modal', { cancelable: true })
      this.element.dispatchEvent(event)
      if (event.defaultPrevented) return
      this.isShown = false
      this.element.style.display = 'none'
      this.element.classList.remove('show')
      this.element.setAttribute('aria-hidden', 'true')
      this.backdrop?.remove()
      this.backdrop = null
      if (!document.querySelector('.app-modal.show')) document.body.classList.remove('modal-open')
      this.element.dispatchEvent(new Event('hidden.bs.modal'))
    }

    dispose() {
      this.backdrop?.remove()
      this.backdrop = null
      modalControls.hide.delete(this.element)
      if (!document.querySelector('.app-modal.show')) document.body.classList.remove('modal-open')
    }
  },
}))

const ModalHost = defineComponent({
  components: { BaseModal },
  props: { initiallyOpen: Boolean },
  setup(props) {
    const open = ref(props.initiallyOpen)
    const dirty = ref(false)
    const busy = ref(false)
    return { open, dirty, busy }
  },
  template: `<button id="opener" @click="open = true">Mở</button><BaseModal v-model="open" class="qa-modal" title="Hộp thoại QA" :dirty="dirty" :busy="busy"><button data-modal-autofocus>Nội dung</button></BaseModal>`,
})

function modalElement() {
  const element = document.body.querySelector<HTMLElement>('.qa-modal')
  if (!element) throw new Error('Không tìm thấy dialog QA đã Teleport tới body.')
  return element
}

function modalWrapper() {
  return new DOMWrapper(modalElement())
}

describe('BaseModal', () => {
  it('always teleports an initially open dialog to body above the body-level backdrop', async () => {
    const wrapper = mount(ModalHost, { attachTo: document.body, props: { initiallyOpen: true } })
    await flushPromises()
    await nextTick()

    const modal = modalElement()
    const backdrop = document.body.querySelector('.modal-backdrop')
    expect(modal.parentElement).toBe(document.body)
    expect(modal.classList).toContain('show')
    expect(backdrop?.parentElement).toBe(document.body)
    expect(document.body.classList).toContain('modal-open')

    await modalWrapper().get('.app-modal__close').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.modal-backdrop')).toBeNull()
    expect(document.body.classList).not.toContain('modal-open')
    expect(wrapper.getComponent(BaseModal).emitted('hidden')).toHaveLength(1)
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
    await modalWrapper().get('.app-modal__close').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(opener.element)
    wrapper.unmount()
  })

  it('closes a clean dialog with Escape and removes the backdrop', async () => {
    const wrapper = mount(ModalHost, { attachTo: document.body })
    await wrapper.get('#opener').trigger('click')
    await flushPromises()

    await modalWrapper().trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(modalElement().classList).not.toContain('show')
    expect(document.body.querySelector('.modal-backdrop')).toBeNull()
    expect(document.body.classList).not.toContain('modal-open')
    wrapper.unmount()
  })

  it('closes a clean dialog from the backdrop and removes the backdrop', async () => {
    const wrapper = mount(ModalHost, { attachTo: document.body })
    await wrapper.get('#opener').trigger('click')
    await flushPromises()

    modalControls.hide.get(modalElement())?.()
    await flushPromises()

    expect(modalElement().classList).not.toContain('show')
    expect(document.body.querySelector('.modal-backdrop')).toBeNull()
    expect(document.body.classList).not.toContain('modal-open')
    wrapper.unmount()
  })

  it('keeps keyboard focus inside the open dialog', async () => {
    const wrapper = mount(ModalHost, { attachTo: document.body })
    await wrapper.get('#opener').trigger('click')
    await flushPromises()
    const close = modalWrapper().get('.app-modal__close')
    const content = modalWrapper().get('[data-modal-autofocus]')

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
    await modalWrapper().trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(confirm).toHaveBeenCalledWith('Bạn đã thay đổi nội dung. Bỏ các thay đổi này?')
    expect(modalElement().classList).toContain('show')
    confirm.mockReturnValue(true)
    await modalWrapper().trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(modalElement().classList).not.toContain('show')
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

    modalControls.hide.get(modalElement())?.()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(modalElement().classList).not.toContain('show')
    expect(document.body.querySelector('.modal-backdrop')).toBeNull()
    expect(document.body.classList).not.toContain('modal-open')
    wrapper.unmount()
    confirm.mockRestore()
  })

  it('does not close or remove the backdrop while a dialog is busy', async () => {
    const wrapper = mount(ModalHost, { attachTo: document.body })
    await wrapper.get('#opener').trigger('click')
    await flushPromises()
    ;(wrapper.vm as unknown as { busy: boolean }).busy = true
    await nextTick()

    await modalWrapper().trigger('keydown', { key: 'Escape' })
    await modalWrapper().get('.app-modal__close').trigger('click')
    await flushPromises()

    expect(modalElement().classList).toContain('show')
    expect(document.body.querySelector('.modal-backdrop')).not.toBeNull()
    expect(document.body.classList).toContain('modal-open')
    wrapper.unmount()
  })
})
