<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const message = ref('')
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  message.value = ''
  if (password.value.length < 8) return void (errorMessage.value = 'Mật khẩu phải có ít nhất 8 ký tự.')
  if (password.value !== confirmPassword.value) return void (errorMessage.value = 'Hai mật khẩu không khớp.')
  try {
    await auth.updatePassword(password.value)
    message.value = 'Đổi mật khẩu thành công.'
    await router.push('/dashboard')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể đổi mật khẩu'
  }
}
</script>

<template>
  <div class="card border-0 shadow-sm">
    <div class="card-body p-4 p-lg-5">
      <h2 class="h5 mb-1">Đổi mật khẩu</h2>
      <p class="text-secondary small mb-4">Vui lòng đổi mật khẩu trước khi sử dụng hệ thống.</p>
      <div v-if="errorMessage" class="alert alert-danger small">{{ errorMessage }}</div>
      <div v-if="message" class="alert alert-success small">{{ message }}</div>
      <form @submit.prevent="submit">
        <label class="form-label" for="new-password">Mật khẩu mới</label>
        <input id="new-password" v-model="password" type="password" class="form-control mb-3" autocomplete="new-password" required />
        <label class="form-label" for="confirm-password">Nhập lại mật khẩu</label>
        <input id="confirm-password" v-model="confirmPassword" type="password" class="form-control mb-4" autocomplete="new-password" required />
        <button class="btn btn-primary w-100" :disabled="auth.loading">Cập nhật mật khẩu</button>
      </form>
    </div>
  </div>
</template>
