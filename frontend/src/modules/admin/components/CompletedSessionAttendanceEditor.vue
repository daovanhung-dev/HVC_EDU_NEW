<script setup lang="ts">
import { computed } from 'vue'
import { attendanceStatusLabel, attendanceStatuses, type AttendanceStudentRow, type AttendanceValue } from '@/modules/staff/attendance'
import type { SessionRow } from '@/shared/types/domain'

const props = defineProps<{
  session: SessionRow
  editing: boolean
  saving: boolean
  dirty: boolean
  error: string
  timesheetSaving: boolean
  timesheetDirty: boolean
  timesheetError: string
  deletable: boolean
  deleting: boolean
}>()

const emit = defineEmits<{
  edit: []
  cancel: []
  save: []
  saveTimesheets: []
  delete: []
}>()

const rows = defineModel<AttendanceStudentRow[]>('rows', { required: true })
const startInput = defineModel<string>('startInput', { required: true })
const endInput = defineModel<string>('endInput', { required: true })
const roomInput = defineModel<string>('roomInput', { required: true })
const sessionNoteInput = defineModel<string>('sessionNoteInput', { required: true })
const lessonYoutubeInput = defineModel<string>('lessonYoutubeInput', { required: true })
const teacherEligibilityDraft = defineModel<Record<string, boolean | null>>('teacherEligibilityDraft', { required: true })

type NumericAttendanceKey = 'late_minutes' | 'homework_score' | 'understanding_score' | 'attitude_score' | 'positive_feedback_count'

const teachers = computed(() => (props.session.session_staff || [])
  .filter((item) => !item.assignment_role || item.assignment_role === 'TEACHER')
  .map((item) => item.staff?.full_name)
  .filter((name): name is string => Boolean(name)))

function formatText(value: string | null | undefined) {
  return value?.trim() || '—'
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : String(value)
}

function updateNumber(row: AttendanceStudentRow, key: NumericAttendanceKey, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.trim() === '' ? null : Number(input.value)
  Object.assign(row.attendance, { [key]: value === null || !Number.isFinite(value) ? null : value })
}

function rowText(row: AttendanceStudentRow, key: keyof AttendanceValue) {
  const value = row.attendance[key]
  return typeof value === 'string' ? formatText(value) : formatNumber(value as number | null)
}
</script>

