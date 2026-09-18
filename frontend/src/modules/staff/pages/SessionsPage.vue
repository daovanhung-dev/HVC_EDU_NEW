<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { completeSession, startSession, submitTimesheet, updateSessionLearning } from '@/services/commands'
import { getMySessions, getMyStaff, getSessionStudents } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import { useAuthStore } from '@/stores/auth.store'
import { useAppErrorStore } from '@/stores/app-error.store'

const auth = useAuthStore()
const appErrors = useAppErrorStore()
const sessions = ref<any[]>([])
const students = ref<any[]>([])
const selected = ref<any | null>(null)
const staff = ref<any | null>(null)
const sessionNote = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)
const statuses = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']

function showError(error: unknown, fallback: string) {
  const normalized = appErrors.report(error, fallback)
  errorMessage.value = normalized.message
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { sessions.value = await getMySessions() as any[] } catch (error) { showError(error, 'Không thể tải danh sách buổi học.') } finally { loading.value = false }
}

async function openSession(session: any) {
  selected.value = session
  sessionNote.value = session.session_note || ''
  errorMessage.value = ''
  try {
    students.value = (await getSessionStudents(session.id) as any[]).map((row) => ({
      ...row,
      attendance: row.student_attendances?.[0] || {
        session_id: session.id,
        student_id: row.student_id,
        status: null,
        late_minutes: null,
        absence_reason: '',
        homework_score: null,
        homework_note: row.assessment_snapshot?.homework_note || null,
        understanding_score: row.assessment_snapshot?.understanding_raw ? Number(row.assessment_snapshot.understanding_raw) : null,
        attitude_score: row.assessment_snapshot?.attitude_raw ? Number(row.assessment_snapshot.attitude_raw) : null,
        positive_feedback_count: null,
        positive_feedback_raw: row.assessment_snapshot?.positive_feedback_raw || null,
        comment: row.assessment_snapshot?.comment_raw || '',
      },
    }))
  } catch (error) { showError(error, 'Không thể tải danh sách học sinh của buổi học.') }
}

async function saveAttendance(row: any) {
  errorMessage.value = ''
  if (!row.attendance.status) { errorMessage.value = 'Hãy chọn trạng thái điểm danh trước khi lưu.'; return }
  try {
    await updateSessionLearning({
      session_id: selected.value.id,
      session_note: sessionNote.value,
      students: [{
        student_id: row.student_id,
        status: row.attendance.status,
        late_minutes: row.attendance.status === 'LATE' ? row.attendance.late_minutes || null : null,
        absence_reason: row.attendance.status === 'ABSENT' || row.attendance.status === 'EXCUSED' ? row.attendance.absence_reason || null : null,
        homework_score: row.attendance.homework_score === '' ? null : row.attendance.homework_score,
        homework_note: row.attendance.homework_note || null,
        understanding_score: row.attendance.understanding_score || null,
        attitude_score: row.attendance.attitude_score || null,
        positive_feedback_count: row.attendance.positive_feedback_count || null,
        positive_feedback_raw: row.attendance.positive_feedback_raw || null,
        comment: row.attendance.comment || null,
      }],
    })
    successMessage.value = `Đã lưu ${row.students?.full_name || 'học sinh'}.`
  } catch (error) { showError(error, 'Không thể lưu điểm danh.') }
}

async function saveNote() {
  if (!selected.value) return
  try { await updateSessionLearning({ session_id: selected.value.id, session_note: sessionNote.value, students: [] }); successMessage.value = 'Đã lưu nội dung buổi học.' } catch (error) { showError(error, 'Không thể lưu nội dung buổi học.') }
}

async function start() {
  if (!selected.value) return
  try { await startSession(selected.value.id); successMessage.value = 'Đã bắt đầu buổi học.'; await load(); selected.value = sessions.value.find((item) => item.id === selected.value.id) || selected.value } catch (error) { showError(error, 'Không thể bắt đầu buổi học.') }
}

async function complete() {
  if (!selected.value) return
  try { await completeSession(selected.value.id); successMessage.value = 'Đã hoàn thành buổi học và khóa dữ liệu học tập.'; await load(); selected.value = null } catch (error) { showError(error, 'Không thể hoàn thành buổi học.') }
}

async function timesheet() {
  if (!selected.value || !staff.value) { showError(new Error('STAFF_NOT_FOUND'), 'Không thể gửi chấm công.'); return }
  try { await submitTimesheet(selected.value.id, staff.value.id); successMessage.value = 'Đã gửi yêu cầu chấm công.' } catch (error) { showError(error, 'Không thể gửi chấm công.') }
}

