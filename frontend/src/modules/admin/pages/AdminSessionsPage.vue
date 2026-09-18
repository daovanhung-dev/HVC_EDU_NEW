<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { updateSessionLearning } from '@/services/commands'
import { getMySessions, getSessionStudents } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import { useAppErrorStore } from '@/stores/app-error.store'

const appErrors = useAppErrorStore()
const sessions = ref<any[]>([])
const students = ref<any[]>([])
const selected = ref<any | null>(null)
const sessionNote = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const statuses = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']

function showError(error: unknown, fallback: string) {
  errorMessage.value = appErrors.report(error, fallback).message
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { sessions.value = await getMySessions() as any[] } catch (error) { showError(error, 'Không thể tải danh sách buổi học.') } finally { loading.value = false }
}

async function selectSession(session: any) {
  selected.value = session
  sessionNote.value = session.session_note || ''
  errorMessage.value = ''
  try {
    students.value = (await getSessionStudents(session.id) as any[]).map((row) => ({
      ...row,
      attendance: row.student_attendances?.[0] || { student_id: row.student_id, status: 'PRESENT', late_minutes: null, absence_reason: '', homework_score: null, homework_note: null, understanding_score: null, attitude_score: null, positive_feedback_count: null, positive_feedback_raw: null, comment: '' },
    }))
  } catch (error) { showError(error, 'Không thể tải chi tiết buổi học.') }
}

async function save() {
  if (!selected.value) return
  try {
    await updateSessionLearning({
      session_id: selected.value.id,
      session_note: sessionNote.value,
      students: students.value.map((row) => ({
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
      })),
    })
    successMessage.value = 'Đã cập nhật dữ liệu học tập và ghi audit.'
    await load()
  } catch (error) { showError(error, 'Không thể cập nhật dữ liệu buổi học.') }
}

onMounted(load)
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-4"><div><div class="small text-secondary">Academic</div><h1 class="h3 mb-0">Tình hình buổi học</h1></div><button class="btn btn-outline-primary" @click="load">Làm mới</button></div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="row g-4"><div class="col-12 col-xl-5"><div class="card border-0 shadow-sm"><div class="card-body"><div v-if="!loading && !sessions.length" class="text-center text-secondary py-5">Chưa có buổi học.</div><button v-for="session in sessions" :key="session.id" class="btn w-100 text-start border-bottom rounded-0 py-3" :class="selected?.id === session.id ? 'bg-primary-subtle' : ''" @click="selectSession(session)"><div class="d-flex justify-content-between"><span class="fw-semibold">{{ session.class_months?.classes?.name || 'Lớp học' }}</span><span class="badge" :class="session.status === 'COMPLETED' ? 'text-bg-success' : session.status === 'CANCELLED' ? 'text-bg-danger' : 'text-bg-warning'">{{ session.status }}</span></div><small class="text-secondary">{{ formatDateTime(session.scheduled_start_at) }}</small></button></div></div></div><div class="col-12 col-xl-7"><div v-if="selected" class="card border-0 shadow-sm"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h2 class="h6 mb-1">Chi tiết buổi học</h2><small class="text-secondary">{{ formatDateTime(selected.scheduled_start_at) }} · {{ selected.status }}</small></div><button class="btn btn-primary btn-sm" @click="save">Lưu thay đổi</button></div><label class="form-label">Nội dung buổi học</label><textarea v-model="sessionNote" class="form-control mb-3" rows="3"></textarea><div v-for="row in students" :key="row.student_id" class="border rounded p-3 mb-2"><div class="fw-semibold mb-2">{{ row.students?.full_name }} <small class="text-secondary">{{ row.students?.student_code }}</small></div><div class="row g-2"><div class="col-md-3"><label class="form-label small">Điểm danh</label><select v-model="row.attendance.status" class="form-select form-select-sm"><option v-for="status in statuses" :key="status" :value="status">{{ status }}</option></select></div><div class="col-md-3"><label class="form-label small">BTVN /10</label><input v-model.number="row.attendance.homework_score" type="number" min="0" max="10" step="0.1" class="form-control form-control-sm" /></div><div class="col-md-3"><label class="form-label small">Hiểu bài /5</label><input v-model.number="row.attendance.understanding_score" type="number" min="1" max="5" class="form-control form-control-sm" /></div><div class="col-md-3"><label class="form-label small">Thái độ /5</label><input v-model.number="row.attendance.attitude_score" type="number" min="1" max="5" class="form-control form-control-sm" /></div><div class="col-12"><label class="form-label small">Nhận xét</label><textarea v-model="row.attendance.comment" class="form-control form-control-sm" rows="2"></textarea></div></div></div><div v-if="!students.length" class="small text-secondary">Buổi học chưa có snapshot học sinh.</div></div></div><div v-else class="card border-0 shadow-sm"><div class="card-body text-center text-secondary py-5">Chọn một buổi học để xem chi tiết.</div></div></div></div>
</template>
