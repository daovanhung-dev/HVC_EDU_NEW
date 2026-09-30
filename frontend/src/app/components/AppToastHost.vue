<script setup lang="ts">
import { useToastStore } from '@/stores/toast.store'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'

const toasts = useToastStore()
</script>

<template>
  <div class="app-toast-host" aria-label="Thông báo" aria-live="polite" aria-relevant="additions text">
    <TransitionGroup name="toast">
      <section v-for="toast in toasts.items" :key="toast.id" class="app-toast" :class="`app-toast--${toast.kind}`" :role="toast.kind === 'error' ? 'alert' : 'status'">
        <AppIcon :name="toast.kind === 'success' ? 'check' : toast.kind === 'error' || toast.kind === 'warning' ? 'alert' : 'info'" :size="19" />
        <p>{{ toast.message }}</p>
        <AppButton variant="ghost" size="sm" class="app-toast__close" :aria-label="`Đóng thông báo: ${toast.message}`" @click="toasts.dismiss(toast.id)"><AppIcon name="close" :size="16" /></AppButton>
      </section>
    </TransitionGroup>
  </div>
</template>
