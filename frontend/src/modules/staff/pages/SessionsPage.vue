<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { completeSession, startSession, updateSessionLearning } from '@/services/commands'
import { getMySessions, getSessionStudents } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import { useAppErrorStore } from '@/stores/app-error.store'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

const appErrors = useAppErrorStore()
const toast = useToastStore()
const sessions = ref<any[]>([])
const students = ref<any[]>([])
const selected = ref<any | null>(null)
const sessionNote = ref('')
const errorMessage = ref('')
const saving = ref(false)
const loading = ref(false)
const statuses = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']

function showError(error: unknown, fallback: string) {
  errorMessage.value = appErrors.report(error, fallback).message
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { sessions.value = await getMySessions() as any[] }
  catch (error) { showError(error, 'Không thể tải danh sách buổi học.') }
  finally { loading.value = false }
}

async function openSession(session: any) {
  selected.value = session
  sessionNote.value = session.session_note || ''
  errorMessage.value = ''
  try {
    students.value = (await getSessionStudents(session.id) as any[]).map((row) => ({
      ...row,
      attendance: row.student_attendances?.[0] || {
        student_id: row.student_id, status: null, late_minutes: null, absence_reason: '',
        homework_score: null, homework_note: row.assessment_snapshot?.homework_note || null,
        understanding_score: row.assessment_snapshot?.understanding_raw ? Number(row.assessment_snapshot.understanding_raw) : null,
        attitude_score: row.assessment_snapshot?.attitude_raw ? Number(row.assessment_snapshot.attitude_raw) : null,
        positive_feedback_count: null, positive_feedback_raw: row.assessment_snapshot?.positive_feedback_raw || null,
        comment: row.assessment_snapshot?.comment_raw || '',
      },
    }))
  } catch (error) { showError(error, 'Không thể tải danh sách học sinh của buổi học.') }
}

async function saveAttendance(row: any) {
  if (saving.value) return
  if (!row.attendance.status) { errorMessage.value = 'Hãy chọn trạng thái điểm danh trước khi lưu.'; return }
  saving.value = true
  try {
    await updateSessionLearning({ session_id: selected.value.id, session_note: sessionNote.value, students: [{
      student_id: row.student_id,
      status: row.attendance.status,
      late_minutes: row.attendance.status === 'LATE' ? row.attendance.late_minutes || null : null,
      absence_reason: ['ABSENT', 'EXCUSED'].includes(row.attendance.status) ? row.attendance.absence_reason || null : null,
      homework_score: row.attendance.homework_score === '' ? null : row.attendance.homework_score,
      homework_note: row.attendance.homework_note || null,
      understanding_score: row.attendance.understanding_score || null,
      attitude_score: row.attendance.attitude_score || null,
      positive_feedback_count: row.attendance.positive_feedback_count || null,
      positive_feedback_raw: row.attendance.positive_feedback_raw || null,
      comment: row.attendance.comment || null,
    }] })
    toast.success(`Đã lưu kết quả của ${row.students?.full_name || 'học sinh'}.`)
  } catch (error) { showError(error, 'Không thể lưu điểm danh và nhận xét.') }
  finally { saving.value = false }
}

async function saveNote() {
  if (!selected.value || saving.value) return
  saving.value = true
  try { await updateSessionLearning({ session_id: selected.value.id, session_note: sessionNote.value, students: [] }); toast.success('Đã lưu nội dung buổi học.') }
  catch (error) { showError(error, 'Không thể lưu nội dung buổi học.') }
  finally { saving.value = false }
}

async function start() {
  if (!selected.value || saving.value) return
  saving.value = true
  try {
    await startSession(selected.value.id)
    toast.success('Đã bắt đầu buổi học.')
    await load()
    selected.value = sessions.value.find((item) => item.id === selected.value.id) || selected.value
    await openSession(selected.value)
  } catch (error) { showError(error, 'Không thể bắt đầu buổi học.') }
  finally { saving.value = false }
}

