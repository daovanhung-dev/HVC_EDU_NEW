<script setup lang="ts">
import { computed } from 'vue'

withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
}>(), { variant: 'primary', size: 'md', type: 'button', loading: false, disabled: false })

const classes = computed(() => ({
  primary: 'btn-primary',
  secondary: 'btn-outline-secondary',
  outline: 'btn-outline-primary',
  ghost: 'btn-link',
  danger: 'btn-danger',
  success: 'btn-success',
}))
</script>

<template>
  <button :type="type" class="btn app-button" :class="[classes[variant], size !== 'md' ? `btn-${size}` : '']" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <span v-if="loading" class="app-button__spinner" aria-hidden="true"></span>
    <slot />
  </button>
</template>
