<script setup lang="ts">
import { Modal } from 'bootstrap'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  description?: string
  size?: 'sm' | 'lg' | 'xl'
  busy?: boolean
  dirty?: boolean
}>(), { description: '', size: 'lg', busy: false, dirty: false })

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'dismiss-blocked': []
  hidden: []
}>()

const element = ref<HTMLElement | null>(null)
const titleId = `app-modal-title-${useId()}`
const descriptionId = `app-modal-description-${useId()}`
let instance: Modal | null = null
let returnFocus: HTMLElement | null = null
let allowHide = false
let showRequested = false

function onHide(event: Event) {
  if (props.busy && !allowHide) {
    event.preventDefault()
    emit('dismiss-blocked')
    return
  }
  if (props.dirty && !allowHide) {
    event.preventDefault()
    emit('dismiss-blocked')
    if (window.confirm('Bạn đã thay đổi nội dung. Bỏ các thay đổi này?')) {
      allowHide = true
      emit('update:modelValue', false)
    }
    return
  }
  allowHide = false
  if (props.modelValue) emit('update:modelValue', false)
}

function onHidden() {
  showRequested = false
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  returnFocus = null
  emit('hidden')
}

function close() {
  if (props.busy) return
  emit('update:modelValue', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab' && element.value) {
    const focusable = Array.from(element.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((item) => !item.closest('[hidden], [aria-hidden="true"]'))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (!first) {
      event.preventDefault()
      element.value.focus()
    } else if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !element.value.contains(active))) {
      event.preventDefault()
      first.focus()
    }
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (!props.busy) emit('update:modelValue', false)
  }
}

onMounted(() => {
  if (!element.value) return
  instance = new Modal(element.value, { backdrop: true, keyboard: false, focus: true })
  element.value.addEventListener('hide.bs.modal', onHide)
  element.value.addEventListener('hidden.bs.modal', onHidden)
  element.value.addEventListener('keydown', onKeydown)
  if (props.modelValue) void nextTick(() => {
    if (!instance) return
    showRequested = true
    instance.show()
  })
})

watch(() => props.modelValue, async (open) => {
  await nextTick()
  if (!element.value || !instance) return
  if (open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    showRequested = true
    instance.show()
    await nextTick()
    const autofocus = element.value.querySelector<HTMLElement>('[data-modal-autofocus]')
    ;(autofocus || element.value.querySelector<HTMLElement>('.app-modal__close'))?.focus()
  } else {
    if (props.busy) {
      emit('update:modelValue', true)
      return
    }
    if (props.dirty && !allowHide && !window.confirm('Bạn đã thay đổi nội dung. Bỏ các thay đổi này?')) {
      emit('dismiss-blocked')
      emit('update:modelValue', true)
      return
    }
    allowHide = true
    instance.hide()
  }
})

onBeforeUnmount(() => {
  if (!element.value) return
  const modalElement = element.value
  const modalInstance = instance
  modalElement.removeEventListener('hide.bs.modal', onHide)
  modalElement.removeEventListener('hidden.bs.modal', onHidden)
  modalElement.removeEventListener('keydown', onKeydown)

  if (!modalInstance) return

  const isActive = showRequested
    || modalElement.classList.contains('show')
    || modalElement.getAttribute('aria-hidden') === 'false'

  if (!isActive) {
    modalInstance.dispose()
    instance = null
    return
  }

  const disposeAfterHide = () => {
    modalElement.removeEventListener('shown.bs.modal', hideAfterShow)
    modalInstance.dispose()
  }
  const hideAfterShow = () => modalInstance.hide()

  // Bootstrap's dispose() does not restore the body scroll lock. Let hide()
  // complete its normal cleanup, including when the opening transition is
  // still in progress as the route unmounts this component.
  modalElement.addEventListener('hidden.bs.modal', disposeAfterHide, { once: true })
  modalElement.addEventListener('shown.bs.modal', hideAfterShow, { once: true })
  modalInstance.hide()
  instance = null
})
</script>

<template>
  <Teleport to="body">
    <div v-bind="$attrs" ref="element" class="modal fade app-modal" tabindex="-1" role="dialog" :aria-labelledby="titleId" :aria-describedby="description ? descriptionId : undefined" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" :class="[`modal-${size}`, { 'app-modal__sheet': true }]">
        <section class="modal-content">
          <header class="modal-header">
            <div>
              <h2 :id="titleId" class="modal-title">{{ title }}</h2>
              <p v-if="description" :id="descriptionId" class="app-modal__description">{{ description }}</p>
            </div>
            <button class="app-modal__close" type="button" aria-label="Đóng hộp thoại" :disabled="busy" @click="close">
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div class="modal-body"><slot /></div>
          <footer v-if="$slots.footer" class="modal-footer"><slot name="footer" /></footer>
        </section>
      </div>
    </div>
  </Teleport>
</template>