onMounted(async () => {
  try { staff.value = await getMyStaff(); if (!staff.value) { showError(new Error('STAFF_NOT_FOUND'), 'Không thể tải hồ sơ nhân sự.'); return }; await load() } catch (error) { showError(error, 'Không thể khởi tạo chức năng buổi học.') }
})
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-4"><div><div class="small text-secondary">Academic</div><h1 class="h3 mb-0">Buổi học</h1></div><button class="btn btn-outline-primary" @click="load">Làm mới</button></div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="row g-4"><div class="col-12 col-xl-5"><div class="card border-0 shadow-sm"><div class="card-body"><h2 class="h6">Session của tôi</h2><div v-if="!sessions.length" class="text-secondary small py-4 text-center">Chưa có buổi học được phân công.</div><button v-for="session in sessions" :key="session.id" class="btn w-100 text-start border-bottom rounded-0 py-3" :class="selected?.id === session.id ? 'bg-primary-subtle' : ''" @click="openSession(session)"><div class="d-flex justify-content-between"><span class="fw-semibold">{{ session.class_months?.classes?.name || 'Lớp học' }}</span><span class="badge" :class="session.status === 'COMPLETED' ? 'text-bg-success' : session.status === 'IN_PROGRESS' ? 'text-bg-primary' : 'text-bg-secondary'">{{ session.status }}</span></div><small class="text-secondary">{{ formatDateTime(session.scheduled_start_at) }}</small></button></div></div></div><div class="col-12 col-xl-7"><div v-if="selected" class="card border-0 shadow-sm"><div class="card-body"><div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><h2 class="h6 mb-1">Điểm danh và nhận xét</h2><small class="text-secondary">{{ formatDateTime(selected.scheduled_start_at) }}</small></div><div class="d-flex gap-2"><button v-if="selected.status === 'SCHEDULED'" class="btn btn-primary btn-sm" @click="start">Bắt đầu</button><button v-if="selected.status === 'COMPLETED'" class="btn btn-outline-success btn-sm" @click="timesheet">Gửi chấm công</button><button v-if="selected.status === 'IN_PROGRESS' && auth.isTeacher" class="btn btn-success btn-sm" @click="complete">Hoàn thành</button></div></div><div v-if="selected.status !== 'SCHEDULED'" class="border rounded p-3 mb-3"><label class="form-label">Nội dung buổi học</label><textarea v-model="sessionNote" class="form-control mb-2" rows="2" placeholder="Nội dung đã học trong buổi này"></textarea><button class="btn btn-outline-primary btn-sm" :disabled="selected.status === 'COMPLETED'" @click="saveNote">Lưu nội dung</button></div><div v-if="selected.status === 'SCHEDULED'" class="alert alert-info small">Bắt đầu session để nhập attendance.</div><div v-for="row in students" :key="row.student_id" class="border rounded p-3 mb-2"><div class="d-flex justify-content-between align-items-center gap-2"><div><div class="fw-semibold">{{ row.students?.full_name }}</div><small class="text-secondary">{{ row.students?.student_code }}</small></div><select v-model="row.attendance.status" class="form-select form-select-sm" style="max-width: 140px" :disabled="selected.status !== 'IN_PROGRESS'"><option v-for="status in statuses" :key="status" :value="status">{{ status }}</option></select></div><div v-if="selected.status === 'IN_PROGRESS'" class="row g-2 mt-2"><div class="col-3" v-if="row.attendance.status === 'LATE'"><input v-model.number="row.attendance.late_minutes" type="number" min="0" class="form-control form-control-sm" placeholder="Phút muộn" /></div><div class="col-3"><input v-model.number="row.attendance.homework_score" type="number" min="0" max="10" step="0.1" class="form-control form-control-sm" placeholder="BTVN /10" /></div><div class="col-3"><input v-model.number="row.attendance.understanding_score" type="number" min="1" max="5" class="form-control form-control-sm" placeholder="Hiểu bài /5" /></div><div class="col-3"><input v-model.number="row.attendance.attitude_score" type="number" min="1" max="5" class="form-control form-control-sm" placeholder="Thái độ /5" /></div><div class="col"><input v-model="row.attendance.comment" class="form-control form-control-sm" placeholder="Nhận xét" /></div><div class="col-auto"><button class="btn btn-outline-primary btn-sm" @click="saveAttendance(row)">Lưu</button></div></div></div><div v-if="selected.status !== 'SCHEDULED' && !students.length" class="text-secondary small">Session chưa có snapshot học sinh.</div></div></div><div v-else class="card border-0 shadow-sm"><div class="card-body text-center text-secondary py-5">Chọn một session để thao tác.</div></div></div></div>
  <div v-if="selected && selected.status !== 'IN_PROGRESS' && students.length" class="card border-0 shadow-sm mt-3"><div class="card-body"><h2 class="h6">Đánh giá đã lưu</h2><div v-for="row in students" :key="'assessment-' + row.student_id" class="small border-bottom py-2"><span class="fw-semibold">{{ row.students?.full_name }}</span> · Hiểu bài: {{ row.attendance?.understanding_score ?? row.assessment_snapshot?.understanding_raw ?? '—' }}/5 · Thái độ: {{ row.attendance?.attitude_score ?? row.assessment_snapshot?.attitude_raw ?? '—' }}/5 · BTVN: {{ row.attendance?.homework_score ?? row.attendance?.homework_note ?? row.assessment_snapshot?.homework_raw ?? '—' }} · {{ row.attendance?.comment || row.assessment_snapshot?.comment_raw || 'Chưa có nhận xét' }}</div></div></div>
</template>
