<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getStudent, getStudentCurrentClasses, getStudentHistory } from '@/services/data-queries'
import type { StudentCurrentClass } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

const route = useRoute()
const student = ref<any | null>(null)
const history = ref<any[]>([])
const currentClasses = ref<StudentCurrentClass[]>([])
const loading = ref(false)
const errorMessage = ref('')
const currentClassesLoading = ref(false)
const currentClassesError = ref('')
const statusLabel = (status: string) => ({ PRESENT: 'Có mặt', LATE: 'Đi muộn', ABSENT: 'Vắng', EXCUSED: 'Có phép' }[status] || status)
const weekdayLabels = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
let currentClassesRequestId = 0

function formatBusinessDate(value: string): string {
  const date = new Date(`${value}T00:00:00+07:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

function teacherNames(schedule: StudentCurrentClass['schedules'][number]): string {
  return [...new Set((schedule.class_schedule_staff || []).map((assignment) => assignment.staff?.full_name).filter(Boolean))].join(', ')
}

async function loadCurrentClasses(studentId = String(route.params.studentId)) {
  const requestId = ++currentClassesRequestId
  currentClassesLoading.value = true
  currentClassesError.value = ''
  currentClasses.value = []
  try {
    const classes = await getStudentCurrentClasses(studentId)
    if (requestId === currentClassesRequestId) currentClasses.value = classes
  } catch (error) {
    if (requestId === currentClassesRequestId) {
      currentClassesError.value = error instanceof Error ? error.message : 'Không thể tải lớp đang học.'
    }
  } finally {
    if (requestId === currentClassesRequestId) currentClassesLoading.value = false
  }
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const id = String(route.params.studentId)
    ;[student.value, history.value] = await Promise.all([getStudent(id), getStudentHistory(id)])
    if (!student.value) errorMessage.value = 'Không tìm thấy học sinh.'
    else void loadCurrentClasses(id)
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
    <section class="card mb-4" aria-labelledby="student-current-classes-title" data-testid="student-current-classes">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
          <div><h2 id="student-current-classes-title" class="h5 mb-1">Lớp đang học</h2><p class="small text-secondary mb-0">Các lớp có membership hiệu lực hôm nay.</p></div>
          <button class="btn btn-outline-primary btn-sm" type="button" :disabled="currentClassesLoading" @click="loadCurrentClasses()">Làm mới</button>
        </div>
        <AppState v-if="currentClassesLoading" kind="loading" title="Đang tải lớp đang học" />
        <AppState v-else-if="currentClassesError" kind="error" title="Không thể tải lớp đang học" :message="currentClassesError" @retry="loadCurrentClasses()" />
        <AppState v-else-if="!currentClasses.length" kind="empty" title="Chưa xếp lớp" message="Học sinh chưa có membership đang hoạt động và hiệu lực hôm nay." />
        <div v-else class="row g-3">
          <div v-for="classRow in currentClasses" :key="classRow.membership_id" class="col-12 col-xl-6">
            <article class="h-100 border rounded-3 p-3">
              <div class="d-flex flex-wrap align-items-start justify-content-between gap-2">
                <div><RouterLink class="fw-semibold" :to="`/admin/classes/${classRow.id}`">{{ classRow.code }} · {{ classRow.name }}</RouterLink><div class="small text-secondary mt-1">{{ classRow.subject_name || 'Chưa cập nhật môn' }} · {{ classRow.grade_name || 'Chưa cập nhật khối' }}</div></div>
                <span v-if="classRow.status !== 'ACTIVE'" class="badge text-bg-secondary">Lớp {{ classRow.status === 'ARCHIVED' ? 'đã lưu trữ' : 'ngừng hoạt động' }}</span>
              </div>
              <p class="small text-secondary mt-2 mb-3">Bắt đầu học: {{ formatBusinessDate(classRow.start_date) }}</p>
              <div v-if="classRow.schedules.length" class="d-grid gap-2">
                <div v-for="schedule in classRow.schedules" :key="schedule.id" class="small border-top pt-2">
                  <strong>{{ weekdayLabels[schedule.day_of_week] || 'Lịch học' }} · {{ schedule.start_time.slice(0, 5) }}–{{ schedule.end_time.slice(0, 5) }}</strong>
                  <span v-if="schedule.room"> · Phòng {{ schedule.room }}</span>
                  <div class="text-secondary">Giáo viên: {{ teacherNames(schedule) || 'Chưa phân công' }}</div>
                </div>
              </div>
              <p v-else class="small text-secondary mb-0">Chưa có lịch học đang hoạt động.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
    <section class="card"><div class="card-body"><div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3"><div><h2 class="h5 mb-1">Lịch sử buổi học</h2><p class="small text-secondary mb-0">Thông tin điểm danh, kết quả và nhận xét được giữ theo từng buổi.</p></div><button class="btn btn-outline-primary btn-sm" type="button" :disabled="loading" @click="load">Làm mới</button></div>
      <AppState v-if="!history.length" kind="empty" title="Chưa có lịch sử buổi học" message="Các buổi đã diễn ra sẽ xuất hiện tại đây." />
      <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp</th><th>Giáo viên</th><th>Buổi học</th><th>Chuyên cần</th><th>Điểm và nhận xét</th></tr></thead><tbody><tr v-for="row in history" :key="row.id"><td>{{ formatDateTime(row.scheduled_start_at) }}</td><td>{{ row.classes?.name || '—' }}</td><td>{{ row.teachers.join(', ') || '—' }}</td><td>{{ row.status }}<br><small>{{ row.session_note || '' }}</small></td><td>{{ row.attendance ? statusLabel(row.attendance.status) : 'Chưa ghi nhận' }}<span v-if="row.attendance?.late_minutes"> · {{ row.attendance.late_minutes }} phút</span><small v-if="row.attendance?.absence_reason" class="d-block">{{ row.attendance.absence_reason }}</small></td><td>BTVN {{ row.attendance?.homework_score ?? '—' }}/10<span v-if="row.attendance?.homework_note"> · {{ row.attendance.homework_note }}</span><br><small>Hiểu bài {{ row.attendance?.understanding_score ?? '—' }}/5 · Thái độ {{ row.attendance?.attitude_score ?? '—' }}/5 · Điểm cộng {{ row.attendance?.positive_feedback_count ?? 0 }}</small><small v-if="row.attendance?.positive_feedback_raw" class="d-block">{{ row.attendance.positive_feedback_raw }}</small><small class="d-block">{{ row.attendance?.comment || 'Chưa có nhận xét' }}</small></td></tr></tbody></table></div>
    </div></section>
  </div>
</template>
