<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BaseModal from '@/app/components/BaseModal.vue'
import type { SessionRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import type { AttendanceStudentRow } from '../attendance'
import {
  downloadSessionAttendanceTemplate,
  parseSessionAttendanceWorkbook,
  type AttendanceExcelIssue,
  type AttendanceExcelPatchRow,
} from '../session-attendance-excel'

const props = defineProps<{
  modelValue: boolean
  session: SessionRow | null
  rows: AttendanceStudentRow[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  apply: [patches: AttendanceExcelPatchRow[]]
  hidden: []
}>()

const fileInputId = `session-attendance-excel-${useId()}`
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const busy = ref(false)
const error = ref('')
const issues = ref<AttendanceExcelIssue[]>([])
const patches = ref<AttendanceExcelPatchRow[]>([])
const parsedRosterCount = ref(0)

const canApply = computed(() => !busy.value && !error.value && !issues.value.length && patches.value.length > 0)
const enteredFieldCount = computed(() => patches.value.reduce((sum, row) => sum + Object.keys(row.patch).length, 0))

function previewStatus(status: NonNullable<AttendanceExcelPatchRow['patch']['status']> | undefined) {
  if (!status) return 'Giữ trạng thái hiện có'
  return {
    PRESENT: 'Có mặt',
    LATE: 'Đi muộn',
    ABSENT: 'Vắng mặt',
    EXCUSED: 'Vắng có phép',
  }[status]
}

function reset() {
  if (fileInput.value) fileInput.value.value = ''
  fileName.value = ''
  error.value = ''
  issues.value = []
  patches.value = []
  parsedRosterCount.value = 0
}

watch(() => [props.modelValue, props.session?.id] as const, ([open, sessionId], previous) => {
  if (open && (!previous?.[0] || previous[1] !== sessionId)) reset()
  if (!open) reset()
})

async function downloadTemplate() {
  if (!props.session || !props.rows.length || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await downloadSessionAttendanceTemplate(props.session, props.rows)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không thể tạo biểu mẫu Excel.'
  } finally {
    busy.value = false
  }
}

async function readFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  reset()
  if (!file || !props.session) return
  fileName.value = file.name
  busy.value = true
  try {
    const result = await parseSessionAttendanceWorkbook(file, props.session, props.rows)
    issues.value = result.issues
    patches.value = result.patches
    parsedRosterCount.value = result.roster_count
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không thể đọc tệp Excel.'
  } finally {
    busy.value = false
  }
}

function apply() {
  if (!canApply.value) return
  emit('apply', patches.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal
    class="session-attendance-excel-modal"
    :model-value="modelValue"
    title="Điểm danh bằng Excel"
    :description="session ? `${session.classes?.name || 'Lớp học'} · ${formatDateTime(session.scheduled_start_at)}` : ''"
    size="lg"
    :busy="busy"
    @update:model-value="emit('update:modelValue', $event)"
    @hidden="emit('hidden')"
  >
    <div class="excel-import-intro">
      <p class="mb-1">Tải mẫu riêng cho buổi học này, nhập kết quả rồi chọn tệp để xem trước.</p>
      <p class="small text-secondary mb-0">Mẫu đã có thông tin buổi và danh sách học sinh. Ô để trống giữ nguyên dữ liệu hiện có. Tải lên chưa lưu dữ liệu.</p>
    </div>

    <div class="d-flex flex-wrap align-items-center gap-2 my-3">
      <button class="btn btn-outline-primary" type="button" :disabled="busy || !rows.length" data-modal-autofocus @click="downloadTemplate">
        {{ busy ? 'Đang xử lý…' : 'Tải mẫu Excel của buổi này' }}
      </button>
      <span v-if="rows.length" class="small text-secondary">{{ rows.length }} học sinh trong mẫu</span>
    </div>

    <div v-if="!rows.length" class="alert alert-warning" role="status">Buổi học chưa có học sinh trong roster nên chưa thể tạo biểu mẫu.</div>

    <div class="mb-3">
      <label class="form-label fw-semibold" :for="fileInputId">Tệp Excel đã điền</label>
      <input :id="fileInputId" ref="fileInput" class="form-control" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="busy || !rows.length" aria-describedby="session-attendance-excel-help" @change="readFile" />
      <div id="session-attendance-excel-help" class="form-text">Chỉ nhận .xlsx được tải từ đúng buổi học. Giữ nguyên trang tính, tiêu đề cột và danh sách roster trong mẫu.</div>
    </div>

    <div v-if="fileName && !busy" class="small text-secondary mb-2">Tệp: <strong>{{ fileName }}</strong></div>
    <div v-if="busy" class="d-flex align-items-center gap-2 py-2 text-secondary" role="status" aria-live="polite">
      <span class="app-state__spinner" aria-hidden="true"></span>Đang đọc biểu mẫu…
    </div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

    <section v-if="issues.length" class="alert alert-danger" aria-labelledby="session-attendance-excel-errors">
      <h3 id="session-attendance-excel-errors" class="h6">Tệp có {{ issues.length }} vấn đề cần sửa</h3>
      <ul class="mb-0 ps-3">
        <li v-for="(issue, index) in issues" :key="`${issue.row_number}-${index}`">
          {{ issue.row_number ? `Dòng ${issue.row_number}: ` : '' }}{{ issue.message }}
        </li>
      </ul>
    </section>

    <section v-if="patches.length && !issues.length" class="excel-import-preview" aria-live="polite">
      <div class="excel-import-summary">
        <div><strong>{{ patches.length }}</strong><span>học sinh có dữ liệu trong tệp</span></div>
        <div><strong>{{ enteredFieldCount }}</strong><span>trường sẽ được áp dụng</span></div>
        <div><strong>{{ parsedRosterCount }}</strong><span>học sinh trong roster của buổi</span></div>
      </div>
      <p class="small text-secondary mt-3 mb-2">Dữ liệu sẽ được nạp vào biểu mẫu để bạn rà lại, chỉnh sửa và xác nhận lưu.</p>
      <div class="table-responsive excel-import-preview__table-wrap">
        <table class="table table-sm align-middle mb-0">
          <caption class="visually-hidden">Học sinh có dữ liệu trong tệp điểm danh Excel</caption>
          <thead><tr><th scope="col">Học sinh</th><th scope="col">Trường được nhập</th><th scope="col">Trạng thái</th></tr></thead>
          <tbody>
            <tr v-for="item in patches" :key="item.student_id">
              <td>{{ rows.find((row) => row.student_id === item.student_id)?.students?.full_name || 'Học sinh' }} <small class="text-secondary">{{ rows.find((row) => row.student_id === item.student_id)?.students?.student_code }}</small></td>
              <td>{{ Object.keys(item.patch).length }}</td>
              <td>{{ previewStatus(item.patch.status) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <template #footer>
      <button class="btn btn-outline-secondary" type="button" :disabled="busy" @click="emit('update:modelValue', false)">Đóng</button>
      <button class="btn btn-primary" type="button" :disabled="!canApply" @click="apply">Nạp vào biểu mẫu</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.excel-import-intro { border-left: 3px solid var(--bs-primary); padding-left: 0.8rem; }
.excel-import-preview__table-wrap { max-height: 16rem; overflow: auto; border: 1px solid var(--bs-border-color); border-radius: 0.5rem; }
.excel-import-preview__table-wrap thead th { position: sticky; top: 0; z-index: 1; background: var(--bs-tertiary-bg); }
.excel-import-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.65rem; }
.excel-import-summary > div { display: flex; min-height: 4rem; flex-direction: column; justify-content: center; border: 1px solid var(--bs-border-color); border-radius: 0.5rem; padding: 0.65rem 0.75rem; background: var(--bs-tertiary-bg); }
.excel-import-summary strong { font-size: 1.1rem; }
.excel-import-summary span { color: var(--bs-secondary-color); font-size: 0.75rem; }
</style>
