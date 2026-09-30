<script setup lang="ts">
withDefaults(defineProps<{
  id: string
  label: string
  description?: string
  error?: string
  required?: boolean
}>(), { required: false })
</script>

<template>
  <div class="app-field" :class="{ 'app-field--invalid': error }">
    <label class="form-label" :for="id">
      {{ label }}<span v-if="required" class="app-field__required" aria-hidden="true"> *</span>
      <span v-if="required" class="visually-hidden"> (bắt buộc)</span>
    </label>
    <slot :id="id" :described-by="[description ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined" />
    <div v-if="description" :id="`${id}-help`" class="app-field__help">{{ description }}</div>
    <div v-if="error" :id="`${id}-error`" class="app-field__error" role="alert">{{ error }}</div>
  </div>
</template>
