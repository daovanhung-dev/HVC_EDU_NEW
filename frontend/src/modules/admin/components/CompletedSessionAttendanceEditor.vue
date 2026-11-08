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

    <div class="table-responsive completed-session-table-wrap">
      <table class="table table-sm table-bordered table-hover align-middle mb-0 completed-session-table" aria-label="Điểm danh và kết quả học tập theo cột Excel">
        <thead class="table-light">
          <tr>
            <th scope="col">Mã học sinh</th>
            <th scope="col">Họ và tên</th>
            <th scope="col">Trạng thái điểm danh</th>
            <th scope="col">Phút đi muộn</th>
            <th scope="col">Lý do vắng</th>
            <th scope="col">Điểm BTVN /10</th>
            <th scope="col">Ghi chú BTVN</th>
            <th scope="col">Hiểu bài /5</th>
            <th scope="col">Thái độ /5</th>
            <th scope="col">Điểm cộng</th>
            <th scope="col">Ghi nhận điểm cộng</th>
            <th scope="col">Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.student_id">
            <td>{{ row.students?.student_code || '—' }}</td>
            <td class="student-name-cell">{{ row.students?.full_name || '—' }}</td>
            <td>
              <select v-if="editing" v-model="row.attendance.status" class="form-select form-select-sm" :disabled="saving" :aria-label="`Trạng thái điểm danh của ${row.students?.full_name || 'học sinh'}`">
                <option :value="null">Chọn trạng thái</option>
                <option v-for="status in attendanceStatuses" :key="status" :value="status">{{ attendanceStatusLabel(status) }}</option>
              </select>
              <span v-else>{{ row.attendance.status ? attendanceStatusLabel(row.attendance.status) : '—' }}</span>
            </td>
            <td><input v-if="editing" class="form-control form-control-sm numeric-cell" type="number" min="0" step="1" :value="row.attendance.late_minutes ?? ''" :disabled="saving || row.attendance.status !== 'LATE'" :aria-label="`Phút đi muộn của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'late_minutes', $event)" /><span v-else>{{ formatNumber(row.attendance.late_minutes) }}</span></td>
            <td><input v-if="editing" v-model="row.attendance.absence_reason" class="form-control form-control-sm" :disabled="saving || !['ABSENT', 'EXCUSED'].includes(row.attendance.status || '')" :aria-label="`Lý do vắng của ${row.students?.full_name || 'học sinh'}`" /><span v-else>{{ rowText(row, 'absence_reason') }}</span></td>
            <td><input v-if="editing" class="form-control form-control-sm numeric-cell" type="number" min="0" max="10" step="0.1" :value="row.attendance.homework_score ?? ''" :disabled="saving" :aria-label="`Điểm BTVN của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'homework_score', $event)" /><span v-else>{{ formatNumber(row.attendance.homework_score) }}</span></td>
            <td><input v-if="editing" v-model="row.attendance.homework_note" class="form-control form-control-sm" :disabled="saving" :aria-label="`Ghi chú BTVN của ${row.students?.full_name || 'học sinh'}`" /><span v-else>{{ rowText(row, 'homework_note') }}</span></td>
            <td><input v-if="editing" class="form-control form-control-sm numeric-cell" type="number" min="1" max="5" step="1" :value="row.attendance.understanding_score ?? ''" :disabled="saving" :aria-label="`Điểm hiểu bài của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'understanding_score', $event)" /><span v-else>{{ formatNumber(row.attendance.understanding_score) }}</span></td>
            <td><input v-if="editing" class="form-control form-control-sm numeric-cell" type="number" min="1" max="5" step="1" :value="row.attendance.attitude_score ?? ''" :disabled="saving" :aria-label="`Điểm thái độ của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'attitude_score', $event)" /><span v-else>{{ formatNumber(row.attendance.attitude_score) }}</span></td>
            <td><input v-if="editing" class="form-control form-control-sm numeric-cell" type="number" min="0" step="1" :value="row.attendance.positive_feedback_count ?? ''" :disabled="saving" :aria-label="`Điểm cộng của ${row.students?.full_name || 'học sinh'}`" @input="updateNumber(row, 'positive_feedback_count', $event)" /><span v-else>{{ formatNumber(row.attendance.positive_feedback_count) }}</span></td>
            <td><input v-if="editing" v-model="row.attendance.positive_feedback_raw" class="form-control form-control-sm" :disabled="saving" :aria-label="`Ghi nhận điểm cộng của ${row.students?.full_name || 'học sinh'}`" /><span v-else>{{ rowText(row, 'positive_feedback_raw') }}</span></td>
            <td><textarea v-if="editing" v-model="row.attendance.comment" class="form-control form-control-sm comment-cell" rows="2" maxlength="2000" :disabled="saving" :aria-label="`Nhận xét của ${row.students?.full_name || 'học sinh'}`" /><span v-else>{{ rowText(row, 'comment') }}</span></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="12" class="text-center text-secondary py-4">Không có dữ liệu học sinh của buổi này.</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="error" class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ error }}</div>
    <div v-if="editing" class="d-flex flex-wrap justify-content-end gap-2 mt-3">
      <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="saving" @click="emit('cancel')">Hủy sửa</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="saving || !dirty" @click="emit('save')">{{ saving ? 'Đang lưu…' : 'Lưu tất cả thay đổi' }}</button>
    </div>
  </section>
</template>

<style scoped>
.completed-session-table {
  min-width: 150rem;
}

.completed-session-table th,
.completed-session-table td {
  vertical-align: middle;
  min-width: 8rem;
}

.completed-session-table th:first-child,
.completed-session-table td:first-child {
  min-width: 11rem;
}

.student-name-cell {
  min-width: 14rem !important;
}

.numeric-cell {
  min-width: 6rem;
}

.comment-cell {
  min-width: 20rem;
}
</style>
