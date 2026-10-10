<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { adminEnrollStudents, type AdminStudentIntakeResult } from '@/services/commands'
import { getStudentIntakeDuplicateIdentities } from '@/services/data-queries'
import FormModal from '@/app/components/FormModal.vue'
import {
  classifyStudentIntakeRows,
  downloadStudentIntakeTemplate,
  MAX_STUDENT_INTAKE_ROWS,
  parseStudentIntakeWorkbook,
  type ExistingStudentIdentity,
  type StudentIntakePreviewRow,
} from '@/modules/admin/utils/student-intake'

interface ClassOption { id: string; code: string; name: string; status: string }

const props = defineProps<{
  modelValue: boolean
  classes: ClassOption[]
  initialClassId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: []
}>()

const selectedClassId = ref('')
const existingStudents = ref<ExistingStudentIdentity[]>([])
const existingStudentsLoaded = ref(false)
const loadingExistingStudents = ref(false)
const parsing = ref(false)
const submitting = ref(false)
const downloading = ref(false)
const errorMessage = ref('')
const fileName = ref('')
const previewRows = ref<StudentIntakePreviewRow[]>([])
const results = ref<AdminStudentIntakeResult[] | null>(null)
const startDate = ref('')

const activeClasses = computed(() => props.classes.filter((row) => row.status === 'ACTIVE'))
const readyRows = computed(() => previewRows.value.filter((row) => row.status === 'READY' || (row.status === 'REVIEW_NAME' && row.keep_same_name)))
const duplicateCount = computed(() => previewRows.value.filter((row) => row.status === 'DUPLICATE').length)
const reviewCount = computed(() => previewRows.value.filter((row) => row.status === 'REVIEW_NAME' && !row.keep_same_name).length)
const invalidCount = computed(() => previewRows.value.filter((row) => row.status === 'INVALID').length)
const createdResults = computed(() => (results.value || []).filter((row) => row.status === 'CREATED'))
const skippedResults = computed(() => (results.value || []).filter((row) => row.status === 'SKIPPED').length + previewRows.value.filter((row) => row.status === 'DUPLICATE' || (row.status === 'REVIEW_NAME' && !row.keep_same_name)).length)
const failedResults = computed(() => (results.value || []).filter((row) => row.status === 'FAILED'))
const retryableResults = computed(() => failedResults.value.filter((row) => row.reason_code !== 'ACCOUNT_ROLLBACK_FAILED'))
const displayResults = computed(() => {
  const apiResults = new Map((results.value || []).map((row) => [row.row_number, row]))
  return previewRows.value.map((preview) => {
    const result = apiResults.get(preview.row_number)
    if (result) return { row_number: preview.row_number, full_name: preview.full_name, message: resultMessage(result), result }
    if (preview.status === 'DUPLICATE') return { row_number: preview.row_number, full_name: preview.full_name, message: preview.message, result: null }
    if (preview.status === 'REVIEW_NAME' && !preview.keep_same_name) return { row_number: preview.row_number, full_name: preview.full_name, message: 'Admin đã chọn bỏ qua dòng trùng tên.', result: null }
    if (preview.status === 'INVALID') return { row_number: preview.row_number, full_name: preview.full_name, message: preview.message, result: null }
    return { row_number: preview.row_number, full_name: preview.full_name, message: 'Chưa có kết quả từ máy chủ.', result: null }
  })
})
const failedCount = computed(() => failedResults.value.length + invalidCount.value)

