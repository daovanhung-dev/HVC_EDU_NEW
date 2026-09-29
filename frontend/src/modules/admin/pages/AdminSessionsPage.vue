<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { updateSessionOccurrence } from '@/services/commands'
import { getMySessions, getSessionStudents } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'

const sessions = ref<any[]>([])
const students = ref<any[]>([])
const selected = ref<any | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const startInput = ref('')
const endInput = ref('')
const teachers = computed(() => (selected.value?.session_staff || []).map((item: any) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công')

function toLocalInput(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

function fromLocalInput(value: string) {
  return new Date(`${value}:00+07:00`).toISOString()
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { sessions.value = await getMySessions() as any[] }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải buổi học.' }
  finally { loading.value = false }
}

async function selectSession(session: any) {
  selected.value = session
  startInput.value = toLocalInput(session.scheduled_start_at)
  endInput.value = toLocalInput(session.scheduled_end_at)
  try { students.value = await getSessionStudents(session.id) as any[] }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải chi tiết buổi học.' }
}

async function saveSchedule() {
  if (!selected.value || !startInput.value || !endInput.value) return
  try {
    await updateSessionOccurrence({ session_id: selected.value.id, start: fromLocalInput(startInput.value), end: fromLocalInput(endInput.value) })
    successMessage.value = 'Đã đổi lịch buổi học.'
    await load()
    const refreshed = sessions.value.find((item) => item.id === selected.value.id)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể đổi lịch buổi học.' }
}

async function cancel() {
  if (!selected.value || !window.confirm(`Hủy buổi học ${formatDateTime(selected.value.scheduled_start_at)}?`)) return
  try {
    await updateSessionOccurrence({ session_id: selected.value.id, cancel: true })
    successMessage.value = 'Đã hủy buổi học.'
    await load()
    await selectSession(sessions.value.find((item) => item.id === selected.value.id) || selected.value)
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể hủy buổi học.' }
}

onMounted(load)
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-4"><div><div class="small text-secondary">Học tập</div><h1 class="h3 mb-0">Buổi học</h1></div><button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button></div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="row g-4">
    <div class="col-12 col-xl-5"><div class="card border-0 shadow-sm"><div class="card-body">
      <div v-if="!loading && !sessions.length" class="text-center text-secondary py-5">Chưa có buổi học.</div>
      <button v-for="session in sessions" :key="session.id" class="btn w-100 text-start border-bottom rounded-0 py-3" :class="selected?.id === session.id ? 'bg-primary-subtle' : ''" @click="selectSession(session)"><div class="d-flex justify-content-between"><span class="fw-semibold">{{ session.classes?.name || 'Lớp học' }}</span><span class="badge" :class="session.status === 'COMPLETED' ? 'text-bg-success' : session.status === 'CANCELLED' ? 'text-bg-danger' : session.status === 'IN_PROGRESS' ? 'text-bg-primary' : 'text-bg-secondary'">{{ session.status }}</span></div><small class="text-secondary">{{ formatDateTime(session.scheduled_start_at) }}</small></button>
    </div></div></div>
    <div class="col-12 col-xl-7"><div v-if="selected" class="card border-0 shadow-sm"><div class="card-body">
      <h2 class="h5">{{ selected.classes?.name || 'Buổi học' }}</h2><div class="text-secondary mb-3">Giáo viên: {{ teachers }} · {{ selected.status }}</div>
      <div class="row g-2 mb-3"><div class="col-md-6"><label class="form-label">Bắt đầu</label><input v-model="startInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div><div class="col-md-6"><label class="form-label">Kết thúc</label><input v-model="endInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div></div>
      <div v-if="selected.status === 'SCHEDULED'" class="d-flex gap-2 mb-4"><button class="btn btn-primary btn-sm" @click="saveSchedule">Lưu lịch mới</button><button class="btn btn-outline-danger btn-sm" @click="cancel">Hủy buổi học</button></div>
      <p v-if="selected.session_note" class="border-start border-3 ps-3">{{ selected.session_note }}</p>
      <h3 class="h6 mt-3">Học sinh và kết quả</h3><div v-for="row in students" :key="row.student_id" class="border rounded p-3 mb-2"><div class="fw-semibold">{{ row.students?.full_name }} <small class="text-secondary">{{ row.students?.student_code }}</small></div><div class="small text-secondary">{{ row.student_attendances?.[0]?.status || 'Chưa điểm danh' }}<span v-if="row.student_attendances?.[0]?.absence_reason"> · {{ row.student_attendances[0].absence_reason }}</span> · BTVN {{ row.student_attendances?.[0]?.homework_score ?? '—' }}/10<span v-if="row.student_attendances?.[0]?.homework_note"> ({{ row.student_attendances[0].homework_note }})</span> · Hiểu bài {{ row.student_attendances?.[0]?.understanding_score ?? '—' }}/5 · Thái độ {{ row.student_attendances?.[0]?.attitude_score ?? '—' }}/5 · Điểm cộng {{ row.student_attendances?.[0]?.positive_feedback_count ?? 0 }}<span v-if="row.student_attendances?.[0]?.positive_feedback_raw"> · {{ row.student_attendances[0].positive_feedback_raw }}</span></div><div v-if="row.student_attendances?.[0]?.comment" class="small mt-1">{{ row.student_attendances[0].comment }}</div></div><div v-if="!students.length" class="text-secondary small">Buổi học chưa có danh sách học sinh.</div>
    </div></div><div v-else class="card border-0 shadow-sm"><div class="card-body text-center text-secondary py-5">Chọn một buổi học để xem chi tiết.</div></div></div>
  </div>
</template>
