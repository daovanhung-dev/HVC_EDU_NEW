import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'success' | 'warning' | 'error' | 'info'
export interface AppToast { id: number; kind: ToastKind; message: string }

export const useToastStore = defineStore('toast', () => {
  const items = ref<AppToast[]>([])
  let nextId = 0
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function dismiss(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
  }

  function show(kind: ToastKind, message: string, duration = kind === 'error' ? 8000 : 4200) {
    const id = ++nextId
    items.value.push({ id, kind, message })
    if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration))
    return id
  }

  return {
    items,
    dismiss,
    success: (message: string, duration?: number) => show('success', message, duration),
    warning: (message: string, duration?: number) => show('warning', message, duration),
    error: (message: string, duration?: number) => show('error', message, duration),
    info: (message: string, duration?: number) => show('info', message, duration),
  }
})
