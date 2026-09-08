<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { formatVnd } from '@/shared/utils/format'
import { getDashboardSummary } from '@/services/data-queries'

const auth = useAuthStore()
const summary = ref<Awaited<ReturnType<typeof getDashboardSummary>> | null>(null)
const loadError = ref('')
const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date())
const metrics = computed(() => auth.isStudent ? [
  { label: 'Lớp đang học', value: summary.value ? String(summary.value.classes) : '—', hint: 'ClassMonth hiện tại', tone: 'primary' },
  { label: 'Buổi học sắp tới', value: summary.value ? String(summary.value.upcomingSessions) : '—', hint: 'Lịch học của bạn', tone: 'info' },
  { label: 'Học phí tháng', value: summary.value ? formatVnd(summary.value.tuitionDue) : '—', hint: 'Trạng thái thanh toán', tone: 'warning' },
] : auth.isStaff ? [
  { label: 'Buổi dạy tháng này', value: summary.value ? String(summary.value.upcomingSessions + summary.value.completedSessions) : '—', hint: 'Theo phân công', tone: 'primary' },
  { label: 'Chấm công chờ duyệt', value: summary.value ? String(summary.value.pendingTimesheets) : '—', hint: 'Timesheet', tone: 'warning' },
  { label: 'Lương dự kiến', value: formatVnd(null), hint: 'Theo payroll', tone: 'success' },
] : [
  { label: 'Tổng học sinh', value: summary.value ? String(summary.value.students) : '—', hint: 'Đang hoạt động', tone: 'primary' },
  { label: 'Tổng lớp', value: summary.value ? String(summary.value.classes) : '—', hint: 'ClassMonth hiện tại', tone: 'info' },
  { label: 'Học phí đã thu', value: summary.value ? formatVnd(summary.value.tuitionPaid) : formatVnd(null), hint: monthLabel, tone: 'success' },
  { label: 'Chấm công chờ duyệt', value: summary.value ? String(summary.value.pendingTimesheets) : '—', hint: 'Cần xử lý', tone: 'warning' },
])

onMounted(async () => {
  try { summary.value = await getDashboardSummary() } catch (error) { loadError.value = error instanceof Error ? error.message : 'Không thể tải tổng quan' }
})
</script>

<template>
  <div class="mb-4">
    <p class="text-secondary small mb-1">{{ monthLabel }}</p>
    <h1 class="h3 mb-1">Xin chào, {{ auth.displayName || auth.username || 'bạn' }}</h1>
    <p class="text-secondary mb-0">Đây là khu vực tổng quan HVC_EDU.</p>
  </div>
  <div v-if="loadError" class="alert alert-warning small">Một số số liệu chưa tải được: {{ loadError }}</div>
  <div class="row g-3">
    <div v-for="metric in metrics" :key="metric.label" class="col-12 col-md-6 col-xl-3">
      <div class="card metric-card h-100">
        <div class="card-body">
          <div class="small text-secondary mb-2">{{ metric.label }}</div>
          <div class="h4 mb-1">{{ metric.value }}</div>
          <div class="small text-secondary">{{ metric.hint }}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="card border-0 shadow-sm mt-4">
    <div class="card-body p-4">
      <h2 class="h6">Trạng thái khởi tạo</h2>
      <p class="text-secondary mb-0">Frontend shell đã sẵn sàng. Các module nghiệp vụ sẽ đọc dữ liệu qua service và RLS của Supabase.</p>
    </div>
  </div>
</template>
