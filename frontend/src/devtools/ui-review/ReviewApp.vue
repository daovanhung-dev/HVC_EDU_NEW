<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppErrorBanner from '@/app/components/AppErrorBanner.vue'
import AppToastHost from '@/app/components/AppToastHost.vue'
import { useAuthStore, type ReviewRole } from './mock-auth.store'
import { reviewState, setReviewMode, type ReviewMode } from './review-state'

const pages: Array<{ label: string; path: string; role: ReviewRole }> = [
  { label: 'Admin · Học sinh', path: '/admin/students', role: 'ADMIN' },
  { label: 'Admin · Chi tiết học sinh', path: '/admin/students/qa-student-1', role: 'ADMIN' },
  { label: 'Admin · Nhân sự', path: '/admin/staff', role: 'ADMIN' },
  { label: 'Admin · Lớp học', path: '/admin/classes', role: 'ADMIN' },
  { label: 'Admin · Chi tiết lớp', path: '/admin/classes/qa-class-1', role: 'ADMIN' },
  { label: 'Admin · Lịch buổi học', path: '/admin/sessions', role: 'ADMIN' },
  { label: 'Admin · Duyệt công', path: '/admin/timesheets', role: 'ADMIN' },
  { label: 'Giáo viên · Buổi học', path: '/staff/sessions', role: 'TEACHER' },
  { label: 'Giáo viên · Hồ sơ', path: '/staff/profile', role: 'TEACHER' },
  { label: 'Giáo viên · Chấm công', path: '/staff/timesheets', role: 'TEACHER' },
  { label: 'Học sinh · Lịch học', path: '/student/schedule', role: 'STUDENT' },
  { label: 'Học sinh · Kết quả', path: '/student/attendance', role: 'STUDENT' },
  { label: 'Đăng nhập', path: '/login', role: 'ADMIN' },
  { label: 'Đổi mật khẩu', path: '/auth/change-password', role: 'ADMIN' },
]
const modes: Array<{ value: ReviewMode; label: string }> = [
  { value: 'normal', label: 'Dữ liệu QA' },
  { value: 'empty', label: 'Trạng thái rỗng' },
  { value: 'error', label: 'Lỗi tải' },
  { value: 'slow', label: 'Tải chậm' },
]
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const selectedPath = ref(route.path)
const mode = ref<ReviewMode>(reviewState.mode)
const refreshKey = ref(0)
const viewport = ref(0)
const embedded = window.self !== window.top
const selectedPage = computed(() => pages.find((page) => page.path === route.path) || pages[0])
const previewUrl = computed(() => `/?mode=${mode.value}&refresh=${refreshKey.value}#${selectedPath.value}`)
let tableObserver: MutationObserver | undefined

function addMobileTableLabels(root: ParentNode = document) {
  const tables = new Set(root.querySelectorAll<HTMLTableElement>('.table-responsive table:not(.calendar-grid):not([data-table-scroll])'))
  if (root instanceof Element) {
    const parentTable = root.closest<HTMLTableElement>('.table-responsive table:not(.calendar-grid):not([data-table-scroll])')
    if (parentTable) tables.add(parentTable)
  }
  tables.forEach((table) => {
    const labels = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent?.trim() || '')
    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => Array.from(row.cells).forEach((cell, index) => {
      if (!cell.hasAttribute('colspan') && labels[index]) cell.dataset.label = labels[index]
    }))
  })
}

onMounted(() => {
  addMobileTableLabels()
  tableObserver = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node instanceof HTMLElement) addMobileTableLabels(node)
  })))
  tableObserver.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true })
})
onBeforeUnmount(() => tableObserver?.disconnect())

watch(() => route.path, (path) => {
  selectedPath.value = path
  const page = pages.find((item) => item.path === path)
  if (page) auth.setRole(page.role)
}, { immediate: true })

function navigate() {
  const page = pages.find((item) => item.path === selectedPath.value)
  if (page) auth.setRole(page.role)
  void router.push(selectedPath.value)
}

function applyMode() {
  setReviewMode(mode.value)
  refreshKey.value += 1
}

function refreshPreview() { refreshKey.value += 1 }

const viewportOptions = [0, 320, 375, 768, 1024, 1440]
if (embedded) {
  const requestedMode = new URLSearchParams(window.location.search).get('mode') as ReviewMode | null
  if (requestedMode && modes.some((item) => item.value === requestedMode)) setReviewMode(requestedMode)
}
</script>

