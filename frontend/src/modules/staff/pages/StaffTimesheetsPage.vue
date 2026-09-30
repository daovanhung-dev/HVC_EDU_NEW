<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { submitTimesheet } from '@/services/commands'
import { getMySessions, getMyTimesheets } from '@/services/data-queries'
import type { SessionRow, TimesheetRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { userErrorMessage } from '@/shared/utils/errors'

const sessions = ref<SessionRow[]>([])
const timesheets = ref<TimesheetRow[]>([])
const notes = ref<Record<string, string>>({})
const loading = ref(false)
const submittingId = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const completedSessions = computed(() => sessions.value.filter((session) => session.status === 'COMPLETED'))
const timesheetBySession = computed(() => new Map(timesheets.value.map((row) => [row.session_id, row])))

function statusLabel(status: TimesheetRow['status']) {
  if (status === 'APPROVED') return 'Đã duyệt'
  if (status === 'REJECTED') return 'Bị từ chối'
  return 'Chờ duyệt'
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [sessionRows, timesheetRows] = await Promise.all([getMySessions(), getMyTimesheets()])
    sessions.value = sessionRows
    timesheets.value = timesheetRows
  } catch (error) {
    errorMessage.value = userErrorMessage(error, 'Không thể tải dữ liệu chấm công.')
  } finally {
    loading.value = false
  }
}

async function submit(session: SessionRow) {
  const existing = timesheetBySession.value.get(session.id)
  if (existing && existing.status !== 'REJECTED') return
  submittingId.value = session.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await submitTimesheet({ session_id: session.id, notes: notes.value[session.id]?.trim() || null })
    successMessage.value = 'Đã gửi chấm công, đang chờ Admin duyệt.'
    await load()
  } catch (error) {
    errorMessage.value = userErrorMessage(error, 'Không thể gửi chấm công.')
  } finally {
    submittingId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
    <div><div class="small text-secondary">Công việc</div><h1 class="h3 mb-0">Chấm công</h1></div>
    <button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button>
  </div>
  <div v-if="successMessage" class="alert alert-success" role="status">{{ successMessage }}</div>
  <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
  <div v-if="loading" class="text-center text-secondary py-4" role="status">Đang tải buổi học…</div>
  <div v-else-if="!completedSessions.length" class="card border-0 shadow-sm"><div class="card-body text-center text-secondary py-5">Chưa có buổi học hoàn tất để gửi chấm công.</div></div>
  <div v-else class="row g-3">
    <div v-for="session in completedSessions" :key="session.id" class="col-12">
      <article class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex flex-wrap justify-content-between gap-2">
            <div>
              <h2 class="h5 mb-1">{{ session.classes?.name || 'Lớp học' }}</h2>
              <div class="small text-secondary">{{ formatDateTime(session.scheduled_start_at) }} – {{ formatDateTime(session.scheduled_end_at) }}</div>
            </div>
            <span v-if="timesheetBySession.get(session.id)" class="badge align-self-start" :class="timesheetBySession.get(session.id)?.status === 'APPROVED' ? 'text-bg-success' : timesheetBySession.get(session.id)?.status === 'REJECTED' ? 'text-bg-danger' : 'text-bg-warning'">
              {{ statusLabel(timesheetBySession.get(session.id)!.status) }}
            </span>
          </div>
          <p v-if="timesheetBySession.get(session.id)?.rejection_reason" class="small text-danger mt-3 mb-2">Lý do từ chối: {{ timesheetBySession.get(session.id)?.rejection_reason }}</p>
          <p v-if="timesheetBySession.get(session.id)?.notes" class="small text-secondary mt-2 mb-2">Ghi chú đã gửi: {{ timesheetBySession.get(session.id)?.notes }}</p>
          <form v-if="!timesheetBySession.get(session.id) || timesheetBySession.get(session.id)?.status === 'REJECTED'" class="mt-3" @submit.prevent="submit(session)">
            <label class="form-label" :for="`timesheet-note-${session.id}`">Ghi chú chấm công (không bắt buộc)</label>
            <textarea :id="`timesheet-note-${session.id}`" v-model="notes[session.id]" class="form-control mb-2" rows="2" maxlength="2000" placeholder="Ghi chú về buổi dạy"></textarea>
            <button class="btn btn-primary btn-sm" :disabled="submittingId === session.id">{{ timesheetBySession.get(session.id)?.status === 'REJECTED' ? 'Gửi lại chấm công' : 'Gửi chấm công' }}</button>
          </form>
        </div>
      </article>
    </div>
  </div>
</template>
