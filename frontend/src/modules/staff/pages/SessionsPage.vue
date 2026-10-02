<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { completeSession, optimizeTeacherComment, startSession, updateSessionLearning } from '@/services/commands'
import { getMySessions, getSessionStudents } from '@/services/data-queries'
import type { AttendanceStatus, SessionRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { userErrorMessage } from '@/shared/utils/errors'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'
import SessionMonthCalendar from '@/app/components/SessionMonthCalendar.vue'
import StaffAttendanceModal from '../components/StaffAttendanceModal.vue'
import { attendanceIsDirty, attendanceStatusLabel, attendanceValidationError, createAttendanceValue, toAttendanceSaveInput, type AttendanceStudentRow } from '../attendance'
import { isValidYouTubeUrl } from '@/shared/utils/youtube'
import YouTubePlayer from '@/app/components/YouTubePlayer.vue'

interface SessionStudentSource {
  student_id: string
  students?: { full_name?: string; student_code?: string } | null
  student_attendances?: Array<Record<string, unknown>> | null
  assessment_snapshot?: Record<string, unknown> | null
}

const toast = useToastStore()
const sessions = ref<SessionRow[]>([])
const students = ref<AttendanceStudentRow[]>([])
const selected = ref<SessionRow | null>(null)
const sessionNote = ref('')
const lessonYoutubeUrl = ref('')
const errorMessage = ref('')
const saving = ref(false)
const loading = ref(false)
const studentsLoading = ref(false)
const attendanceModalOpen = ref(false)
const validationErrors = ref<Record<string, string>>({})
const optimizingStudentId = ref('')
const suggestions = ref<Record<string, string>>({})
const aiErrors = ref<Record<string, string>>({})
const sessionDetailElement = ref<HTMLElement | null>(null)

const dirtyRows = computed(() => students.value.filter(attendanceIsDirty))
const dirtyCount = computed(() => dirtyRows.value.length)
const attendanceCount = computed(() => students.value.filter((row) => row.attendance.status).length)
const canComplete = computed(() => Boolean(
  selected.value?.status === 'IN_PROGRESS' && students.value.length &&
  attendanceCount.value === students.value.length && dirtyCount.value === 0,
))

const sessionStatusLabels: Record<SessionRow['status'], string> = {
  SCHEDULED: 'Sắp diễn ra',
  IN_PROGRESS: 'Đang học',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}

function statusTone(status: SessionRow['status']) {
  return `teacher-session-status--${status.toLowerCase().replaceAll('_', '-')}`
}

function attendanceBadgeClass(status: AttendanceStatus | null) {
  if (status === 'PRESENT') return 'text-bg-success'
  if (status === 'LATE') return 'text-bg-warning'
  if (status === 'ABSENT') return 'text-bg-danger'
  if (status === 'EXCUSED') return 'text-bg-info'
  return 'text-bg-secondary'
}

function showError(error: unknown, fallback: string) {
  errorMessage.value = userErrorMessage(error, fallback)
}

function rowFromSource(row: SessionStudentSource): AttendanceStudentRow {
  const saved = row.student_attendances?.[0]
  const snapshot = row.assessment_snapshot || {}
  const value = createAttendanceValue(saved || {
    student_id: row.student_id,
    status: null,
    late_minutes: null,
    absence_reason: '',
    homework_score: null,
    homework_note: snapshot.homework_note,
    understanding_score: snapshot.understanding_raw,
    attitude_score: snapshot.attitude_raw,
    positive_feedback_count: null,
    positive_feedback_raw: snapshot.positive_feedback_raw,
    comment: snapshot.comment_raw,
  })
  return { student_id: row.student_id, students: row.students, attendance: value, initialAttendance: { ...value } }
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    sessions.value = await getMySessions()
  } catch (error) {
    showError(error, 'Không thể tải danh sách buổi học.')
  } finally {
    loading.value = false
  }
}

