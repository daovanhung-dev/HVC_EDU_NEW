<script setup lang="ts">
defineProps<{ title: string; eyebrow?: string; description?: string }>()
</script>

<template>
  <header class="app-page-header">
    <div class="app-page-header__copy">
      <div v-if="eyebrow" class="app-page-header__eyebrow">{{ eyebrow }}</div>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="app-page-header__actions"><slot name="actions" /></div>
  </header>
</template>
