<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getMyAttendance, getMySessions, getMyTuition } from '@/services/data-queries'
import { formatDateTime, formatVnd } from '@/shared/utils/format'

const route = useRoute()
const loading = ref(false)
const errorMessage = ref('')
const sessions = ref<any[]>([])
const attendance = ref<any[]>([])
const tuition = ref<any[]>([])
const moduleName = computed(() => String(route.params.module))
const title = computed(() => moduleName.value === 'tuition' ? 'Học phí' : moduleName.value === 'attendance' ? 'Kết quả học tập' : 'Lịch học')

async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    if (moduleName.value === 'tuition') tuition.value = await getMyTuition() as any[]
    else if (moduleName.value === 'attendance') attendance.value = await getMyAttendance() as any[]
    else sessions.value = await getMySessions() as any[]
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải dữ liệu' } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-4"><div><div class="small text-secondary">Student portal</div><h1 class="h3 mb-0">{{ title }}</h1></div><button class="btn btn-outline-primary" @click="load">Làm mới</button></div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body">
    <div v-if="moduleName === 'tuition'" class="table-responsive"><table class="table align-middle"><thead><tr><th>Tháng</th><th>Học phí</th><th>Đã đóng</th><th>Trạng thái</th><th>Thanh toán</th></tr></thead><tbody><tr v-for="row in tuition" :key="row.id"><td>{{ row.class_months?.month }}/{{ row.class_months?.year }} — {{ row.class_months?.classes?.name }}</td><td>{{ formatVnd(row.amount_due) }}</td><td>{{ formatVnd(row.amount_paid) }}</td><td><span class="badge" :class="row.status === 'PAID' ? 'text-bg-success' : 'text-bg-warning'">{{ row.status }}</span></td><td>{{ row.payment_method || '—' }}<br><small class="text-secondary">{{ formatDateTime(row.paid_at) }}</small></td></tr><tr v-if="!loading && !tuition.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có học phí</td></tr></tbody></table></div>
    <div v-else-if="moduleName === 'attendance'" class="table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp</th><th>Điểm danh</th><th>BTVN</th><th>Nhận xét</th></tr></thead><tbody><tr v-for="row in attendance" :key="row.id"><td>{{ formatDateTime(row.sessions?.scheduled_start_at) }}</td><td>{{ row.sessions?.class_months?.classes?.name || '—' }}</td><td><span class="badge" :class="row.status === 'PRESENT' || row.status === 'LATE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status }}{{ row.late_minutes ? ` (${row.late_minutes} phút)` : '' }}</span></td><td>{{ row.homework_score ?? '—' }}/10</td><td>{{ row.comment || '—' }}</td></tr><tr v-if="!loading && !attendance.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có kết quả sau các buổi học hoàn thành</td></tr></tbody></table></div>
    <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody><tr v-for="row in sessions" :key="row.id"><td>{{ formatDateTime(row.scheduled_start_at) }}</td><td>{{ row.class_months?.classes?.name || '—' }}</td><td><span class="badge" :class="row.status === 'COMPLETED' ? 'text-bg-success' : row.status === 'CANCELLED' ? 'text-bg-danger' : 'text-bg-secondary'">{{ row.status }}</span></td><td>{{ row.status === 'CANCELLED' ? 'Buổi học đã hủy' : row.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Theo lịch trung tâm' }}</td></tr><tr v-if="!loading && !sessions.length"><td colspan="4" class="text-center text-secondary py-4">Chưa có lịch học</td></tr></tbody></table></div>
  </div></div>
</template>