<template>
  <div class="review-harness" :class="{ 'review-harness--embed': embedded }">
    <template v-if="embedded">
      <AppErrorBanner />
      <section class="review-content"><RouterView v-slot="{ Component }"><component :is="Component" :key="`${route.fullPath}:${refreshKey}`" /></RouterView></section>
      <AppToastHost />
    </template>
    <template v-else>
    <header class="review-toolbar" aria-label="Bộ điều khiển UI review QA">
      <div class="review-toolbar__brand"><strong>HVC_EDU</strong><span>UI review · chỉ dữ liệu tổng hợp</span></div>
      <div class="review-toolbar__controls">
        <label class="visually-hidden" for="review-screen">Màn hình cần xem</label>
        <select id="review-screen" v-model="selectedPath" class="form-select form-select-sm" @change="navigate">
          <option v-for="page in pages" :key="page.path" :value="page.path">{{ page.label }}</option>
        </select>
        <label class="visually-hidden" for="review-mode">Trạng thái dữ liệu</label>
        <select id="review-mode" v-model="mode" class="form-select form-select-sm" @change="applyMode">
          <option v-for="item in modes" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
        <label class="visually-hidden" for="review-viewport">Chiều rộng review</label>
        <select id="review-viewport" v-model.number="viewport" class="form-select form-select-sm review-viewport-select" aria-label="Chiều rộng review">
          <option v-for="width in viewportOptions" :key="width" :value="width">{{ width ? `${width}px` : 'Desktop' }}</option>
        </select>
        <button class="btn btn-sm btn-outline-primary" type="button" @click="refreshPreview">Tải lại</button>
      </div>
      <span class="review-toolbar__current">{{ selectedPage.label }}</span>
    </header>
    <AppErrorBanner />
    <div v-if="viewport" class="review-device-stage">
      <div class="review-device-stage__caption">{{ selectedPage.label }} · viewport {{ viewport }} × 820px · {{ modes.find((item) => item.value === mode)?.label }}</div>
      <iframe :key="previewUrl" class="review-device-stage__frame" :style="{ width: `${viewport}px` }" :src="previewUrl" :title="`UI review ${selectedPage.label} tại ${viewport}px`" />
    </div>
    <section v-else class="review-content"><RouterView v-slot="{ Component }"><component :is="Component" :key="`${route.fullPath}:${refreshKey}`" /></RouterView></section>
    <AppToastHost />
    </template>
  </div>
</template>

<style>
:root { --review-toolbar-height: 64px; }
.review-toolbar { position: sticky; top: 0; z-index: 1200; display: flex; min-height: var(--review-toolbar-height); align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #c9d8d5; padding: 8px 16px; background: #fff; box-shadow: 0 2px 8px rgb(29 44 47 / 8%); }
.review-toolbar__brand { display: grid; min-width: 170px; line-height: 1.2; }
.review-toolbar__brand strong { color: #0e6f7b; font-size: 14px; }
.review-toolbar__brand span, .review-toolbar__current { color: #506266; font-size: 11px; }
.review-toolbar__controls { display: flex; flex: 1; justify-content: center; gap: 8px; }
.review-toolbar__controls select:first-of-type { width: min(340px, 36vw); }
.review-toolbar__controls select:nth-of-type(2) { width: 150px; }
.review-viewport-select { width: 112px !important; }
.review-device-stage { display: grid; justify-items: center; gap: 8px; min-height: calc(100vh - var(--review-toolbar-height)); overflow: auto; padding: 12px; background: #e8eeec; }
.review-device-stage__caption { color: #506266; font-size: 12px; font-weight: 600; }
.review-device-stage__frame { box-sizing: content-box; display: block; height: min(820px, calc(100vh - 112px)); border: 1px solid #aabbb7; border-radius: 8px; background: #fff; box-shadow: 0 4px 18px rgb(29 44 47 / 13%); }
.review-harness--embed { --review-toolbar-height: 0px; }
.review-content .app-sidebar, .review-content .app-rail { top: var(--review-toolbar-height); min-height: calc(100vh - var(--review-toolbar-height)); }
.review-content .app-topbar { top: var(--review-toolbar-height); }
@media (max-width: 767.98px) {
  .review-harness:not(.review-harness--embed) { --review-toolbar-height: 100px; }
  .review-toolbar { min-height: var(--review-toolbar-height); align-items: flex-start; flex-wrap: wrap; gap: 5px 8px; padding: 7px 10px; }
  .review-toolbar__brand { min-width: 0; }
  .review-toolbar__current { display: none; }
  .review-toolbar__controls { flex-basis: 100%; gap: 6px; }
  .review-toolbar__controls select:first-of-type { min-width: 0; width: 1px; flex: 1; }
  .review-toolbar__controls select:nth-of-type(2) { width: 115px; }
  .review-toolbar__controls .review-viewport-select { width: 82px !important; }
  .review-toolbar__controls .btn { min-width: 76px; }
}
</style>
