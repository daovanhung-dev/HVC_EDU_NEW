<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()
const roleLabel = computed(() => auth.isAdmin ? 'ADMIN' : auth.isTeacher ? 'GIÁO VIÊN' : 'HỌC SINH')
const links = computed(() => {
  if (auth.isLearner) return [
    { to: '/student/schedule', label: 'Lịch học', icon: '▦' },
    { to: '/student/attendance', label: 'Kết quả học tập', icon: '◎' },
  ]
  if (auth.isTeacher) return [
    { to: '/staff/sessions', label: 'Buổi học', icon: '▣' },
    { to: '/staff/timesheets', label: 'Chấm công', icon: '✓' },
    { to: '/staff/profile', label: 'Thông tin cá nhân', icon: '◌' },
  ]
  return [
    { to: '/admin/students', label: 'Học sinh', icon: '◎' },
    { to: '/admin/staff', label: 'Nhân sự', icon: '◌' },
    { to: '/admin/classes', label: 'Lớp học và lịch', icon: '▤' },
    { to: '/admin/sessions', label: 'Buổi học', icon: '▣' },
    { to: '/admin/timesheets', label: 'Duyệt công', icon: '✓' },
  ]
})

async function signOut() {
  await auth.signOut()
  await router.push('/login')
}
</script>

<template>
  <div class="app-shell d-flex">
    <aside class="app-sidebar d-none d-lg-flex flex-column bg-white border-end p-3">
      <div class="d-flex align-items-center gap-2 mb-4 px-2">
        <span class="brand-mark">HC</span>
        <div><div class="fw-bold">Hùng Cường</div><small class="text-secondary">HVC_EDU</small></div>
      </div>
      <nav class="nav nav-pills flex-column gap-1">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="nav-link text-secondary">
          <span class="me-2">{{ link.icon }}</span>{{ link.label }}
        </RouterLink>
      </nav>
      <div class="mt-auto pt-3 border-top">
        <div class="small text-secondary px-2 mb-2">Tài khoản</div>
        <div class="d-flex align-items-center gap-2 px-2">
          <div class="rounded-circle bg-primary-subtle text-primary fw-bold p-2">{{ (auth.displayName || 'U').slice(0, 1).toUpperCase() }}</div>
          <div class="min-w-0"><div class="small fw-semibold text-truncate">{{ auth.displayName || auth.username || 'Người dùng' }}</div><div class="small text-secondary">{{ roleLabel }}</div></div>
        </div>
        <RouterLink to="/auth/change-password" class="btn btn-link btn-sm text-decoration-none px-2 mt-2">Đổi mật khẩu</RouterLink>
        <button class="btn btn-link btn-sm text-danger text-decoration-none px-2 mt-1" @click="signOut">Đăng xuất</button>
      </div>
    </aside>
    <section class="app-content flex-grow-1">
      <header class="bg-white border-bottom px-3 px-lg-4 py-3 d-flex justify-content-between align-items-center">
        <div><div class="small text-secondary">Hệ thống quản lý</div><h2 class="h5 mb-0">{{ roleLabel }}</h2></div>
        <span class="small text-secondary">{{ auth.displayName || auth.username }}</span>
      </header>
      <main class="p-3 p-lg-4"><RouterView /></main>
    </section>
  </div>
</template>
