<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getStudent, getStudentHistory } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

const route = useRoute()
const student = ref<any | null>(null)
const history = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')
const statusLabel = (status: string) => ({ PRESENT: 'Có mặt', LATE: 'Đi muộn', ABSENT: 'Vắng', EXCUSED: 'Có phép' }[status] || status)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const id = String(route.params.studentId)
    ;[student.value, history.value] = await Promise.all([getStudent(id), getStudentHistory(id)])
    if (!student.value) errorMessage.value = 'Không tìm thấy học sinh.'
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải hồ sơ học sinh.' }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <AppPageHeader :title="student?.full_name || 'Hồ sơ học sinh'" eyebrow="Hồ sơ học tập">
    <template #actions><RouterLink to="/admin/students" class="btn btn-outline-primary">Danh sách học sinh</RouterLink></template>
  </AppPageHeader>
  <AppState v-if="loading" kind="loading" title="Đang tải hồ sơ học sinh" />
  <AppState v-else-if="errorMessage && !student" kind="error" title="Không thể mở hồ sơ học sinh" :message="errorMessage"><button class="btn btn-outline-primary" type="button" @click="load">Thử tải lại</button></AppState>
  <div v-else-if="student">
    <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
    <section class="card mb-4"><div class="card-body"><div class="row g-3"><div class="col-md-4"><div class="small text-secondary">Mã học sinh</div><strong>{{ student.student_code }}</strong></div><div class="col-md-4"><div class="small text-secondary">Trạng thái</div><strong>{{ student.status === 'ACTIVE' ? 'Đang hoạt động' : student.status === 'LOCKED' ? 'Đã khóa' : student.status }}</strong></div><div class="col-md-4"><div class="small text-secondary">Tài khoản phụ huynh/học sinh</div><strong>{{ student.user_id ? 'Đã liên kết' : 'Chưa liên kết' }}</strong></div><div class="col-md-4"><div class="small text-secondary">Điện thoại</div>{{ student.phone || '—' }}</div><div class="col-md-4"><div class="small text-secondary">Email</div>{{ student.email || '—' }}</div><div class="col-md-4"><div class="small text-secondary">Phụ huynh</div>{{ student.parent_name || '—' }} · {{ student.parent_phone || '—' }}</div><div class="col-12"><div class="small text-secondary">Địa chỉ</div>{{ student.address || '—' }}</div></div></div></section>
    <section class="card"><div class="card-body"><div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3"><div><h2 class="h5 mb-1">Lịch sử buổi học</h2><p class="small text-secondary mb-0">Thông tin điểm danh, kết quả và nhận xét được giữ theo từng buổi.</p></div><button class="btn btn-outline-primary btn-sm" type="button" :disabled="loading" @click="load">Làm mới</button></div>
      <AppState v-if="!history.length" kind="empty" title="Chưa có lịch sử buổi học" message="Các buổi đã diễn ra sẽ xuất hiện tại đây." />
      <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp</th><th>Giáo viên</th><th>Buổi học</th><th>Chuyên cần</th><th>Điểm và nhận xét</th></tr></thead><tbody><tr v-for="row in history" :key="row.id"><td>{{ formatDateTime(row.scheduled_start_at) }}</td><td>{{ row.classes?.name || '—' }}</td><td>{{ row.teachers.join(', ') || '—' }}</td><td>{{ row.status }}<br><small>{{ row.session_note || '' }}</small></td><td>{{ row.attendance ? statusLabel(row.attendance.status) : 'Chưa ghi nhận' }}<span v-if="row.attendance?.late_minutes"> · {{ row.attendance.late_minutes }} phút</span><small v-if="row.attendance?.absence_reason" class="d-block">{{ row.attendance.absence_reason }}</small></td><td>BTVN {{ row.attendance?.homework_score ?? '—' }}/10<span v-if="row.attendance?.homework_note"> · {{ row.attendance.homework_note }}</span><br><small>Hiểu bài {{ row.attendance?.understanding_score ?? '—' }}/5 · Thái độ {{ row.attendance?.attitude_score ?? '—' }}/5 · Điểm cộng {{ row.attendance?.positive_feedback_count ?? 0 }}</small><small v-if="row.attendance?.positive_feedback_raw" class="d-block">{{ row.attendance.positive_feedback_raw }}</small><small class="d-block">{{ row.attendance?.comment || 'Chưa có nhận xét' }}</small></td></tr></tbody></table></div>
    </div></section>
  </div>
</template>
