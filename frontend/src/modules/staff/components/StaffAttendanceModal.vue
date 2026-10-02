<script setup lang="ts">
import BaseModal from '@/app/components/BaseModal.vue'
import type { SessionRow } from '@/shared/types/domain'
import { attendanceStatuses, attendanceStatusLabel, attendanceValidationError, type AttendanceStudentRow } from '../attendance'
import { formatDateTime } from '@/shared/utils/format'

const props = withDefaults(defineProps<{
  modelValue: boolean
  session: SessionRow | null
  rows: AttendanceStudentRow[]
  readOnly?: boolean
  dirty?: boolean
  saving?: boolean
  dirtyCount?: number
  validating?: boolean
  validationErrors?: Record<string, string>
  optimizingStudentId?: string
  suggestions?: Record<string, string>
  aiErrors?: Record<string, string>
}>(), {
  readOnly: false,
  dirty: false,
  saving: false,
  dirtyCount: 0,
  validating: false,
  validationErrors: () => ({}),
  optimizingStudentId: '',
  suggestions: () => ({}),
  aiErrors: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: []
  optimize: [studentId: string, comment: string]
  'apply-suggestion': [studentId: string]
}>()

const isBusy = () => props.saving || Boolean(props.optimizingStudentId)

function cellError(row: AttendanceStudentRow) {
  return props.validationErrors[row.student_id] || (props.validating ? attendanceValidationError(row.attendance) : null)
}

function statusTone(status: string | null) {
  if (status === 'PRESENT') return 'attendance-state--present'
  if (status === 'LATE') return 'attendance-state--late'
  if (status === 'ABSENT') return 'attendance-state--absent'
  if (status === 'EXCUSED') return 'attendance-state--excused'
  return 'attendance-state--empty'
}

function studentName(row: AttendanceStudentRow) {
  return row.students?.full_name?.trim() || 'Học sinh'
}
</script>

<template>
  <BaseModal
    class="staff-attendance-modal"
    :model-value="modelValue"
    :title="readOnly ? 'Kết quả điểm danh' : 'Điểm danh và kết quả học tập'"
    :description="session ? `${session.classes?.name || 'Lớp học'} · ${formatDateTime(session.scheduled_start_at)} · ${rows.length} học sinh` : ''"
    size="xl"
    teleport-to-body
    :busy="isBusy()"
    :dirty="dirty"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="session">
      <div class="attendance-modal__toolbar">
        <div class="attendance-modal__status">
          <span class="attendance-modal__live-dot" :class="{ 'attendance-modal__live-dot--complete': readOnly }" aria-hidden="true"></span>
          <span>{{ readOnly ? 'Chế độ xem kết quả' : 'Đang nhập kết quả' }}</span>
        </div>
        <p class="attendance-modal__keyboard-hint mb-0">Dùng phím Tab để chuyển nhanh giữa các ô.</p>
      </div>

      <div v-if="!rows.length" class="attendance-modal__empty" role="status">
        <strong>Buổi học chưa có học sinh trong danh sách.</strong>
        <span>Hãy kiểm tra lại sĩ số lớp với Admin.</span>
      </div>

      <div v-else class="attendance-table-wrap table-responsive" :class="{ 'attendance-table-wrap--readonly': readOnly }">
        <table class="table table-sm align-middle attendance-grid">
          <caption class="visually-hidden">Bảng điểm danh và kết quả học tập của {{ rows.length }} học sinh</caption>
          <thead>
            <tr>
              <th scope="col" class="attendance-grid__number">#</th>
              <th scope="col" class="attendance-grid__student">Học sinh</th>
              <th scope="col">Điểm danh</th>
              <th scope="col">Phút muộn</th>
              <th scope="col">Lý do vắng</th>
              <th scope="col">BTVN /10</th>
              <th scope="col">Ghi chú BTVN</th>
              <th scope="col">Hiểu bài /5</th>
              <th scope="col">Thái độ /5</th>
              <th scope="col">Điểm cộng</th>
              <th scope="col">Ghi nhận điểm cộng</th>
              <th scope="col" class="attendance-grid__comment">Nhận xét phụ huynh</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="row.student_id" :class="{ 'attendance-grid__row--dirty': !readOnly && cellError(row) }">
              <td data-label="#" class="attendance-grid__number">{{ String(index + 1).padStart(2, '0') }}</td>
              <td :data-label="'Học sinh'" class="attendance-grid__student">
                <div class="attendance-grid__student-copy">
                  <strong>{{ studentName(row) }}</strong>
                  <small>{{ row.students?.student_code || 'Chưa có mã học sinh' }}</small>
                  <span class="badge" :class="statusTone(row.attendance.status)">{{ attendanceStatusLabel(row.attendance.status) }}</span>
                </div>
              </td>
              <td data-label="Điểm danh">
                <select v-model="row.attendance.status" class="form-select form-select-sm attendance-grid__control" :disabled="readOnly || saving" :aria-label="`Trạng thái điểm danh của ${studentName(row)}`" :aria-invalid="Boolean(cellError(row))">
                  <option :value="null">Chọn trạng thái</option>
                  <option v-for="status in attendanceStatuses" :key="status" :value="status">{{ attendanceStatusLabel(status) }}</option>
                </select>
                <small v-if="cellError(row)" class="attendance-grid__error">{{ cellError(row) }}</small>
              </td>
              <td data-label="Phút muộn">
                <input v-model.number="row.attendance.late_minutes" class="form-control form-control-sm attendance-grid__control" type="number" min="0" inputmode="numeric" :disabled="readOnly || saving || row.attendance.status !== 'LATE'" :aria-label="`Số phút đi muộn của ${studentName(row)}`" placeholder="—" />
              </td>
              <td data-label="Lý do vắng">
                <input v-model="row.attendance.absence_reason" class="form-control form-control-sm attendance-grid__control attendance-grid__text" :disabled="readOnly || saving || !['ABSENT', 'EXCUSED'].includes(row.attendance.status || '')" :aria-label="`Lý do vắng của ${studentName(row)}`" placeholder="Nhập lý do" />
              </td>
              <td data-label="BTVN /10">
                <input v-model.number="row.attendance.homework_score" class="form-control form-control-sm attendance-grid__control attendance-grid__number-input" type="number" min="0" max="10" step="0.1" inputmode="decimal" :disabled="readOnly || saving" :aria-label="`Điểm bài tập về nhà của ${studentName(row)}`" placeholder="—" />
              </td>
              <td data-label="Ghi chú BTVN">
                <input v-model="row.attendance.homework_note" class="form-control form-control-sm attendance-grid__control attendance-grid__text" :disabled="readOnly || saving" :aria-label="`Ghi chú bài tập về nhà của ${studentName(row)}`" placeholder="Nhận xét bài tập" />
              </td>
              <td data-label="Hiểu bài /5">
                <input v-model.number="row.attendance.understanding_score" class="form-control form-control-sm attendance-grid__control attendance-grid__number-input" type="number" min="1" max="5" step="1" inputmode="numeric" :disabled="readOnly || saving" :aria-label="`Mức hiểu bài của ${studentName(row)}`" placeholder="—" />
              </td>
              <td data-label="Thái độ /5">
                <input v-model.number="row.attendance.attitude_score" class="form-control form-control-sm attendance-grid__control attendance-grid__number-input" type="number" min="1" max="5" step="1" inputmode="numeric" :disabled="readOnly || saving" :aria-label="`Mức thái độ của ${studentName(row)}`" placeholder="—" />
              </td>
              <td data-label="Điểm cộng">
                <input v-model.number="row.attendance.positive_feedback_count" class="form-control form-control-sm attendance-grid__control attendance-grid__number-input" type="number" min="0" step="1" inputmode="numeric" :disabled="readOnly || saving" :aria-label="`Số điểm cộng của ${studentName(row)}`" placeholder="0" />
              </td>
              <td data-label="Ghi nhận điểm cộng">
                <input v-model="row.attendance.positive_feedback_raw" class="form-control form-control-sm attendance-grid__control attendance-grid__text" :disabled="readOnly || saving" :aria-label="`Ghi nhận điểm cộng của ${studentName(row)}`" placeholder="Lý do / biểu dương" />
              </td>
              <td data-label="Nhận xét phụ huynh" class="attendance-grid__comment">
                <textarea v-model="row.attendance.comment" class="form-control form-control-sm attendance-grid__control attendance-grid__comment-input" rows="2" maxlength="2000" :disabled="readOnly || saving" :aria-label="`Nhận xét dành cho phụ huynh của ${studentName(row)}`" placeholder="Nhận xét học sinh…"></textarea>
                <template v-if="!readOnly">
                  <p class="attendance-ai__privacy">Chỉ gửi nội dung nhận xét tới Gemini. Không nhập tên hoặc mã học sinh.</p>
                  <button class="btn btn-outline-primary btn-sm attendance-ai__button" type="button" :disabled="saving || optimizingStudentId === row.student_id || !row.attendance.comment.trim()" @click="emit('optimize', row.student_id, row.attendance.comment)">
                    <span v-if="optimizingStudentId === row.student_id" class="app-button__spinner" aria-hidden="true"></span>
                    {{ optimizingStudentId === row.student_id ? 'Đang viết lại…' : 'Tối ưu nhận xét' }}
                  </button>
                  <div v-if="aiErrors[row.student_id]" class="attendance-ai__error" role="alert">{{ aiErrors[row.student_id] }}</div>
                  <div v-if="suggestions[row.student_id]" class="attendance-ai__suggestion" role="status">
                    <span class="attendance-ai__suggestion-label">Bản nháp Gemini</span>
                    <p>{{ suggestions[row.student_id] }}</p>
                    <button class="btn btn-primary btn-sm" type="button" :disabled="saving" @click="emit('apply-suggestion', row.student_id)">Dùng nhận xét này</button>
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="rows.length" class="attendance-modal__summary" aria-live="polite">
        <span><strong>{{ rows.filter((row) => row.attendance.status).length }}/{{ rows.length }}</strong> học sinh đã có trạng thái điểm danh</span>
        <span v-if="!readOnly && dirtyCount" class="attendance-modal__dirty-count">{{ dirtyCount }} dòng chưa lưu</span>
      </div>
    </template>

    <template #footer>
      <button class="btn btn-outline-secondary" type="button" :disabled="isBusy()" @click="emit('update:modelValue', false)">{{ readOnly ? 'Đóng' : 'Đóng bảng' }}</button>
      <button v-if="!readOnly" class="btn btn-primary attendance-modal__save" type="button" :disabled="saving || !dirtyCount || !rows.length" :aria-busy="saving || undefined" @click="emit('save')">
        <span v-if="saving" class="app-button__spinner" aria-hidden="true"></span>
        {{ saving ? 'Đang lưu…' : dirtyCount ? `Lưu ${dirtyCount} dòng đã đổi` : 'Không có thay đổi' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.attendance-modal__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: -2px 0 14px; }
.attendance-modal__status { display: inline-flex; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 13px; font-weight: 600; }
.attendance-modal__live-dot { width: 9px; height: 9px; border-radius: 50%; background: #c27825; box-shadow: 0 0 0 4px rgb(194 120 37 / 14%); }
.attendance-modal__live-dot--complete { background: var(--color-success); box-shadow: 0 0 0 4px rgb(31 107 77 / 13%); }
.attendance-modal__keyboard-hint { color: var(--color-text-secondary); font-size: 12px; }
.attendance-modal__empty { display: grid; justify-items: center; gap: 5px; border: 1px dashed var(--color-border); border-radius: 12px; padding: 36px 16px; color: var(--color-text-secondary); text-align: center; }
.attendance-modal__empty strong { color: var(--color-text); }
.attendance-table-wrap { max-height: min(64vh, 720px); overflow: auto !important; border: 1px solid var(--color-border); border-radius: 10px; }
.attendance-grid { width: max-content; min-width: 100%; table-layout: fixed; }
.attendance-grid th, .attendance-grid td { border-bottom: 1px solid #e8edeb; padding: 9px 8px; vertical-align: top; }
.attendance-grid thead th { position: sticky; top: 0; z-index: 4; background: #f4f8f7; }
.attendance-grid__number { width: 48px; color: var(--color-text-muted); text-align: center; }
.attendance-grid__student { position: sticky; left: 0; z-index: 3; width: 180px; min-width: 180px; background: #fff; box-shadow: 5px 0 8px -8px rgb(29 44 47 / 45%); }
.attendance-grid thead .attendance-grid__student { z-index: 5; background: #f4f8f7; }
.attendance-grid__student-copy { display: grid; gap: 4px; }
.attendance-grid__student-copy strong { color: var(--color-text); font-size: 13px; line-height: 1.35; }
.attendance-grid__student-copy small { color: var(--color-text-secondary); font-size: 11px; }
.attendance-state--present { color: #18573f; background: #e8f3eb; }
.attendance-state--late { color: #744b12; background: #fff4df; }
.attendance-state--absent { color: #812732; background: #fceaec; }
.attendance-state--excused { color: #285f78; background: #eaf2f6; }
.attendance-state--empty { color: var(--color-text-secondary); background: #edf1f0; }
.attendance-grid__control { width: 100%; min-width: 90px; min-height: 38px; font-size: 12px; }
.attendance-grid__text { min-width: 150px; }
.attendance-grid__number-input { min-width: 88px; }
.attendance-grid__comment { width: 340px; min-width: 340px; }
.attendance-grid__comment-input { min-width: 300px; resize: vertical; }
.attendance-grid__error { display: block; margin-top: 5px; color: var(--color-danger); font-size: 11px; }
.attendance-grid__row--dirty { background: #fcfdfb; }
.attendance-ai__privacy { margin: 5px 0 6px; color: var(--color-text-secondary); font-size: 10px; line-height: 1.4; }
.attendance-ai__button { min-height: 34px; width: 100%; padding: 5px 8px; font-size: 11px; }
.attendance-ai__error { margin-top: 6px; color: var(--color-danger); font-size: 11px; }
.attendance-ai__suggestion { display: grid; gap: 7px; margin-top: 8px; border: 1px solid #bfd8d5; border-radius: 8px; padding: 9px; background: #f3f9f7; }
.attendance-ai__suggestion-label { color: var(--color-primary-active); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .045em; }
.attendance-ai__suggestion p { margin: 0; color: var(--color-text); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
.attendance-ai__suggestion .btn { justify-self: start; min-height: 34px; }
.attendance-modal__summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; color: var(--color-text-secondary); font-size: 12px; }
.attendance-modal__summary strong { color: var(--color-text); }
.attendance-modal__dirty-count { color: var(--color-accent); font-weight: 700; }
.attendance-modal__save { min-width: 190px; }
.staff-attendance-modal.app-modal :deep(.modal-dialog.modal-xl) { width: min(1500px, calc(100vw - 32px)); max-width: min(1500px, calc(100vw - 32px)); }

@media (max-width: 767.98px) {
  .attendance-modal__toolbar { align-items: flex-start; flex-direction: column; gap: 4px; }
  .attendance-modal__keyboard-hint { font-size: 11px; }
  .staff-attendance-modal.app-modal :deep(.modal-dialog.modal-xl) { width: 100%; max-width: 100%; }
  .attendance-table-wrap { max-height: calc(100dvh - 275px); border: 0; overflow: visible !important; }
  .attendance-grid { width: 100%; min-width: 0; table-layout: auto; }
  .attendance-grid > tbody { gap: 12px !important; }
  .attendance-grid > tbody > tr { gap: 0; border-radius: 12px !important; padding: 10px 14px !important; }
  .attendance-grid > tbody > tr > td { grid-template-columns: minmax(104px, 34%) minmax(0, 1fr) !important; align-items: center; gap: 10px !important; padding: 7px 0 !important; }
  .attendance-grid > tbody > tr > td::before { font-size: 11px !important; }
  .attendance-grid > tbody > tr > td.attendance-grid__number { display: none; }
  .attendance-grid > tbody > tr > td.attendance-grid__student { position: static; width: auto; min-width: 0; border-bottom: 1px solid var(--color-border); margin-bottom: 4px; padding-bottom: 10px !important; box-shadow: none; }
  .attendance-grid__student-copy { grid-template-columns: 1fr auto; align-items: center; }
  .attendance-grid__student-copy small { grid-column: 1; }
  .attendance-grid__student-copy .badge { grid-column: 2; grid-row: 1 / span 2; white-space: nowrap; }
  .attendance-grid > tbody > tr > td.attendance-grid__comment { display: grid; width: auto; min-width: 0; grid-template-columns: 1fr !important; gap: 7px !important; }
  .attendance-grid > tbody > tr > td.attendance-grid__comment::before { grid-column: 1; }
  .attendance-grid__comment-input { min-width: 0; min-height: 88px; font-size: 14px; }
  .attendance-ai__privacy { font-size: 11px; }
  .attendance-modal__summary { align-items: flex-start; flex-direction: column; }
  .attendance-modal__save { flex: 1 1 auto; }
}
</style>
