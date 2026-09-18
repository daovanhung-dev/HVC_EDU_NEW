<script setup lang="ts">
import { useAppErrorStore } from '@/stores/app-error.store'

const errors = useAppErrorStore()
</script>

<template>
  <div v-if="errors.current" class="global-error-banner alert alert-danger shadow-sm" role="alert">
    <div class="d-flex align-items-start gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold">Đã xảy ra lỗi</div>
        <div>{{ errors.current.message }}</div>
        <small class="d-block mt-1">Mã hỗ trợ: {{ errors.current.traceId }}</small>
      </div>
      <button type="button" class="btn-close" aria-label="Đóng thông báo lỗi" @click="errors.clear" />
    </div>
  </div>
</template>
