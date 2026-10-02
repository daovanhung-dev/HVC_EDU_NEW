<script setup lang="ts">
import BaseModal from './BaseModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  title: string
  description?: string
  size?: 'sm' | 'lg' | 'xl'
  busy?: boolean
  dirty?: boolean
  submitLabel?: string
  submittingLabel?: string
  submitDisabled?: boolean
}>(), { description: '', size: 'lg', busy: false, dirty: false, submitLabel: 'Lưu', submittingLabel: 'Đang lưu…', submitDisabled: false })

defineEmits<{
  'update:modelValue': [value: boolean]
  submit: []
  cancel: []
  'dismiss-blocked': []
  hidden: []
}>()
</script>

<template>
  <BaseModal :model-value="modelValue" :title="title" :description="description" :size="size" :busy="busy" :dirty="dirty" @update:model-value="$emit('update:modelValue', $event)" @dismiss-blocked="$emit('dismiss-blocked')" @hidden="$emit('hidden')">
    <slot />
    <template #footer>
      <slot name="footer">
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="$emit('cancel')">Hủy</button>
        <button type="button" class="btn btn-primary" :disabled="busy || submitDisabled" :aria-busy="busy || undefined" @click="$emit('submit')">
          <span v-if="busy" class="app-button__spinner" aria-hidden="true"></span>{{ busy ? submittingLabel : submitLabel }}
        </button>
      </slot>
    </template>
  </BaseModal>
</template>
