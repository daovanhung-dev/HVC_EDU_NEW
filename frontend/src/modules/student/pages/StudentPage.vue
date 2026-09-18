<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getMyAttendance, getMySessions, getParentStudents } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const auth = useAuthStore()
const loading = ref(false)
const errorMessage = ref('')
const sessions = ref<any[]>([])
const attendance = ref<any[]>([])
const children = ref<any[]>([])
const selectedChildId = ref('')
const moduleName = computed(() => String(route.params.module))
const title = computed(() => moduleName.value === 'attendance' ? 'Kết quả học tập' : 'Lịch học')
const visibleAttendance = computed(() => selectedChildId.value ? attendance.value.filter((row) => row.students?.id === selectedChildId.value) : attendance.value)
const visibleSessions = computed(() => selectedChildId.value ? sessions.value.filter((row) => (row.session_students || []).some((item: any) => item.student_id === selectedChildId.value)) : sessions.value)

async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    if (auth.isParent && !children.value.length) {
      children.value = await getParentStudents() as any[]
      selectedChildId.value = children.value[0]?.student_id || ''
    }
    if (moduleName.value === 'attendance') attendance.value = await getMyAttendance() as any[]
    else sessions.value = await getMySessions() as any[]
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải dữ liệu' } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4"><div><div class="small text-secondary">Learning portal</div><h1 class="h3 mb-0">{{ title }}</h1></div><div class="d-flex align-items-end gap-2"><div v-if="auth.isParent && children.length"><label class="form-label small mb-1">Học sinh</label><select v-model="selectedChildId" class="form-select form-select-sm"><option v-for="child in children" :key="child.student_id" :value="child.student_id">{{ child.students?.student_code }} — {{ child.students?.full_name }}</option></select></div><button class="btn btn-outline-primary" @click="load">Làm mới</button></div></div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body">
    <div v-if="moduleName === 'attendance'" class="table-responsive"><table class="table align-middle"><thead><tr><th>Học sinh</th><th>Thời gian</th><th>Lớp</th><th>Điểm danh</th><th>Điểm</th><th>Nhận xét</th></tr></thead><tbody><tr v-for="row in visibleAttendance" :key="row.id"><td>{{ row.students?.full_name || '—' }}</td><td>{{ formatDateTime(row.sessions?.scheduled_start_at) }}</td><td>{{ row.sessions?.class_months?.classes?.name || '—' }}</td><td><span class="badge" :class="row.status === 'PRESENT' || row.status === 'LATE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status }}{{ row.late_minutes ? ` (${row.late_minutes} phút)` : '' }}</span></td><td>{{ row.homework_score ?? '—' }}/10<br><small>Hiểu bài {{ row.understanding_score ?? '—' }}/5 · Thái độ {{ row.attitude_score ?? '—' }}/5</small></td><td><div>{{ row.comment || '—' }}</div><small v-if="row.sessions?.session_note" class="text-secondary">Nội dung: {{ row.sessions.session_note }}</small></td></tr><tr v-if="!loading && !visibleAttendance.length"><td colspan="6" class="text-center text-secondary py-4">Chưa có kết quả sau các buổi học hoàn thành</td></tr></tbody></table></div>
    <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp</th><th>Phòng</th><th>Trạng thái</th><th>Nội dung</th></tr></thead><tbody><tr v-for="row in visibleSessions" :key="row.id"><td>{{ formatDateTime(row.scheduled_start_at) }}</td><td>{{ row.class_months?.classes?.name || '—' }}</td><td>{{ row.class_month_schedules?.room ? `Phòng ${row.class_month_schedules.room}` : '—' }}</td><td><span class="badge" :class="row.status === 'COMPLETED' ? 'text-bg-success' : row.status === 'CANCELLED' ? 'text-bg-danger' : 'text-bg-secondary'">{{ row.status }}</span></td><td>{{ row.session_note || (row.status === 'CANCELLED' ? 'Buổi học đã hủy' : row.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Theo lịch trung tâm') }}</td></tr><tr v-if="!loading && !visibleSessions.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có lịch học</td></tr></tbody></table></div>
  </div></div>
</template>
