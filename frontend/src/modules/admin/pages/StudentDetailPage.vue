<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getStudent, getStudentHistory } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'

const route = useRoute()
const student = ref<any | null>(null)
const history = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')
const statusLabel = (status: string) => ({ PRESENT: 'Có mặt', LATE: 'Đi muộn', ABSENT: 'Vắng', EXCUSED: 'Có phép' }[status] || status)

onMounted(async () => {
  loading.value = true
  try {
    const id = String(route.params.studentId)
    ;[student.value, history.value] = await Promise.all([getStudent(id), getStudentHistory(id)])
    if (!student.value) errorMessage.value = 'Không tìm thấy học sinh.'
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải hồ sơ học sinh.' }
  finally { loading.value = false }
})
</script>

<template>
  <div class="mb-4"><RouterLink to="/admin/students" class="small text-decoration-none">← Danh sách học sinh</RouterLink><div class="small text-secondary mt-2">Hồ sơ học tập</div><h1 class="h3 mb-0">{{ student?.full_name || 'Học sinh' }}</h1></div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div v-if="student" class="card border-0 shadow-sm mb-4"><div class="card-body"><div class="row g-3"><div class="col-md-4"><div class="small text-secondary">Mã học sinh</div><strong>{{ student.student_code }}</strong></div><div class="col-md-4"><div class="small text-secondary">Trạng thái</div><strong>{{ student.status }}</strong></div><div class="col-md-4"><div class="small text-secondary">Tài khoản phụ huynh/học sinh</div><strong>{{ student.user_id ? 'Đã liên kết' : 'Chưa liên kết' }}</strong></div><div class="col-md-4"><div class="small text-secondary">Điện thoại</div>{{ student.phone || '—' }}</div><div class="col-md-4"><div class="small text-secondary">Email</div>{{ student.email || '—' }}</div><div class="col-md-4"><div class="small text-secondary">Phụ huynh</div>{{ student.parent_name || '—' }} · {{ student.parent_phone || '—' }}</div><div class="col-12"><div class="small text-secondary">Địa chỉ</div>{{ student.address || '—' }}</div></div></div></div>
  <div class="card border-0 shadow-sm"><div class="card-body"><h2 class="h5">Lịch sử buổi học</h2><div v-if="loading" class="text-secondary py-3">Đang tải…</div><div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp</th><th>Giáo viên</th><th>Buổi học</th><th>Chuyên cần</th><th>Điểm và nhận xét</th></tr></thead><tbody><tr v-for="row in history" :key="row.id"><td>{{ formatDateTime(row.scheduled_start_at) }}</td><td>{{ row.classes?.name || '—' }}</td><td>{{ row.teachers.join(', ') || '—' }}</td><td>{{ row.status }}<br><small>{{ row.session_note || '' }}</small></td><td>{{ row.attendance ? statusLabel(row.attendance.status) : 'Chưa ghi nhận' }}<span v-if="row.attendance?.late_minutes"> · {{ row.attendance.late_minutes }} phút</span><small v-if="row.attendance?.absence_reason" class="d-block">{{ row.attendance.absence_reason }}</small></td><td>BTVN {{ row.attendance?.homework_score ?? '—' }}/10<span v-if="row.attendance?.homework_note"> · {{ row.attendance.homework_note }}</span><br><small>Hiểu bài {{ row.attendance?.understanding_score ?? '—' }}/5 · Thái độ {{ row.attendance?.attitude_score ?? '—' }}/5 · Điểm cộng {{ row.attendance?.positive_feedback_count ?? 0 }}</small><small v-if="row.attendance?.positive_feedback_raw" class="d-block">{{ row.attendance.positive_feedback_raw }}</small><small class="d-block">{{ row.attendance?.comment || 'Chưa có nhận xét' }}</small></td></tr><tr v-if="!loading && !history.length"><td colspan="6" class="text-center text-secondary py-4">Chưa có lịch sử buổi học.</td></tr></tbody></table></div></div></div>
</template>
