<script setup lang="ts">
import BaseModal from './BaseModal.vue'

withDefaults(defineProps<{ modelValue: boolean; title: string; description?: string; size?: 'sm' | 'lg' | 'xl' }>(), { description: '', size: 'lg' })
defineEmits<{ 'update:modelValue': [value: boolean]; hidden: [] }>()
</script>

<template>
  <BaseModal :model-value="modelValue" :title="title" :description="description" :size="size" @update:model-value="$emit('update:modelValue', $event)" @hidden="$emit('hidden')">
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </BaseModal>
</template>
