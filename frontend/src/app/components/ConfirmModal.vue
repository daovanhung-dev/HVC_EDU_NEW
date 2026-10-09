<script setup lang="ts">
import BaseModal from './BaseModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message: string
  itemName?: string
  warning?: string
  error?: string
  confirmLabel?: string
  busy?: boolean
  destructive?: boolean
}>(), { itemName: '', warning: '', error: '', confirmLabel: 'Xác nhận', busy: false, destructive: false })

defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  hidden: []
}>()
</script>

<template>
  <BaseModal class="app-confirm-modal" :model-value="modelValue" :title="title" size="sm" :busy="busy" @update:model-value="$emit('update:modelValue', $event)" @hidden="$emit('hidden')">
    <div class="app-confirm">
      <p>{{ message }}</p>
      <div v-if="itemName" class="app-confirm__item">{{ itemName }}</div>
      <div v-if="error" class="alert alert-danger mt-3 mb-0" role="alert">{{ error }}</div>
      <p v-if="warning" class="app-confirm__warning">{{ warning }}</p>
    </div>
    <template #footer>
      <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="$emit('update:modelValue', false)">Hủy</button>
      <button type="button" class="btn" :class="destructive ? 'btn-danger' : 'btn-primary'" :disabled="busy" :aria-busy="busy || undefined" @click="$emit('confirm')">
        <span v-if="busy" class="app-button__spinner" aria-hidden="true"></span>{{ busy ? 'Đang xử lý…' : confirmLabel }}
      </button>
    </template>
  </BaseModal>
</template>
