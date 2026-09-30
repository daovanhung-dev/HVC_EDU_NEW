<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getMyAttendance, getMySessions } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

const route = useRoute()
const loading = ref(false)
const errorMessage = ref('')
const sessions = ref<any[]>([])
const attendance = ref<any[]>([])
const moduleName = computed(() => String(route.params.module))
const title = computed(() => moduleName.value === 'attendance' ? 'Kết quả học tập' : 'Lịch học và lịch sử')
const attendanceLabel = (status: string) => ({ PRESENT: 'Có mặt', LATE: 'Đi muộn', ABSENT: 'Vắng', EXCUSED: 'Có phép' }[status] || status)
const teacherNames = (assignments: any[] = []) => assignments.map((item) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công'

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [sessionRows, attendanceRows] = await Promise.all([getMySessions(), getMyAttendance()])
    sessions.value = sessionRows as any[]
    attendance.value = attendanceRows as any[]
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải dữ liệu' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <AppPageHeader :title="title" eyebrow="Hồ sơ học tập" description="Lịch học, điểm danh và nhận xét từ các buổi học.">
    <template #actions><button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button></template>
  </AppPageHeader>
  <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
  <AppState v-if="loading" kind="loading" title="Đang tải hồ sơ học tập" />
  <div v-else-if="moduleName === 'attendance'" class="card"><div class="card-body table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp và giáo viên</th><th>Điểm danh</th><th>Điểm</th><th>Nhận xét buổi học</th></tr></thead><tbody>
    <tr v-for="row in attendance" :key="row.id"><td>{{ formatDateTime(row.sessions?.scheduled_start_at) }}</td><td><div>{{ row.sessions?.classes?.name || '—' }}</div><small class="text-secondary">{{ teacherNames(row.sessions?.session_staff) }}</small></td><td><span class="badge" :class="row.status === 'PRESENT' || row.status === 'LATE' ? 'text-bg-success' : 'text-bg-secondary'">{{ attendanceLabel(row.status) }}{{ row.late_minutes ? ` (${row.late_minutes} phút)` : '' }}</span><div v-if="row.absence_reason" class="small text-secondary">{{ row.absence_reason }}</div></td><td>BTVN {{ row.homework_score ?? '—' }}/10<span v-if="row.homework_note"> · {{ row.homework_note }}</span><br><small>Hiểu bài {{ row.understanding_score ?? '—' }}/5 · Thái độ {{ row.attitude_score ?? '—' }}/5 · Điểm cộng {{ row.positive_feedback_count ?? 0 }}</small><br><small v-if="row.positive_feedback_raw">{{ row.positive_feedback_raw }}</small></td><td><div>{{ row.comment || '—' }}</div><small v-if="row.sessions?.session_note" class="text-secondary">Nội dung buổi học: {{ row.sessions.session_note }}</small></td></tr>
    <tr v-if="!loading && !attendance.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có kết quả học tập.</td></tr>
  </tbody></table></div></div>
  <div v-else class="card"><div class="card-body table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp</th><th>Giáo viên</th><th>Trạng thái</th><th>Nội dung</th></tr></thead><tbody>
    <tr v-for="row in sessions" :key="row.id"><td>{{ formatDateTime(row.scheduled_start_at) }}</td><td>{{ row.classes?.name || '—' }}</td><td>{{ teacherNames(row.session_staff) }}</td><td><span class="badge" :class="row.status === 'COMPLETED' ? 'text-bg-success' : row.status === 'CANCELLED' ? 'text-bg-danger' : row.status === 'IN_PROGRESS' ? 'text-bg-primary' : 'text-bg-secondary'">{{ row.status }}</span></td><td>{{ row.session_note || (row.status === 'CANCELLED' ? 'Buổi học đã hủy' : row.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Theo lịch lớp') }}</td></tr>
    <tr v-if="!loading && !sessions.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có lịch học.</td></tr>
  </tbody></table></div></div>
</template>