async function complete() {
  if (!selected.value || saving.value) return
  saving.value = true
  try { await completeSession(selected.value.id); toast.success('Đã hoàn thành buổi học.'); await load(); selected.value = null; students.value = [] }
  catch (error) { showError(error, 'Không thể hoàn thành buổi học.') }
  finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <AppPageHeader title="Buổi học được phân công" eyebrow="Giảng dạy" description="Mở buổi học để điểm danh, ghi nhận kết quả và lưu nội dung giảng dạy.">
    <template #actions><button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button></template>
  </AppPageHeader>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="row g-4">
    <div class="col-12 col-xl-5"><div class="card border-0 shadow-sm"><div class="card-body">
      <AppState v-if="loading" kind="loading" title="Đang tải buổi học" />
      <AppState v-else-if="!sessions.length" kind="empty" title="Chưa có buổi học được phân công" />
      <button v-for="session in sessions" :key="session.id" class="btn w-100 text-start border-bottom rounded-0 py-3 staff-session-motion-item" :class="selected?.id === session.id ? 'bg-primary-subtle' : ''" @click="openSession(session)">
        <div class="d-flex justify-content-between"><span class="fw-semibold">{{ session.classes?.name || 'Lớp học' }}</span><span class="badge" :class="session.status === 'COMPLETED' ? 'text-bg-success' : session.status === 'IN_PROGRESS' ? 'text-bg-primary' : session.status === 'CANCELLED' ? 'text-bg-danger' : 'text-bg-secondary'">{{ session.status }}</span></div>
        <small class="text-secondary">{{ formatDateTime(session.scheduled_start_at) }} · {{ session.room || session.class_schedules?.room || 'Chưa xếp phòng' }}</small>
      </button>
    </div></div></div>
    <div class="col-12 col-xl-7"><div v-if="selected" class="card border-0 shadow-sm"><div class="card-body">
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><h2 class="h6 mb-1">Điểm danh và nhận xét</h2><small class="text-secondary">{{ formatDateTime(selected.scheduled_start_at) }} · {{ selected.classes?.name }}</small></div><div class="d-flex gap-2"><button v-if="selected.status === 'SCHEDULED'" class="btn btn-primary btn-sm" :disabled="saving" @click="start">Bắt đầu</button><button v-if="selected.status === 'IN_PROGRESS'" class="btn btn-success btn-sm" :disabled="saving" @click="complete">Hoàn thành</button></div></div>
      <div v-if="selected.status === 'IN_PROGRESS'" class="border rounded p-3 mb-3"><label class="form-label" for="session-note">Nội dung buổi học</label><textarea id="session-note" v-model="sessionNote" class="form-control mb-2" rows="2" placeholder="Nội dung đã học trong buổi này"></textarea><button class="btn btn-outline-primary btn-sm" :disabled="saving" @click="saveNote">Lưu nội dung</button></div>
      <Transition name="field-reveal"><div v-if="selected.status === 'SCHEDULED'" class="alert alert-info small">Bắt đầu buổi học để nhập điểm danh, điểm và nhận xét.</div></Transition>
      <div v-for="row in students" :key="row.student_id" class="border rounded p-3 mb-2 staff-attendance-row">
        <div class="d-flex justify-content-between align-items-center gap-2"><div><div class="fw-semibold">{{ row.students?.full_name }}</div><small class="text-secondary">{{ row.students?.student_code }}</small></div><select v-model="row.attendance.status" class="form-select form-select-sm" style="max-width: 150px" :disabled="selected.status !== 'IN_PROGRESS'"><option :value="null">Điểm danh</option><option v-for="status in statuses" :key="status" :value="status">{{ status }}</option></select></div>
        <Transition name="field-reveal" mode="out-in">
          <div v-if="selected.status === 'IN_PROGRESS'" key="editable" class="row g-2 mt-2">
            <Transition name="field-reveal"><div v-if="row.attendance.status === 'LATE'" class="col-6 col-md-3"><label class="visually-hidden" :for="`late-${row.student_id}`">Phút đi muộn</label><input :id="`late-${row.student_id}`" v-model.number="row.attendance.late_minutes" type="number" min="0" class="form-control form-control-sm" placeholder="Phút đi muộn" /></div></Transition>
            <Transition name="field-reveal"><div v-if="['ABSENT', 'EXCUSED'].includes(row.attendance.status)" class="col-12"><label class="visually-hidden" :for="`absence-${row.student_id}`">Lý do vắng</label><input :id="`absence-${row.student_id}`" v-model="row.attendance.absence_reason" class="form-control form-control-sm" placeholder="Lý do vắng" /></div></Transition>
            <div class="col-6 col-md-3"><label class="visually-hidden" :for="`homework-${row.student_id}`">Điểm bài tập về nhà trên 10</label><input :id="`homework-${row.student_id}`" v-model.number="row.attendance.homework_score" type="number" min="0" max="10" step="0.1" class="form-control form-control-sm" placeholder="BTVN /10" /></div>
            <div class="col-6 col-md-3"><label class="visually-hidden" :for="`homework-note-${row.student_id}`">Ghi chú bài tập về nhà</label><input :id="`homework-note-${row.student_id}`" v-model="row.attendance.homework_note" class="form-control form-control-sm" placeholder="Ghi chú BTVN" /></div>
            <div class="col-6 col-md-2"><label class="visually-hidden" :for="`understanding-${row.student_id}`">Mức hiểu bài từ 1 đến 5</label><input :id="`understanding-${row.student_id}`" v-model.number="row.attendance.understanding_score" type="number" min="1" max="5" class="form-control form-control-sm" placeholder="Hiểu bài /5" /></div>
            <div class="col-6 col-md-2"><label class="visually-hidden" :for="`attitude-${row.student_id}`">Thái độ từ 1 đến 5</label><input :id="`attitude-${row.student_id}`" v-model.number="row.attendance.attitude_score" type="number" min="1" max="5" class="form-control form-control-sm" placeholder="Thái độ /5" /></div>
            <div class="col-4 col-md-2"><label class="visually-hidden" :for="`positive-count-${row.student_id}`">Số điểm cộng</label><input :id="`positive-count-${row.student_id}`" v-model.number="row.attendance.positive_feedback_count" type="number" min="0" class="form-control form-control-sm" placeholder="Điểm cộng" /></div>
            <div class="col-8 col-md-6"><label class="visually-hidden" :for="`positive-note-${row.student_id}`">Ghi nhận điểm cộng</label><input :id="`positive-note-${row.student_id}`" v-model="row.attendance.positive_feedback_raw" class="form-control form-control-sm" placeholder="Lý do/ghi nhận điểm cộng" /></div>
            <div class="col-9"><label class="visually-hidden" :for="`comment-${row.student_id}`">Nhận xét học sinh</label><input :id="`comment-${row.student_id}`" v-model="row.attendance.comment" class="form-control form-control-sm" placeholder="Nhận xét học sinh" /></div>
            <div class="col-auto"><button class="btn btn-outline-primary btn-sm" :disabled="saving" @click="saveAttendance(row)">Lưu kết quả</button></div>
          </div>
          <div v-else-if="row.attendance.status" key="summary" class="small text-secondary mt-2">{{ row.attendance.status }}<span v-if="row.attendance.absence_reason"> · {{ row.attendance.absence_reason }}</span> · BTVN {{ row.attendance.homework_score ?? '—' }}/10 · {{ row.attendance.homework_note || '' }} · Hiểu bài {{ row.attendance.understanding_score ?? '—' }}/5 · Thái độ {{ row.attendance.attitude_score ?? '—' }}/5 · Điểm cộng {{ row.attendance.positive_feedback_count ?? 0 }} · {{ row.attendance.comment || 'Chưa có nhận xét' }}</div>
        </Transition>
      </div>
      <div v-if="selected.status !== 'SCHEDULED' && !students.length" class="text-secondary small">Buổi học chưa có học sinh trong danh sách.</div>
    </div></div><div v-else class="card border-0 shadow-sm"><div class="card-body text-center text-secondary py-5">Chọn một buổi học để thao tác.</div></div></div>
  </div>
</template>
