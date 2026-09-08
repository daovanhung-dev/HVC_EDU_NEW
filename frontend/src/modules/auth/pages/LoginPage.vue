<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { isSupabaseConfigured } from '@/services/supabase'

const auth = useAuthStore()
const router = useRouter()
const identifier = ref('')
const password = ref('')
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  try {
    await auth.login(identifier.value.trim(), password.value)
    await router.push('/dashboard')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể đăng nhập'
  }
}
</script>

<template>
  <div class="card border-0 shadow-sm">
    <div class="card-body p-4 p-lg-5">
      <h2 class="h5 mb-1">Đăng nhập</h2>
      <p class="text-secondary small mb-4">Sử dụng username, mã học sinh, số điện thoại hoặc email.</p>
      <div v-if="!isSupabaseConfigured" class="alert alert-warning small">Chưa cấu hình Supabase. Hãy export các biến VITE_* trước khi chạy ứng dụng.</div>
      <div v-if="errorMessage" class="alert alert-danger small">{{ errorMessage }}</div>
      <form @submit.prevent="submit">
        <label class="form-label" for="identifier">Tài khoản</label>
        <input id="identifier" v-model="identifier" class="form-control mb-3" autocomplete="username" required />
        <label class="form-label" for="password">Mật khẩu</label>
        <input id="password" v-model="password" type="password" class="form-control mb-4" autocomplete="current-password" required />
        <button class="btn btn-primary w-100" :disabled="auth.loading || !isSupabaseConfigured">
          <span v-if="auth.loading" class="spinner-border spinner-border-sm me-2" />Đăng nhập
        </button>
      </form>
    </div>
  </div>
</template>
