<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useNotificationStore } from '@/stores/notification.store'
import { usePermissionStore } from '@/stores/permission.store'
import { formatDateTime } from '@/shared/utils/format'

const auth = useAuthStore()
const notifications = useNotificationStore()
const permissions = usePermissionStore()
const router = useRouter()
const showNotifications = ref(false)

const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    ROOT_ADMIN: 'ROOT',
    ADMIN: 'ADMIN',
    TEACHER: 'GIÁO VIÊN',
    ASSISTANT: 'TRỢ GIẢNG',
    STUDENT: 'HỌC SINH',
  }
  return labels[auth.role || ''] || 'USER'
})

const links = computed(() => {
  const base = [{ to: '/dashboard', label: 'Tổng quan', icon: '⌂' }]
  if (auth.isStudent) return [...base, { to: '/student/schedule', label: 'Lịch học', icon: '▦' }, { to: '/student/tuition', label: 'Học phí', icon: '₫' }]
  if (auth.isTeacher || auth.isAssistant) return [...base, { to: '/staff/sessions', label: 'Buổi học', icon: '▣' }, { to: '/staff/timesheets', label: 'Chấm công', icon: '✓' }, { to: '/staff/payroll', label: 'Lương của tôi', icon: '₫' }]
  const adminLinks = [
    ...(auth.role === 'ROOT_ADMIN' ? [{ to: '/admin/permissions', label: 'Phân quyền ADMIN', icon: '⚿', permission: 'ROOT_ONLY' }] : []),
    { to: '/admin/students', label: 'Học sinh', icon: '◎', permission: 'STUDENTS_VIEW' },
    { to: '/admin/staff', label: 'Nhân sự', icon: '◌', permission: 'STAFF_VIEW' },
    { to: '/admin/classes', label: 'Lớp học', icon: '▤', permission: 'CLASS_VIEW' },
    { to: '/admin/class-months', label: 'Tháng vận hành', icon: '◫', permission: 'CLASS_MONTH_MANAGE' },
    { to: '/admin/sessions', label: 'Tất cả buổi học', icon: '▣', permission: 'CLASS_MONTH_MANAGE' },
    { to: '/admin/finance', label: 'Tài chính', icon: '₫', permission: 'ACCOUNTING_VIEW' },
    { to: '/admin/reports', label: 'Báo cáo', icon: '▥', permission: 'REPORTS_VIEW' },
    { to: '/admin/timesheets', label: 'Duyệt chấm công', icon: '✓', permission: 'TIMESHEET_VIEW' },
    { to: '/admin/payroll', label: 'Bảng lương', icon: '₫', permission: 'PAYROLL_VIEW' },
    { to: '/admin/audit', label: 'Audit Log', icon: '◌', permission: 'REPORTS_VIEW' },
  ]
  return [...base, ...adminLinks.filter((link) => link.permission === 'ROOT_ONLY' ? auth.role === 'ROOT_ADMIN' : permissions.can(link.permission))]
})

async function signOut() {
  notifications.unsubscribe()
  permissions.clear()
  await auth.signOut()
  await router.push('/login')
}

onMounted(async () => {
  await notifications.refresh()
  notifications.subscribe()
})

onUnmounted(() => notifications.unsubscribe())
</script>

<template>
  <div class="app-shell d-flex">
    <aside class="app-sidebar d-none d-lg-flex flex-column bg-white border-end p-3">
      <div class="d-flex align-items-center gap-2 mb-4 px-2">
        <span class="brand-mark">HC</span>
        <div>
          <div class="fw-bold">Hùng Cường</div>
          <small class="text-secondary">HVC_EDU</small>
        </div>
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
          <div class="min-w-0">
            <div class="small fw-semibold text-truncate">{{ auth.displayName || auth.username || 'Người dùng' }}</div>
            <div class="small text-secondary">{{ roleLabel }}</div>
          </div>
        </div>
        <button class="btn btn-link btn-sm text-danger text-decoration-none px-2 mt-2" @click="signOut">Đăng xuất</button>
      </div>
    </aside>

    <section class="app-content flex-grow-1">
      <header class="bg-white border-bottom px-3 px-lg-4 py-3 d-flex justify-content-between align-items-center">
        <div>
          <div class="small text-secondary">Hệ thống quản lý</div>
          <h2 class="h5 mb-0">{{ roleLabel }}</h2>
        </div>
        <button class="btn btn-light position-relative" title="Thông báo" @click="showNotifications = !showNotifications; notifications.refresh()">
          🔔
          <span v-if="notifications.unreadCount" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{{ notifications.unreadCount }}</span>
        </button>
        <div v-if="showNotifications" class="notification-popover card border-0 shadow position-absolute end-0 top-100 mt-2 me-3" style="width: min(380px, calc(100vw - 2rem)); z-index: 10">
          <div class="card-body p-0">
            <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"><strong class="small">Thông báo</strong><button class="btn btn-link btn-sm text-decoration-none" @click="notifications.markAllRead">Đọc hết</button></div>
            <div v-if="!notifications.items.length" class="small text-secondary text-center py-4">Chưa có thông báo</div>
            <button v-for="item in notifications.items" :key="item.id" class="notification-item w-100 text-start border-0 border-bottom px-3 py-3" :class="{ 'bg-primary-subtle': !item.read_at }" @click="notifications.markRead(item.id)">
              <div class="small fw-semibold">{{ item.title }}</div><div class="small text-secondary mt-1">{{ item.body }}</div><div class="small text-muted mt-1">{{ formatDateTime(item.created_at) }}</div>
            </button>
          </div>
        </div>
      </header>
      <main class="p-3 p-lg-4">
        <RouterView />
      </main>
    </section>
  </div>
</template>
