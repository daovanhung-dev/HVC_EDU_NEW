<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import AppIcon from '@/app/components/AppIcon.vue'
import logoUrl from '../../../../assets/logo.jpg'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const roleLabel = computed(() => auth.isAdmin ? 'Quản trị viên' : auth.isTeacher ? 'Giáo viên' : 'Học sinh')
const links = computed(() => {
  if (auth.isLearner) return [
    { to: '/student/schedule', label: 'Lịch học', icon: 'schedule' },
    { to: '/student/attendance', label: 'Kết quả', icon: 'results' },
  ]
  if (auth.isTeacher) return [
    { to: '/staff/sessions', label: 'Buổi học', icon: 'sessions' },
    { to: '/staff/timesheets', label: 'Chấm công', icon: 'timesheets' },
    { to: '/staff/profile', label: 'Hồ sơ', icon: 'profile' },
  ]
  return [
    { to: '/admin/students', label: 'Học sinh', icon: 'students' },
    { to: '/admin/staff', label: 'Nhân sự', icon: 'staff' },
    { to: '/admin/classes', label: 'Lớp và lịch', icon: 'classes' },
    { to: '/admin/sessions', label: 'Buổi học', icon: 'sessions' },
    { to: '/admin/timesheets', label: 'Duyệt công', icon: 'timesheets' },
  ]
})
const pageTitle = computed(() => {
  const path = route.path
  if (/\/admin\/students\/[^/]+/.test(path)) return 'Hồ sơ học sinh'
  if (/\/admin\/classes\/[^/]+/.test(path)) return 'Chi tiết lớp'
  return links.value.find((link) => path.startsWith(link.to))?.label || roleLabel.value
})

async function signOut() {
  await auth.signOut()
  await router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <aside class="app-sidebar" aria-label="Điều hướng chính">
      <RouterLink class="app-brand" :to="links[0]?.to || '/'" aria-label="Hùng Cường Education — trang chính">
        <img :src="logoUrl" alt="" />
        <span><span class="app-brand__name">Hùng Cường</span><span class="app-brand__sub">Trung tâm giáo dục</span></span>
      </RouterLink>
      <nav class="app-nav" aria-label="Chức năng">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="app-nav__link">
          <AppIcon :name="link.icon" :size="20" /><span>{{ link.label }}</span>
        </RouterLink>
      </nav>
      <div class="app-account">
        <div class="app-account__person">
          <div class="app-account__avatar" aria-hidden="true">{{ (auth.displayName || auth.username || 'U').slice(0, 1).toUpperCase() }}</div>
          <div class="app-account__details min-w-0"><div class="small fw-semibold text-truncate">{{ auth.displayName || auth.username || 'Người dùng' }}</div><div class="small text-secondary">{{ roleLabel }}</div></div>
        </div>
        <div class="app-account__links"><RouterLink to="/auth/change-password">Đổi mật khẩu</RouterLink><button type="button" @click="signOut">Đăng xuất</button></div>
      </div>
    </aside>

    <aside class="app-rail" aria-label="Điều hướng chính">
      <RouterLink class="app-rail__brand" :to="links[0]?.to || '/'" aria-label="Hùng Cường Education — trang chính"><img :src="logoUrl" alt="" /></RouterLink>
      <nav class="app-nav" aria-label="Chức năng">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="app-nav__link" :aria-label="link.label" :title="link.label">
          <AppIcon :name="link.icon" :size="20" /><span>{{ link.label }}</span>
        </RouterLink>
      </nav>
      <details class="app-account-menu mt-auto">
        <summary :aria-label="`Tài khoản ${auth.displayName || auth.username || ''}`"><span class="app-account__avatar">{{ (auth.displayName || auth.username || 'U').slice(0, 1).toUpperCase() }}</span></summary>
        <div class="app-account-menu__panel"><RouterLink to="/auth/change-password"><AppIcon name="password" :size="18" />Đổi mật khẩu</RouterLink><button type="button" @click="signOut"><AppIcon name="logout" :size="18" />Đăng xuất</button></div>
      </details>
    </aside>

    <section class="app-content">
      <header class="app-topbar">
        <div class="d-flex align-items-center gap-2">
          <img class="d-md-none" :src="logoUrl" alt="" width="38" height="32" style="object-fit:contain" />
          <div><div class="app-topbar__role">{{ roleLabel }}</div><h2 class="app-topbar__title">{{ pageTitle }}</h2></div>
        </div>
        <details class="app-account-menu d-md-none">
          <summary :aria-label="`Mở menu tài khoản ${auth.displayName || auth.username || ''}`"><span class="app-account__avatar">{{ (auth.displayName || auth.username || 'U').slice(0, 1).toUpperCase() }}</span></summary>
          <div class="app-account-menu__panel"><RouterLink to="/auth/change-password"><AppIcon name="password" :size="18" />Đổi mật khẩu</RouterLink><button type="button" @click="signOut"><AppIcon name="logout" :size="18" />Đăng xuất</button></div>
        </details>
        <div class="app-topbar__user d-none d-md-block">{{ auth.displayName || auth.username }}</div>
      </header>
      <main id="main-content" class="app-main" tabindex="-1">
        <RouterView v-slot="{ Component }">
          <Transition name="app" mode="out-in">
            <div :key="route.path" class="app-route-view">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>
    </section>

    <nav class="app-mobile-nav" aria-label="Điều hướng chính">
      <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="app-nav__link">
        <AppIcon :name="link.icon" :size="20" /><span>{{ link.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