<template>
  <section class="completed-session-editor" aria-label="Thông tin buổi học đã điểm danh">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
      <div>
        <h2 class="h5 mb-1">{{ session.classes?.name || 'Buổi học' }}</h2>
        <div class="small text-secondary">
          {{ [session.classes?.subjects?.name, session.classes?.grades?.name].filter(Boolean).join(' · ') || '—' }}
          · {{ session.status }} · Giáo viên: {{ teachers.join(', ') || 'Chưa phân công' }}
        </div>
        <div class="small text-secondary mt-1">
          {{ rows.length }} học sinh · attendance đầy đủ trong CSDL
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button v-if="!editing" class="btn btn-outline-primary btn-sm" type="button" @click="emit('edit')">
          Chỉnh sửa thông tin buổi
        </button>
        <button v-if="deletable" class="btn btn-outline-danger btn-sm" type="button" :disabled="deleting" @click="emit('delete')">
          {{ deleting ? 'Đang xem dữ liệu…' : 'Xóa buổi học' }}
        </button>
      </div>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-md-4"><label class="form-label" for="attended-session-start">Bắt đầu</label><input id="attended-session-start" v-model="startInput" class="form-control" type="datetime-local" :disabled="!editing || saving" /></div>
      <div class="col-md-4"><label class="form-label" for="attended-session-end">Kết thúc</label><input id="attended-session-end" v-model="endInput" class="form-control" type="datetime-local" :disabled="!editing || saving" /></div>
      <div class="col-md-4"><label class="form-label" for="attended-session-room">Phòng</label><input id="attended-session-room" v-model="roomInput" class="form-control" :disabled="!editing || saving" /></div>
      <div class="col-md-6"><label class="form-label" for="attended-session-note">Ghi chú buổi học</label><textarea id="attended-session-note" v-model="sessionNoteInput" class="form-control" rows="2" maxlength="4000" :disabled="!editing || saving" /></div>
      <div class="col-md-6"><label class="form-label" for="attended-session-video">Video YouTube</label><input id="attended-session-video" v-model="lessonYoutubeInput" class="form-control" type="url" placeholder="https://youtu.be/..." :disabled="!editing || saving" /></div>
      <div class="col-12 small text-secondary">
        Lớp, mã/tên học sinh, roster và giáo viên là dữ liệu cố định của buổi.
      </div>
    </div>

    <section class="border rounded p-3 mb-3" aria-label="Chấm công giáo viên cho buổi đã hoàn tất">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-2">
        <div>
          <h3 class="h6 mb-1">Chấm công giáo viên</h3>
          <p class="small text-secondary mb-0">Admin có thể ghi nhận hoặc điều chỉnh chấm công trực tiếp sau khi buổi hoàn tất.</p>
        </div>
      </div>
      <div v-if="!session.session_staff?.some((item) => !item.assignment_role || item.assignment_role === 'TEACHER')" class="small text-secondary">
        Buổi học chưa có giáo viên được phân công.
      </div>
      <div v-for="teacher in session.session_staff?.filter((item) => !item.assignment_role || item.assignment_role === 'TEACHER') || []" :key="teacher.staff_id" class="row align-items-center g-2 py-1">
        <label class="col-md-6" :for="`completed-timesheet-${teacher.staff_id}`">{{ teacher.staff?.full_name || teacher.staff_id }}</label>
        <div class="col-md-6">
          <select :id="`completed-timesheet-${teacher.staff_id}`" v-model="teacherEligibilityDraft[teacher.staff_id]" class="form-select" :disabled="timesheetSaving" :aria-label="`Quyết định chấm công của ${teacher.staff?.full_name || teacher.staff_id}`">
            <option :value="null">Chọn quyết định</option>
            <option :value="true">Tính công</option>
            <option :value="false">Không tính công</option>
          </select>
        </div>
      </div>
      <div v-if="timesheetError" class="alert alert-danger py-2 mt-2 mb-2" role="alert">{{ timesheetError }}</div>
      <div class="d-flex justify-content-end mt-2">
        <button class="btn btn-outline-primary btn-sm" type="button" :disabled="timesheetSaving || !timesheetDirty" @click="emit('saveTimesheets')">
          {{ timesheetSaving ? 'Đang lưu…' : 'Lưu quyết định chấm công' }}
        </button>
      </div>
    </section>

    <section class="completed-session-students" aria-label="Điểm danh và kết quả học tập của học sinh">
      <article v-for="row in rows" :key="row.student_id" class="completed-session-student card">
        <header class="completed-session-student__heading">
          <div>
            <h3 class="h6 mb-1">{{ row.students?.full_name || '—' }}</h3>
            <span class="small text-secondary">Mã học sinh: {{ row.students?.student_code || '—' }}</span>
          </div>
          <span v-if="!editing" class="badge rounded-pill" :class="row.attendance.status ? 'text-bg-success' : 'text-bg-light'">
            {{ row.attendance.status ? attendanceStatusLabel(row.attendance.status) : 'Chưa điểm danh' }}
          </span>
        </header>

        <dl class="completed-session-student__fields mb-0">
          <div class="completed-session-student__field">
            <dt><label v-if="editing" :for="`completed-status-${row.student_id}`">Điểm danh</label><span v-else>Điểm danh</span></dt>
            <dd>
              <select v-if="editing" :id="`completed-status-${row.student_id}`" v-model="row.attendance.status" class="form-select form-select-sm" :disabled="saving" :aria-label="`Trạng thái điểm danh của ${row.students?.full_name || 'học sinh'}`">
                <option :value="null">Chọn trạng thái</option>
                <option v-for="status in attendanceStatuses" :key="status" :value="status">{{ attendanceStatusLabel(status) }}</option>
              </select>
              <span v-else>{{ row.attendance.status ? attendanceStatusLabel(row.attendance.status) : '—' }}</span>
            </dd>
          </div>
          <div class="completed-session-student__field">
            <dt><label v-if="editing" :for="`completed-late-${row.student_id}`">Phút đi muộn</label><span v-else>Phút đi muộn</span></dt>
            <dd><input v-if="editing" :id="`completed-late-${row.student_id}`" class="form-control form-control-sm" type="number" min="0" step="1" :value="row.attendance.late_minutes ?? ''" :disabled="saving || row.attendance.status !== 'LATE'" :aria-label="`Phút đi muộn của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'late_minutes', $event)" /><span v-else>{{ formatNumber(row.attendance.late_minutes) }}</span></dd>
          </div>
          <div class="completed-session-student__field">
            <dt><label v-if="editing" :for="`completed-absence-${row.student_id}`">Lý do vắng</label><span v-else>Lý do vắng</span></dt>
            <dd><input v-if="editing" :id="`completed-absence-${row.student_id}`" v-model="row.attendance.absence_reason" class="form-control form-control-sm" :disabled="saving || !['ABSENT', 'EXCUSED'].includes(row.attendance.status || '')" :aria-label="`Lý do vắng của ${row.students?.full_name || 'học sinh'}`" /><span v-else>{{ rowText(row, 'absence_reason') }}</span></dd>
          </div>
          <div class="completed-session-student__field">
            <dt><label v-if="editing" :for="`completed-homework-${row.student_id}`">Điểm BTVN /10</label><span v-else>Điểm BTVN /10</span></dt>
            <dd><input v-if="editing" :id="`completed-homework-${row.student_id}`" class="form-control form-control-sm" type="number" min="0" max="10" step="0.1" :value="row.attendance.homework_score ?? ''" :disabled="saving" :aria-label="`Điểm BTVN của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'homework_score', $event)" /><span v-else>{{ formatNumber(row.attendance.homework_score) }}</span></dd>
          </div>
          <div class="completed-session-student__field completed-session-student__field--wide">
            <dt><label v-if="editing" :for="`completed-homework-note-${row.student_id}`">Ghi chú BTVN</label><span v-else>Ghi chú BTVN</span></dt>
            <dd><textarea v-if="editing" :id="`completed-homework-note-${row.student_id}`" v-model="row.attendance.homework_note" class="form-control form-control-sm completed-session-student__input-text" rows="2" :disabled="saving" :aria-label="`Ghi chú BTVN của ${row.students?.full_name || 'học sinh'}`" /><span v-else class="completed-session-student__value">{{ rowText(row, 'homework_note') }}</span></dd>
          </div>
          <div class="completed-session-student__field">
            <dt><label v-if="editing" :for="`completed-understanding-${row.student_id}`">Hiểu bài /5</label><span v-else>Hiểu bài /5</span></dt>
            <dd><input v-if="editing" :id="`completed-understanding-${row.student_id}`" class="form-control form-control-sm" type="number" min="1" max="5" step="1" :value="row.attendance.understanding_score ?? ''" :disabled="saving" :aria-label="`Điểm hiểu bài của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'understanding_score', $event)" /><span v-else>{{ formatNumber(row.attendance.understanding_score) }}</span></dd>
          </div>
          <div class="completed-session-student__field">
            <dt><label v-if="editing" :for="`completed-attitude-${row.student_id}`">Thái độ /5</label><span v-else>Thái độ /5</span></dt>
            <dd><input v-if="editing" :id="`completed-attitude-${row.student_id}`" class="form-control form-control-sm" type="number" min="1" max="5" step="1" :value="row.attendance.attitude_score ?? ''" :disabled="saving" :aria-label="`Điểm thái độ của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'attitude_score', $event)" /><span v-else>{{ formatNumber(row.attendance.attitude_score) }}</span></dd>
          </div>
          <div class="completed-session-student__field">
            <dt><label v-if="editing" :for="`completed-feedback-count-${row.student_id}`">Điểm cộng</label><span v-else>Điểm cộng</span></dt>
            <dd><input v-if="editing" :id="`completed-feedback-count-${row.student_id}`" class="form-control form-control-sm" type="number" min="0" step="1" :value="row.attendance.positive_feedback_count ?? ''" :disabled="saving" :aria-label="`Điểm cộng của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'positive_feedback_count', $event)" /><span v-else>{{ formatNumber(row.attendance.positive_feedback_count) }}</span></dd>
          </div>
          <div class="completed-session-student__field completed-session-student__field--wide">
            <dt><label v-if="editing" :for="`completed-feedback-raw-${row.student_id}`">Ghi nhận điểm cộng</label><span v-else>Ghi nhận điểm cộng</span></dt>
            <dd><textarea v-if="editing" :id="`completed-feedback-raw-${row.student_id}`" v-model="row.attendance.positive_feedback_raw" class="form-control form-control-sm completed-session-student__input-text" rows="2" :disabled="saving" :aria-label="`Ghi nhận điểm cộng của ${row.students?.full_name || 'học sinh'}`" /><span v-else class="completed-session-student__value">{{ rowText(row, 'positive_feedback_raw') }}</span></dd>
          </div>
          <div class="completed-session-student__field completed-session-student__field--wide completed-session-student__field--comment">
            <dt><label v-if="editing" :for="`completed-comment-${row.student_id}`">Nhận xét</label><span v-else>Nhận xét</span></dt>
            <dd><textarea v-if="editing" :id="`completed-comment-${row.student_id}`" v-model="row.attendance.comment" class="form-control form-control-sm completed-session-student__input-text" rows="3" maxlength="2000" :disabled="saving" :aria-label="`Nhận xét của ${row.students?.full_name || 'học sinh'}`" /><span v-else class="completed-session-student__value">{{ rowText(row, 'comment') }}</span></dd>
          </div>
        </dl>
      </article>
      <div v-if="!rows.length" class="text-center text-secondary py-4">Không có dữ liệu học sinh của buổi này.</div>
    </section>

    <div v-if="error" class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ error }}</div>
    <div v-if="editing" class="d-flex flex-wrap justify-content-end gap-2 mt-3">
      <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="saving" @click="emit('cancel')">Hủy sửa</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="saving || !dirty" @click="emit('save')">{{ saving ? 'Đang lưu…' : 'Lưu tất cả thay đổi' }}</button>
    </div>
  </section>
</template>

<style scoped>
.completed-session-students {
  display: grid;
  gap: 0.85rem;
}

.completed-session-student {
  min-width: 0;
  border-color: var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-surface);
}

.completed-session-student__heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.9rem 1rem;
  background: var(--color-surface-subtle);
}

.completed-session-student__fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem 1rem;
  padding: 1rem;
}

.completed-session-student__field {
  min-width: 0;
}

.completed-session-student__field dt {
  margin-bottom: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

.completed-session-student__field dd {
  min-width: 0;
  margin: 0;
  font-size: 0.9rem;
}

.completed-session-student__field--wide {
  grid-column: span 2;
}

.completed-session-student__field--comment {
  grid-column: 1 / -1;
}

.completed-session-student__value {
  display: block;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.completed-session-student__input-text {
  min-height: 3rem;
  resize: vertical;
}

@media (max-width: 991.98px) {
  .completed-session-student__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 575.98px) {
  .completed-session-student__fields {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
    padding: 0.85rem;
  }

  .completed-session-student__field--wide,
  .completed-session-student__field--comment {
    grid-column: auto;
  }
}
</style>