async function openSession(session: SessionRow) {
  selected.value = session
  sessionNote.value = session.session_note || ''
  lessonYoutubeUrl.value = session.lesson_youtube_url || ''
  errorMessage.value = ''
  validationErrors.value = {}
  suggestions.value = {}
  aiErrors.value = {}
  studentsLoading.value = true
  try {
    students.value = (await getSessionStudents(session.id) as SessionStudentSource[]).map(rowFromSource)
  } catch (error) {
    students.value = []
    showError(error, 'Không thể tải danh sách học sinh của buổi học.')
  } finally {
    studentsLoading.value = false
  }
  if (window.matchMedia?.('(max-width: 1199.98px)').matches && sessionDetailElement.value) {
    sessionDetailElement.value.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }
}

function openAttendance() {
  if (!selected.value || studentsLoading.value) return
  validationErrors.value = {}
  attendanceModalOpen.value = true
}

async function saveAttendance() {
  if (!selected.value || saving.value || !dirtyCount.value) return
  const nextErrors: Record<string, string> = {}
  for (const row of dirtyRows.value) {
    const error = attendanceValidationError(row.attendance)
    if (error) nextErrors[row.student_id] = error
  }
  validationErrors.value = nextErrors
  if (Object.keys(nextErrors).length) return
  saving.value = true
  errorMessage.value = ''
  try {
    const changedRows = [...dirtyRows.value]
    await updateSessionLearning({
      session_id: selected.value.id,
      session_note: sessionNote.value,
      students: changedRows.map((row) => toAttendanceSaveInput(row)),
    })
    for (const row of changedRows) {
      const canonical = createAttendanceValue(toAttendanceSaveInput(row) as unknown as Record<string, unknown>)
      Object.assign(row.attendance, canonical)
      row.initialAttendance = { ...canonical }
      delete suggestions.value[row.student_id]
    }
    validationErrors.value = {}
    toast.success(`Đã lưu kết quả cho ${changedRows.length} học sinh.`)
  } catch (error) {
    showError(error, 'Không thể lưu điểm danh và nhận xét.')
  } finally {
    saving.value = false
  }
}

async function optimizeComment(studentId: string, comment: string) {
  if (!comment.trim() || optimizingStudentId.value) return
  optimizingStudentId.value = studentId
  delete aiErrors.value[studentId]
  delete suggestions.value[studentId]
  try {
    const result = await optimizeTeacherComment(comment.trim())
    const optimized = result.optimized_comment?.trim()
    if (!optimized) throw new Error('EMPTY_GEMINI_RESULT')
    suggestions.value[studentId] = optimized
  } catch (error) {
    aiErrors.value[studentId] = userErrorMessage(error, 'Không thể tối ưu nhận xét. Nội dung gốc vẫn được giữ nguyên.')
  } finally {
    optimizingStudentId.value = ''
  }
}

function applySuggestion(studentId: string) {
  const row = students.value.find((item) => item.student_id === studentId)
  const suggestion = suggestions.value[studentId]
  if (!row || !suggestion) return
  row.attendance.comment = suggestion
  delete suggestions.value[studentId]
  delete aiErrors.value[studentId]
}

function handleAttendanceOpenChange(open: boolean) {
  attendanceModalOpen.value = open
  if (open) return
  validationErrors.value = {}
  suggestions.value = {}
  aiErrors.value = {}
}

async function saveNote() {
  if (!selected.value || saving.value) return
  if (lessonYoutubeUrl.value.trim() && !isValidYouTubeUrl(lessonYoutubeUrl.value)) {
    errorMessage.value = 'Chỉ nhập link video YouTube hợp lệ.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await updateSessionLearning({ session_id: selected.value.id, session_note: sessionNote.value, lesson_youtube_url: lessonYoutubeUrl.value, students: [] })
    syncSelectedLearning()
    toast.success('Đã lưu nội dung buổi học.')
  } catch (error) {
    showError(error, 'Không thể lưu nội dung buổi học.')
  } finally {
    saving.value = false
  }
}

function syncSelectedLearning() {
  if (!selected.value) return
  const lessonUrl = lessonYoutubeUrl.value.trim() || null
  selected.value.session_note = sessionNote.value.trim() || null
  selected.value.lesson_youtube_url = lessonUrl
  const row = sessions.value.find((item) => item.id === selected.value?.id)
  if (row) {
    row.session_note = selected.value.session_note
    row.lesson_youtube_url = lessonUrl
  }
}

