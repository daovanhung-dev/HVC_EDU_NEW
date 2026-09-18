<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppErrorBanner from '@/app/components/AppErrorBanner.vue'
</script>

<template>
  <AppErrorBanner />
  <RouterView />
</template>
