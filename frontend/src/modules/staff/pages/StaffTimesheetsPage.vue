<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { submitTimesheet } from '@/services/commands'
import { getMySessions, getMyTimesheets } from '@/services/data-queries'
import type { SessionRow, TimesheetRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { userErrorMessage } from '@/shared/utils/errors'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

const sessions = ref<SessionRow[]>([])
const toast = useToastStore()
const timesheets = ref<TimesheetRow[]>([])
const notes = ref<Record<string, string>>({})
const loading = ref(false)
const submittingId = ref('')
const errorMessage = ref('')

const completedSessions = computed(() => sessions.value.filter((session) => session.status === 'COMPLETED'))
const timesheetBySession = computed(() => new Map(timesheets.value.map((row) => [row.session_id, row])))
const timesheetCounts = computed(() => {
  const counts = { toSubmit: 0, pending: 0, rejected: 0, approved: 0 }
  for (const session of completedSessions.value) {
    const row = timesheetBySession.value.get(session.id)
    if (!row) counts.toSubmit += 1
    else if (row.status === 'PENDING') counts.pending += 1
    else if (row.status === 'REJECTED') counts.rejected += 1
    else counts.approved += 1
  }
  return counts
})

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
  if (submittingId.value === session.id) return
  const existing = timesheetBySession.value.get(session.id)
  if (existing && existing.status !== 'REJECTED') return
  submittingId.value = session.id
  errorMessage.value = ''
  try {
    await submitTimesheet({ session_id: session.id, notes: notes.value[session.id]?.trim() || null })
    toast.success('Đã gửi chấm công, đang chờ Admin duyệt.')
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
  <section class="teacher-workspace teacher-timesheets">
    <AppPageHeader title="Chấm công" eyebrow="Không gian giáo viên" description="Gửi chấm công cho buổi đã hoàn tất và theo dõi phản hồi từ Admin.">
      <template #actions><button class="btn btn-outline-primary" type="button" :disabled="loading" @click="load">{{ loading ? 'Đang làm mới…' : 'Làm mới' }}</button></template>
    </AppPageHeader>
    <div class="teacher-workspace__intro"><span class="teacher-workspace__eyebrow">Theo dõi chấm công</span><p>Yêu cầu được gửi theo từng buổi dạy; yêu cầu bị từ chối có thể được cập nhật và gửi lại.</p></div>
    <div v-if="errorMessage && completedSessions.length" class="alert alert-danger teacher-alert" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" :disabled="loading" @click="load">Thử lại</button></div>
    <AppState v-if="loading" kind="loading" title="Đang tải buổi học" />
    <AppState v-else-if="errorMessage && !completedSessions.length" kind="error" title="Không thể tải dữ liệu chấm công" :message="errorMessage" @retry="load" />
    <div v-else-if="!completedSessions.length" class="teacher-empty-card"><AppState kind="empty" title="Chưa có buổi học hoàn tất" message="Buổi học sẽ xuất hiện tại đây sau khi được hoàn thành." /></div>
    <template v-else>
      <div class="teacher-timesheet-summary" aria-label="Tổng quan yêu cầu chấm công">
        <article class="teacher-timesheet-summary__item teacher-timesheet-summary__item--action"><span>Chưa gửi</span><strong>{{ timesheetCounts.toSubmit }}</strong><small>Cần gửi yêu cầu</small></article>
        <article class="teacher-timesheet-summary__item"><span>Chờ duyệt</span><strong>{{ timesheetCounts.pending }}</strong><small>Admin đang xem</small></article>
        <article class="teacher-timesheet-summary__item teacher-timesheet-summary__item--success"><span>Đã duyệt</span><strong>{{ timesheetCounts.approved }}</strong><small>Đã xác nhận</small></article>
        <article class="teacher-timesheet-summary__item teacher-timesheet-summary__item--attention"><span>Cần cập nhật</span><strong>{{ timesheetCounts.rejected }}</strong><small>Bị từ chối, có thể gửi lại</small></article>
      </div>
      <div class="teacher-timesheet-list">
        <article v-for="session in completedSessions" :key="session.id" class="teacher-timesheet-card">
          <div class="teacher-timesheet-card__time"><span>{{ formatDateTime(session.scheduled_start_at) }}</span><strong>{{ formatDateTime(session.scheduled_end_at) }}</strong></div>
          <div class="teacher-timesheet-card__main">
            <div class="teacher-timesheet-card__heading">
              <div><h2>{{ session.classes?.name || 'Lớp học' }}</h2><span class="teacher-timesheet-card__subline">Buổi học đã hoàn thành</span></div>
              <span class="badge" :class="!timesheetBySession.get(session.id) ? 'text-bg-secondary' : timesheetBySession.get(session.id)?.status === 'APPROVED' ? 'text-bg-success' : timesheetBySession.get(session.id)?.status === 'REJECTED' ? 'text-bg-danger' : 'text-bg-warning'">
                {{ timesheetBySession.get(session.id) ? statusLabel(timesheetBySession.get(session.id)!.status) : 'Chưa gửi' }}
              </span>
            </div>
            <p v-if="timesheetBySession.get(session.id)?.rejection_reason" class="teacher-timesheet-card__rejection"><strong>Lý do cần cập nhật</strong>{{ timesheetBySession.get(session.id)?.rejection_reason }}</p>
            <p v-if="timesheetBySession.get(session.id)?.notes" class="teacher-timesheet-card__note"><strong>Ghi chú đã gửi</strong>{{ timesheetBySession.get(session.id)?.notes }}</p>
            <form v-if="!timesheetBySession.get(session.id) || timesheetBySession.get(session.id)?.status === 'REJECTED'" class="teacher-timesheet-card__form" @submit.prevent="submit(session)">
              <label class="form-label" :for="`timesheet-note-${session.id}`">Ghi chú chấm công <span>(không bắt buộc)</span></label>
              <div class="teacher-timesheet-card__form-row">
                <textarea :id="`timesheet-note-${session.id}`" v-model="notes[session.id]" class="form-control" rows="2" maxlength="2000" placeholder="Thêm ghi chú về buổi dạy"></textarea>
                <button class="btn btn-primary" type="submit" :disabled="submittingId === session.id">
                  <span v-if="submittingId === session.id" class="app-button__spinner" aria-hidden="true"></span>
                  {{ submittingId === session.id ? 'Đang gửi…' : timesheetBySession.get(session.id)?.status === 'REJECTED' ? 'Gửi lại chấm công' : 'Gửi chấm công' }}
                </button>
              </div>
            </form>
            <div v-else class="teacher-timesheet-card__locked" role="status">{{ timesheetBySession.get(session.id)?.status === 'APPROVED' ? 'Yêu cầu đã được Admin duyệt.' : 'Yêu cầu đang chờ Admin duyệt.' }}</div>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.teacher-workspace { display: grid; gap: 16px; }
.teacher-workspace__intro { display: flex; align-items: baseline; gap: 10px; border-left: 3px solid var(--color-primary); padding: 2px 0 2px 12px; }
.teacher-workspace__eyebrow { color: var(--color-primary-active); font-size: 11px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
.teacher-workspace__intro p { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
.teacher-alert { margin: 0; }
.teacher-empty-card { border: 1px solid var(--color-border); border-radius: var(--radius-card); background: #fff; }
.teacher-timesheet-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.teacher-timesheet-summary__item { display: grid; min-height: 102px; align-content: space-between; gap: 4px; border: 1px solid var(--color-border); border-radius: 11px; padding: 13px 15px; background: #fff; box-shadow: var(--shadow-surface); }
.teacher-timesheet-summary__item span { color: var(--color-text-secondary); font-size: 11px; font-weight: 650; }
.teacher-timesheet-summary__item strong { color: var(--color-text); font-size: 25px; line-height: 1; }
.teacher-timesheet-summary__item small { color: var(--color-text-secondary); font-size: 10px; }
.teacher-timesheet-summary__item--action { border-color: #bed9d7; background: #f4faf9; }
.teacher-timesheet-summary__item--action strong { color: var(--color-primary-active); }
.teacher-timesheet-summary__item--success strong { color: var(--color-success); }
.teacher-timesheet-summary__item--attention strong { color: var(--color-danger); }
.teacher-timesheet-list { display: grid; gap: 12px; }
.teacher-timesheet-card { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 18px; border: 1px solid var(--color-border); border-radius: 13px; padding: 18px; background: #fff; box-shadow: var(--shadow-surface); }
.teacher-timesheet-card__time { display: grid; align-content: start; gap: 5px; border-right: 1px solid var(--color-border); padding-right: 14px; color: var(--color-primary-active); font-size: 12px; font-weight: 650; }
.teacher-timesheet-card__time strong { color: var(--color-text-secondary); font-size: 11px; font-weight: 500; }
.teacher-timesheet-card__main { display: grid; min-width: 0; gap: 12px; }
.teacher-timesheet-card__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.teacher-timesheet-card__heading h2 { margin: 0 0 3px; font-size: 16px; }
.teacher-timesheet-card__subline { color: var(--color-text-secondary); font-size: 11px; }
.teacher-timesheet-card__rejection, .teacher-timesheet-card__note { display: grid; gap: 3px; border-radius: 8px; margin: 0; padding: 10px 12px; font-size: 12px; white-space: pre-wrap; }
.teacher-timesheet-card__rejection { color: #812732; background: var(--color-danger-soft); }
.teacher-timesheet-card__note { color: var(--color-text-secondary); background: #f5f7f6; }
.teacher-timesheet-card__rejection strong, .teacher-timesheet-card__note strong { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
.teacher-timesheet-card__form { display: grid; gap: 6px; }
.teacher-timesheet-card__form .form-label { margin: 0; }
.teacher-timesheet-card__form .form-label span { color: var(--color-text-secondary); font-weight: 400; }
.teacher-timesheet-card__form-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 10px; }
.teacher-timesheet-card__form-row .btn { min-width: 168px; }
.teacher-timesheet-card__locked { border-top: 1px solid #eef1f0; padding-top: 11px; color: var(--color-text-secondary); font-size: 12px; }

@media (max-width: 767.98px) {
  .teacher-workspace { gap: 12px; }
  .teacher-workspace__intro { align-items: flex-start; flex-direction: column; gap: 3px; }
  .teacher-workspace__intro p { font-size: 12px; }
  .teacher-timesheet-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .teacher-timesheet-summary__item { min-height: 92px; padding: 11px 12px; }
  .teacher-timesheet-card { grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 14px; }
  .teacher-timesheet-card__time { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-right: 0; border-bottom: 1px solid var(--color-border); padding: 0 0 10px; }
  .teacher-timesheet-card__form-row { grid-template-columns: minmax(0, 1fr); }
  .teacher-timesheet-card__form-row .btn { width: 100%; }
}
</style>