async function start() {
  if (!selected.value || saving.value) return
  const sessionId = selected.value.id
  saving.value = true
  errorMessage.value = ''
  try {
    await startSession(sessionId)
    toast.success('Đã bắt đầu buổi học.')
    await load()
    const updated = sessions.value.find((item) => item.id === sessionId)
    if (updated) {
      await openSession(updated)
      openAttendance()
    }
  } catch (error) {
    showError(error, 'Không thể bắt đầu buổi học.')
  } finally {
    saving.value = false
  }
}

async function complete() {
  if (!selected.value || saving.value) return
  if (!canComplete.value) {
    errorMessage.value = dirtyCount.value
      ? 'Hãy lưu các dòng đã thay đổi trước khi hoàn thành buổi học.'
      : 'Hãy điểm danh và lưu kết quả cho tất cả học sinh trước khi hoàn thành.'
    return
  }
  const sessionId = selected.value.id
  saving.value = true
  errorMessage.value = ''
  try {
    await completeSession(sessionId)
    toast.success('Đã hoàn thành buổi học.')
    attendanceModalOpen.value = false
    selected.value = null
    students.value = []
    await load()
  } catch (error) {
    showError(error, 'Không thể hoàn thành buổi học.')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="teacher-workspace teacher-sessions">
    <AppPageHeader title="Lịch giảng dạy" eyebrow="Không gian giáo viên" description="Theo dõi lịch dạy, mở buổi học và ghi nhận tiến độ của từng học sinh.">
      <template #actions>
        <button class="btn btn-outline-primary teacher-refresh" type="button" :disabled="loading" @click="load">
          <span aria-hidden="true">↻</span>{{ loading ? 'Đang làm mới…' : 'Làm mới lịch' }}
        </button>
      </template>
    </AppPageHeader>

    <div class="teacher-workspace__intro">
      <span class="teacher-workspace__eyebrow">Lịch và buổi học</span>
      <p>Chọn buổi để xem nhanh lớp, thời gian và thao tác phù hợp với trạng thái hiện tại.</p>
    </div>

    <div v-if="errorMessage" class="alert alert-danger teacher-alert" role="alert">{{ errorMessage }}</div>
    <div class="teacher-sessions__layout" :class="{ 'teacher-sessions__layout--selected': selected }">
      <section class="teacher-calendar-panel" aria-label="Lịch giảng dạy của tôi">
        <AppState v-if="loading && !sessions.length" kind="loading" title="Đang tải lịch giảng dạy" />
        <AppState v-else-if="errorMessage && !sessions.length" kind="error" title="Không thể tải lịch giảng dạy" :message="errorMessage" @retry="load" />
        <SessionMonthCalendar v-else :sessions="sessions" :selected-session-id="selected?.id" @select="openSession" />
      </section>

      <aside v-if="selected" ref="sessionDetailElement" class="teacher-session-panel" aria-labelledby="teacher-session-title">
        <header class="teacher-session-panel__header">
          <div class="teacher-session-panel__copy">
            <span class="teacher-session-panel__eyebrow">Chi tiết buổi học</span>
            <h2 id="teacher-session-title">{{ selected.classes?.name || 'Lớp học' }}</h2>
            <p>{{ formatDateTime(selected.scheduled_start_at) }} <span aria-hidden="true">·</span> {{ selected.room || selected.class_schedules?.room || 'Chưa xếp phòng' }}</p>
          </div>
          <span class="teacher-session-status" :class="statusTone(selected.status)">{{ sessionStatusLabels[selected.status] }}</span>
        </header>

        <div class="teacher-session-panel__actions">
          <button v-if="selected.status === 'SCHEDULED'" class="btn btn-primary" type="button" :disabled="saving" @click="start">
            <span v-if="saving" class="app-button__spinner" aria-hidden="true"></span>Bắt đầu buổi học
          </button>
          <template v-else-if="selected.status === 'IN_PROGRESS'">
            <button class="btn btn-primary" type="button" :disabled="studentsLoading" @click="openAttendance">Điểm danh <span class="teacher-session-panel__action-count">{{ attendanceCount }}/{{ students.length }}</span></button>
            <button class="btn btn-outline-primary" type="button" :disabled="saving || !canComplete" :title="canComplete ? 'Hoàn thành buổi học' : 'Lưu đủ kết quả điểm danh trước khi hoàn thành'" @click="complete">Hoàn thành</button>
          </template>
          <button v-else-if="selected.status === 'COMPLETED'" class="btn btn-outline-primary" type="button" :disabled="studentsLoading" @click="openAttendance">Xem kết quả</button>
        </div>

        <div v-if="selected.status === 'SCHEDULED'" class="teacher-session-panel__notice" role="status">
          <span class="teacher-session-panel__notice-icon" aria-hidden="true">◷</span>
          <span>Bắt đầu buổi học để mở bảng điểm danh và nhập kết quả.</span>
        </div>
        <div v-else-if="selected.status === 'IN_PROGRESS'" class="teacher-session-progress" aria-live="polite">
          <div class="teacher-session-progress__copy"><span>Tiến độ điểm danh</span><strong>{{ attendanceCount }} / {{ students.length }} học sinh</strong></div>
          <div class="teacher-session-progress__track" role="progressbar" :aria-valuenow="attendanceCount" :aria-valuemin="0" :aria-valuemax="students.length || 1" :aria-label="`Đã điểm danh ${attendanceCount} trên ${students.length} học sinh`"><span :style="{ width: `${students.length ? attendanceCount / students.length * 100 : 0}%` }"></span></div>
          <small v-if="dirtyCount">{{ dirtyCount }} dòng đang chờ lưu.</small>
          <small v-else-if="students.length && attendanceCount === students.length">Đã có trạng thái cho toàn bộ học sinh. Có thể hoàn thành buổi học.</small>
          <small v-else>Hoàn tất điểm danh và lưu kết quả để kết thúc buổi học.</small>
        </div>

        <section v-if="selected.status === 'IN_PROGRESS' || selected.status === 'COMPLETED'" class="teacher-session-note">
          <div class="teacher-session-note__heading">
            <div><span class="teacher-session-panel__eyebrow">Nội dung học tập</span><h3>Nội dung buổi học</h3></div>
            <button v-if="selected.status === 'IN_PROGRESS'" class="btn btn-outline-secondary btn-sm" type="button" :disabled="saving" @click="saveNote">Lưu nội dung</button>
          </div>
          <textarea v-if="selected.status === 'IN_PROGRESS'" id="session-note" v-model="sessionNote" class="form-control" rows="3" placeholder="Ghi nội dung đã học trong buổi này" aria-label="Nội dung buổi học"></textarea>
          <p v-else class="teacher-session-note__readout">{{ sessionNote || 'Chưa ghi nội dung buổi học.' }}</p>
          <div v-if="selected.status === 'IN_PROGRESS'" class="mt-3">
            <label class="form-label" for="lesson-youtube-url">Link video bài học (YouTube)</label>
            <input id="lesson-youtube-url" v-model="lessonYoutubeUrl" class="form-control" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" aria-describedby="lesson-youtube-help" :disabled="saving" />
            <small id="lesson-youtube-help" class="form-text">Có thể để trống. Link được lưu cùng nội dung buổi học.</small>
          </div>
          <YouTubePlayer v-if="selected.lesson_youtube_url" class="mt-3" :url="selected.lesson_youtube_url" :title="`Video bài học ${selected.classes?.name || ''}`" />
        </section>

        <div v-if="studentsLoading" class="teacher-session-panel__loading" role="status"><span class="app-state__spinner" aria-hidden="true"></span>Đang tải danh sách học sinh…</div>
        <div v-else-if="students.length" class="teacher-session-panel__roster">
          <div class="teacher-session-panel__roster-heading"><h3>Danh sách lớp</h3><span>{{ students.length }} học sinh</span></div>
          <ul>
            <li v-for="row in students.slice(0, 5)" :key="row.student_id">
              <span class="teacher-session-panel__student-avatar" aria-hidden="true">{{ (row.students?.full_name || 'H').slice(0, 1).toLocaleUpperCase('vi-VN') }}</span>
              <span class="teacher-session-panel__student-name">{{ row.students?.full_name || 'Học sinh' }}<small>{{ row.students?.student_code || 'Chưa có mã học sinh' }}</small></span>
              <span class="badge" :class="attendanceBadgeClass(row.attendance.status)">{{ attendanceStatusLabel(row.attendance.status) }}</span>
            </li>
          </ul>
          <button v-if="students.length > 5 && selected.status === 'IN_PROGRESS'" class="teacher-session-panel__more" type="button" @click="openAttendance">Mở bảng điểm danh toàn lớp</button>
        </div>
        <div v-else-if="selected.status !== 'SCHEDULED'" class="teacher-session-panel__empty">Buổi học chưa có học sinh trong danh sách.</div>
      </aside>
      <div v-else class="teacher-session-placeholder"><div class="teacher-session-placeholder__icon" aria-hidden="true">◫</div><strong>Chọn một buổi học</strong><span>Thông tin lớp và thao tác sẽ hiện tại đây.</span></div>
    </div>

    <StaffAttendanceModal
      :model-value="attendanceModalOpen"
      :session="selected"
      :rows="students"
      :read-only="selected?.status === 'COMPLETED'"
      :saving="saving"
      :dirty-count="dirtyCount"
      :validation-errors="validationErrors"
      :optimizing-student-id="optimizingStudentId"
      :suggestions="suggestions"
      :ai-errors="aiErrors"
      :dirty="selected?.status === 'IN_PROGRESS' && dirtyCount > 0"
      @update:model-value="handleAttendanceOpenChange"
      @save="saveAttendance"
      @optimize="optimizeComment"
      @apply-suggestion="applySuggestion"
    />
  </section>
</template>

<style scoped>
.teacher-workspace { display: grid; gap: 16px; }
.teacher-workspace__intro { display: flex; align-items: baseline; gap: 10px; border-left: 3px solid var(--color-primary); padding: 2px 0 2px 12px; }
.teacher-workspace__eyebrow, .teacher-session-panel__eyebrow { color: var(--color-primary-active); font-size: 11px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
.teacher-workspace__intro p { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
.teacher-refresh { min-height: 42px; }
.teacher-refresh span { font-size: 18px; line-height: .8; }
.teacher-alert { margin: 0; }
.teacher-sessions__layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, .58fr); align-items: start; gap: 18px; }
.teacher-sessions__layout:not(.teacher-sessions__layout--selected) { grid-template-columns: minmax(0, 1fr) minmax(240px, .36fr); }
.teacher-calendar-panel { min-width: 0; }
.teacher-session-panel, .teacher-session-placeholder { min-width: 0; border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 20px; background: #fff; box-shadow: var(--shadow-surface); scroll-margin-top: 84px; }
.teacher-session-panel { display: grid; gap: 18px; }
.teacher-session-panel__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.teacher-session-panel__copy { min-width: 0; }
.teacher-session-panel__copy h2 { margin: 4px 0 6px; font-size: 19px; }
.teacher-session-panel__copy p { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
.teacher-session-status { display: inline-flex; flex: 0 0 auto; align-items: center; border: 1px solid transparent; border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 700; }
.teacher-session-status--scheduled { color: #285f78; border-color: #c8dce9; background: #eaf2f6; }
.teacher-session-status--in-progress { color: var(--color-primary-active); border-color: #b8d8da; background: var(--color-primary-soft); }
.teacher-session-status--completed { color: var(--color-success); border-color: #c0dbc8; background: var(--color-success-soft); }
.teacher-session-status--cancelled { color: var(--color-danger); border-color: #e9c4c7; background: var(--color-danger-soft); }
.teacher-session-panel__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.teacher-session-panel__actions .btn { flex: 1 1 auto; }
.teacher-session-panel__action-count { border-radius: 999px; padding: 1px 7px; background: rgb(255 255 255 / 20%); font-size: 11px; }
.teacher-session-panel__notice { display: flex; align-items: center; gap: 10px; border: 1px solid #d0e0e8; border-radius: 10px; padding: 12px; color: #285f78; background: #f1f7fa; font-size: 13px; }
.teacher-session-panel__notice-icon { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border-radius: 50%; background: #e0edf3; font-size: 16px; }
.teacher-session-progress { display: grid; gap: 7px; border: 1px solid var(--color-border); border-radius: 10px; padding: 12px; background: #f8faf9; }
.teacher-session-progress__copy { display: flex; justify-content: space-between; gap: 8px; color: var(--color-text-secondary); font-size: 12px; }
.teacher-session-progress__copy strong { color: var(--color-text); }
.teacher-session-progress__track { height: 7px; overflow: hidden; border-radius: 999px; background: #e5ebea; }
.teacher-session-progress__track span { display: block; height: 100%; border-radius: inherit; background: var(--color-primary); transition: width var(--motion-normal) ease; }
.teacher-session-progress > small { color: var(--color-text-secondary); font-size: 11px; }
.teacher-session-note { display: grid; gap: 10px; border-top: 1px solid var(--color-border); padding-top: 16px; }
.teacher-session-note__heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.teacher-session-note__heading h3, .teacher-session-panel__roster-heading h3 { margin: 2px 0 0; font-size: 14px; }
.teacher-session-note__readout { margin: 0; border-radius: 8px; padding: 11px 12px; color: var(--color-text-secondary); background: #f6f8f7; font-size: 13px; white-space: pre-wrap; }
.teacher-session-panel__loading { display: flex; align-items: center; gap: 9px; color: var(--color-text-secondary); font-size: 12px; }
.teacher-session-panel__loading .app-state__spinner { width: 18px; height: 18px; }
.teacher-session-panel__roster { border-top: 1px solid var(--color-border); padding-top: 16px; }
.teacher-session-panel__roster-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.teacher-session-panel__roster-heading > span { color: var(--color-text-secondary); font-size: 11px; }
.teacher-session-panel__roster ul { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.teacher-session-panel__roster li { display: flex; align-items: center; gap: 9px; border-radius: 8px; padding: 7px 4px; }
.teacher-session-panel__roster li + li { border-top: 1px solid #eef1f0; }
.teacher-session-panel__student-avatar { display: grid; width: 32px; height: 32px; flex: 0 0 auto; place-items: center; border-radius: 50%; color: var(--color-primary-active); background: var(--color-primary-soft); font-size: 13px; font-weight: 700; }
.teacher-session-panel__student-name { display: grid; min-width: 0; flex: 1; color: var(--color-text); font-size: 12px; font-weight: 650; }
.teacher-session-panel__student-name small { color: var(--color-text-secondary); font-size: 10px; font-weight: 400; }
.teacher-session-panel__roster .badge { font-size: 10px; white-space: nowrap; }
.teacher-session-panel__more { width: 100%; border: 0; margin-top: 8px; padding: 6px; color: var(--color-primary-active); background: transparent; font-size: 12px; font-weight: 700; }
.teacher-session-panel__empty { border: 1px dashed var(--color-border); border-radius: 9px; padding: 14px; color: var(--color-text-secondary); font-size: 12px; text-align: center; }
.teacher-session-placeholder { display: grid; min-height: 260px; align-content: center; justify-items: center; gap: 6px; color: var(--color-text-secondary); text-align: center; }
.teacher-session-placeholder__icon { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 14px; color: var(--color-primary-active); background: var(--color-primary-soft); font-size: 23px; }
.teacher-session-placeholder strong { margin-top: 5px; color: var(--color-text); font-size: 14px; }
.teacher-session-placeholder span { font-size: 12px; }

@media (max-width: 1199.98px) {
  .teacher-sessions__layout, .teacher-sessions__layout:not(.teacher-sessions__layout--selected) { grid-template-columns: minmax(0, 1fr); }
  .teacher-session-placeholder { display: none; }
}

@media (max-width: 767.98px) {
  .teacher-workspace { gap: 12px; }
  .teacher-workspace__intro { align-items: flex-start; flex-direction: column; gap: 3px; }
  .teacher-workspace__intro p { font-size: 12px; }
  .teacher-session-panel { gap: 14px; padding: 16px; }
  .teacher-session-panel__header { flex-direction: column; }
  .teacher-session-panel__actions .btn { min-height: 46px; }
}
</style>