function todayInVietnam(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

function clearWorkflow() {
  existingStudents.value = []
  existingStudentsLoaded.value = false
  loadingExistingStudents.value = false
  parsing.value = false
  submitting.value = false
  downloading.value = false
  errorMessage.value = ''
  fileName.value = ''
  previewRows.value = []
  results.value = null
  startDate.value = ''
}

async function loadExistingStudents() {
  if (loadingExistingStudents.value || existingStudentsLoaded.value) return
  loadingExistingStudents.value = true
  errorMessage.value = ''
  try {
    const rows = await getStudentIntakeDuplicateIdentities() as ExistingStudentIdentity[]
    existingStudents.value = rows
    existingStudentsLoaded.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể kiểm tra danh sách học sinh hiện có.'
  } finally {
    loadingExistingStudents.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    clearWorkflow()
    startDate.value = todayInVietnam()
    selectedClassId.value = activeClasses.value.some((row) => row.id === props.initialClassId) ? props.initialClassId || '' : ''
    void loadExistingStudents()
  } else {
    clearWorkflow()
    selectedClassId.value = ''
  }
})

async function downloadTemplate() {
  if (downloading.value) return
  downloading.value = true
  errorMessage.value = ''
  try {
    await downloadStudentIntakeTemplate()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải mẫu nhập học.'
  } finally {
    downloading.value = false
  }
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  fileName.value = file.name
  previewRows.value = []
  results.value = null
  errorMessage.value = ''
  parsing.value = true
  try {
    await loadExistingStudents()
    if (!existingStudentsLoaded.value) throw new Error(errorMessage.value || 'Không thể kiểm tra học sinh hiện có.')
    const parsed = await parseStudentIntakeWorkbook(file)
    previewRows.value = classifyStudentIntakeRows(parsed, existingStudents.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể đọc biểu mẫu nhập học.'
  } finally {
    parsing.value = false
  }
}

function setKeepSameName(rowNumber: number, keep: boolean) {
  previewRows.value = previewRows.value.map((row) => row.row_number === rowNumber ? { ...row, keep_same_name: keep } : row)
}

function apiFailureMessage(code: string): string {
  const messages: Record<string, string> = {
    INVALID_INPUT: 'Dữ liệu dòng không hợp lệ.',
    USERNAME_ALREADY_EXISTS: 'Không tạo được tên đăng nhập.',
    EMAIL_ALREADY_EXISTS: 'Email tài khoản đã được sử dụng.',
    PHONE_ALREADY_EXISTS: 'Số điện thoại đang được gắn với tài khoản khác.',
    ACCOUNT_ROLLBACK_FAILED: 'Lỗi khi tạo tài khoản và hệ thống không thể hoàn tác đầy đủ; cần kiểm tra trước khi thử lại.',
    STUDENT_CREATE_FAILED: 'Không tạo được tài khoản hoặc xếp lớp.',
  }
  return messages[code] || 'Không tạo được dòng này.'
}

async function submitRows(rows: StudentIntakePreviewRow[], replacingRowNumbers = new Set<number>()) {
  const response = await adminEnrollStudents({
    class_id: selectedClassId.value,
    start_date: startDate.value,
    students: rows.map((row) => ({
      row_number: row.row_number,
      full_name: row.full_name,
      student_code: row.student_code || undefined,
      phone: row.phone || undefined,
      parent_name: row.parent_name || undefined,
      parent_phone: row.parent_phone || undefined,
    })),
  })
  const retained = (results.value || []).filter((row) => !replacingRowNumbers.has(row.row_number))
  const merged = new Map(retained.map((row) => [row.row_number, row]))
  response.results.forEach((row) => merged.set(row.row_number, row))
  results.value = [...merged.values()].sort((left, right) => left.row_number - right.row_number)
  if (response.results.some((row) => row.status === 'CREATED')) emit('created')
}

async function confirmImport() {
  if (submitting.value || !selectedClassId.value || readyRows.value.length === 0) return
  submitting.value = true
  startDate.value = todayInVietnam()
  errorMessage.value = ''
  try {
    await submitRows(readyRows.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể nhập học sinh.'
  } finally {
    submitting.value = false
  }
}

async function retryFailedRows() {
  if (submitting.value || !retryableResults.value.length) return
  const failedNumbers = new Set(retryableResults.value.map((row) => row.row_number))
  const failedRows = previewRows.value.filter((row) => failedNumbers.has(row.row_number))
  if (!failedRows.length) return
  submitting.value = true
  startDate.value = todayInVietnam()
  errorMessage.value = ''
  try {
    await submitRows(failedRows, failedNumbers)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể thử lại các dòng lỗi.'
  } finally {
    submitting.value = false
  }
}

function resultMessage(row: AdminStudentIntakeResult): string {
  if (row.status === 'CREATED') return 'Đã tạo tài khoản và xếp lớp.'
  if (row.status === 'SKIPPED') return row.reason_code === 'STUDENT_CODE_ALREADY_EXISTS' ? 'Mã học sinh đã có; đã bỏ qua.' : 'Số điện thoại học sinh đã có; đã bỏ qua.'
  return apiFailureMessage(row.reason_code)
}
</script>

<template>
  <FormModal
    :model-value="modelValue"
    title="Nhập học nhanh"
    description="Tải mẫu, điền thông tin học sinh, xem lại các dòng rồi xác nhận tạo tài khoản và xếp lớp."
    size="xl"
    :busy="submitting"
    :submit-disabled="!!results || parsing || loadingExistingStudents || !selectedClassId || readyRows.length === 0"
    :submit-label="`Xác nhận nhập ${readyRows.length} học sinh`"
    submitting-label="Đang tạo tài khoản…"
    data-testid="student-quick-enrollment-modal"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="confirmImport"
    @cancel="emit('update:modelValue', false)"
  >
    <div v-if="!results">
      <div class="row g-3 mb-3">
        <div class="col-md-7">
          <label class="form-label" for="intake-class">Lớp nhập học <span class="text-danger">*</span></label>
          <select id="intake-class" v-model="selectedClassId" class="form-select" :disabled="submitting || !activeClasses.length" data-testid="intake-class">
            <option value="">Chọn lớp đang hoạt động</option>
            <option v-for="classRow in activeClasses" :key="classRow.id" :value="classRow.id">{{ classRow.code }} — {{ classRow.name }}</option>
          </select>
          <small class="text-secondary">Membership bắt đầu từ {{ startDate }}.</small>
        </div>
        <div class="col-md-5 d-flex align-items-end">
          <button class="btn btn-outline-primary" type="button" :disabled="downloading" @click="downloadTemplate">
            {{ downloading ? 'Đang tạo mẫu…' : 'Tải biểu mẫu XLSX' }}
          </button>
        </div>
      </div>

      <label class="form-label" for="student-intake-file">Biểu mẫu đã điền (.xlsx)</label>
      <input id="student-intake-file" class="form-control" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="submitting || parsing || loadingExistingStudents" data-testid="student-intake-file" @change="onFileSelected" />
      <div v-if="loadingExistingStudents || parsing" class="small text-secondary mt-2" role="status">
        {{ loadingExistingStudents ? 'Đang tải hồ sơ để đối chiếu…' : 'Đang đọc biểu mẫu…' }}
      </div>
      <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }} <button v-if="!existingStudentsLoaded" class="btn btn-sm btn-outline-danger ms-2" type="button" @click="loadExistingStudents">Thử lại</button></div>

      <template v-if="previewRows.length">
        <div class="d-flex flex-wrap gap-2 my-3" aria-label="Tổng hợp kết quả đối chiếu">
          <span class="badge text-bg-success">{{ readyRows.length }} sẽ nhập</span>
          <span class="badge text-bg-secondary">{{ duplicateCount }} trùng, bỏ qua</span>
          <span class="badge text-bg-warning">{{ reviewCount }} cần rà soát tên</span>
          <span class="badge text-bg-danger">{{ invalidCount }} dòng lỗi</span>
          <span class="small text-secondary align-self-center">{{ fileName }} · {{ previewRows.length }}/{{ MAX_STUDENT_INTAKE_ROWS }} dòng</span>
        </div>
        <div class="table-responsive student-intake-preview">
          <table class="table table-sm align-middle">
            <thead><tr><th>Dòng</th><th>Họ tên</th><th>Mã</th><th>SĐT</th><th>Đối chiếu</th><th>Quyết định</th></tr></thead>
            <tbody>
              <tr v-for="row in previewRows" :key="row.row_number">
                <td>{{ row.row_number }}</td>
                <td class="fw-semibold">{{ row.full_name || '—' }}</td>
                <td>{{ row.student_code || 'Tự tạo' }}</td>
                <td>{{ row.phone || '—' }}</td>
                <td>{{ row.message }}</td>
                <td v-if="row.status === 'REVIEW_NAME'">
                  <label class="form-check-label"><input class="form-check-input me-1" type="checkbox" :checked="row.keep_same_name" :disabled="submitting" @change="setKeepSameName(row.row_number, ($event.target as HTMLInputElement).checked)" />Nhập, là người khác</label>
                </td>
                <td v-else-if="row.status === 'READY'" class="text-success">Sẵn sàng</td>
                <td v-else-if="row.status === 'DUPLICATE'" class="text-secondary">Bỏ qua</td>
                <td v-else class="text-danger">Sửa file rồi tải lại</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <div v-else>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
      <div class="alert alert-info" role="status">
        Đã tạo {{ createdResults.length }} · Bỏ qua {{ skippedResults }} · Lỗi {{ failedCount }}.
        Mật khẩu tạm chỉ hiển thị trong cửa sổ này; hãy bàn giao qua kênh bảo mật.
      </div>
      <div class="table-responsive student-intake-results">
        <table class="table table-sm align-middle">
          <thead><tr><th>Dòng</th><th>Họ tên</th><th>Kết quả</th><th>Mã học sinh</th><th>Tên đăng nhập</th><th>Mật khẩu tạm</th></tr></thead>
          <tbody>
            <tr v-for="row in displayResults" :key="row.row_number">
              <td>{{ row.row_number }}</td>
              <td>{{ row.full_name || '—' }}</td>
              <td :class="row.result?.status === 'CREATED' ? 'text-success' : row.result?.status === 'FAILED' ? 'text-danger' : 'text-secondary'">{{ row.message }}</td>
              <td>{{ row.result?.status === 'CREATED' ? row.result.student_code : '—' }}</td>
              <td>{{ row.result?.status === 'CREATED' ? row.result.username : '—' }}</td>
              <td><code v-if="row.result?.status === 'CREATED'">{{ row.result.temporary_password }}</code><span v-else>—</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <button v-if="results" class="btn btn-outline-secondary" type="button" :disabled="submitting" @click="emit('update:modelValue', false)">Đóng</button>
      <template v-else>
        <button class="btn btn-outline-secondary" type="button" :disabled="submitting" @click="emit('update:modelValue', false)">Hủy</button>
        <button class="btn btn-primary" type="button" :disabled="submitting || parsing || loadingExistingStudents || !selectedClassId || readyRows.length === 0" :aria-busy="submitting || undefined" @click="confirmImport">
          <span v-if="submitting" class="app-button__spinner" aria-hidden="true"></span>{{ submitting ? 'Đang tạo tài khoản…' : `Xác nhận nhập ${readyRows.length} học sinh` }}
        </button>
      </template>
      <button v-if="results && retryableResults.length" class="btn btn-outline-primary" type="button" :disabled="submitting" @click="retryFailedRows">Thử lại {{ retryableResults.length }} dòng lỗi</button>
    </template>
  </FormModal>
</template>

<style scoped>
.student-intake-preview,
.student-intake-results {
  max-height: 46vh;
  overflow: auto;
}

.student-intake-preview td,
.student-intake-preview th,
.student-intake-results td,
.student-intake-results th {
  min-width: 7rem;
}
</style>
