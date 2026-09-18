import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { normalizeAppError, type NormalizedAppError } from '@/shared/utils/errors'

export const useAppErrorStore = defineStore('app-error', () => {
  const current = ref<NormalizedAppError | null>(null)
  const hasError = computed(() => Boolean(current.value))

  function report(error: unknown, fallback: string): NormalizedAppError {
    const normalized = normalizeAppError(error, fallback)
    current.value = normalized
    return normalized
  }

  function clear() {
    current.value = null
  }

  return { current, hasError, report, clear }
})
