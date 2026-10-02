<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{
  kind: 'loading' | 'empty' | 'error'
  title: string
  message?: string
  retryLabel?: string
}>(), { message: '', retryLabel: 'Thử lại' })

defineEmits<{ retry: [] }>()
</script>

<template>
  <Transition name="state" appear>
    <div class="app-state" :class="`app-state--${kind}`" :role="kind === 'loading' ? 'status' : kind === 'error' ? 'alert' : 'region'" :aria-live="kind === 'loading' || kind === 'error' ? 'polite' : undefined">
      <div class="app-state__icon" aria-hidden="true">
        <span v-if="kind === 'loading'" class="app-state__spinner"></span>
        <AppIcon v-else :name="kind === 'error' ? 'alert' : 'info'" :size="22" />
      </div>
      <h2>{{ title }}</h2>
      <p v-if="message">{{ message }}</p>
      <div v-if="$slots.default" class="app-state__actions"><slot /></div>
      <button v-else-if="kind === 'error'" class="btn btn-outline-primary" type="button" @click="$emit('retry')">{{ retryLabel }}</button>
    </div>
  </Transition>
</template>
