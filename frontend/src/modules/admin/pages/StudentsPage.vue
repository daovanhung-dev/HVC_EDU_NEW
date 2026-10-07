<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { adminCreateUser, adminResetPassword, adminResetPasswordBulk, archiveStudent, setAccountStatus, updateStudent } from '@/services/commands'
import { getStudents } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppField from '@/app/components/AppField.vue'
import AppState from '@/app/components/AppState.vue'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'
import DetailModal from '@/app/components/DetailModal.vue'
import BulkPasswordResetModal from '@/modules/admin/components/BulkPasswordResetModal.vue'
import type { BulkResetDisplayResult, BulkResetPerson } from '@/modules/admin/components/bulk-password-reset.types'

interface Student { id: string; user_id: string; student_code: string; full_name: string; phone: string | null; parent_name: string | null; parent_phone?: string | null; status: string; created_at: string }
interface StudentForm { student_code: string; full_name: string; phone: string; parent_name: string; parent_phone: string }
const toast = useToastStore()
const MAX_BULK_RESET_TARGETS = 100
const rows = ref<Student[]>([])
const search = ref('')
const selectedUserIds = ref<string[]>([])
const bulkDialogOpen = ref(false)
const bulkDialogMode = ref<'confirm' | 'result'>('confirm')
const bulkBusy = ref(false)
const bulkErrorMessage = ref('')
const bulkPeople = ref<BulkResetPerson[]>([])
const bulkResults = ref<BulkResetDisplayResult[]>([])
const bulkTemporaryPassword = ref('')
const loading = ref(false)
const showForm = ref(false)
const editing = ref<Student | null>(null)
const formBusy = ref(false)
const formDirty = ref(false)
const errorMessage = ref('')
const temporaryPassword = ref('')
const showPassword = ref(false)
const passwordDialogAfterClose = ref<'form' | 'confirm' | null>(null)
const form = ref({ full_name: '', student_code: '', username: '', password: '', phone: '', parent_name: '', parent_phone: '' })
const editForm = ref<StudentForm>({ student_code: '', full_name: '', phone: '', parent_name: '', parent_phone: '' })
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmDetails = ref({ title: '', message: '', itemName: '', warning: '', confirmLabel: 'Xác nhận', destructive: false })
const pendingAction = ref<(() => Promise<void>) | null>(null)
const modalTitle = computed(() => editing.value ? 'Sửa hồ sơ học sinh' : 'Tạo hồ sơ và tài khoản học sinh')
const activeRows = computed(() => rows.value.filter((row) => row.status === 'ACTIVE'))
const allActiveSelected = computed(() => activeRows.value.length > 0 && activeRows.value.length <= MAX_BULK_RESET_TARGETS && activeRows.value.every((row) => selectedUserIds.value.includes(row.user_id)))
const tooManyActiveRows = computed(() => activeRows.value.length > MAX_BULK_RESET_TARGETS)

async function load() {
  selectedUserIds.value = []
  loading.value = true
  errorMessage.value = ''
  try { rows.value = await getStudents(search.value) as Student[] }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải học sinh' }
  finally { loading.value = false }
}

watch(search, () => { selectedUserIds.value = [] })

function toggleAllActive(checked: boolean) {
  selectedUserIds.value = checked && !tooManyActiveRows.value
    ? activeRows.value.map((row) => row.user_id)
    : []
}

function toggleSelectedUser(userId: string, checked: boolean) {
  if (checked) {
    if (selectedUserIds.value.length >= MAX_BULK_RESET_TARGETS) return
    if (!selectedUserIds.value.includes(userId)) selectedUserIds.value = [...selectedUserIds.value, userId]
    return
  }
  selectedUserIds.value = selectedUserIds.value.filter((id) => id !== userId)
}

function beginBulkReset() {
  const selected = activeRows.value.filter((row) => selectedUserIds.value.includes(row.user_id))
  if (!selected.length || selected.length > MAX_BULK_RESET_TARGETS) return
  bulkPeople.value = selected.map((row) => ({ user_id: row.user_id, full_name: row.full_name, code: row.student_code }))
  bulkResults.value = []
  bulkTemporaryPassword.value = ''
  bulkErrorMessage.value = ''
  bulkDialogMode.value = 'confirm'
  bulkDialogOpen.value = true
}

async function confirmBulkReset() {
  if (bulkBusy.value || !bulkPeople.value.length) return
  bulkBusy.value = true
  bulkErrorMessage.value = ''
  try {
    const response = await adminResetPasswordBulk(bulkPeople.value.map((person) => person.user_id))
    const peopleById = new Map(bulkPeople.value.map((person) => [person.user_id.toLowerCase(), person]))
    bulkResults.value = response.results.map((result) => ({
      ...peopleById.get(result.user_id.toLowerCase()) || { user_id: result.user_id, full_name: 'Tài khoản không xác định', code: null },
      ...result,
    }))
    bulkTemporaryPassword.value = response.temporary_password || ''
    selectedUserIds.value = []
    bulkDialogMode.value = 'result'
    toast.success(`Đã xử lý ${response.results.length} tài khoản.`)
  } catch (error) {
    bulkErrorMessage.value = error instanceof Error ? error.message : 'Không thể đặt lại mật khẩu hàng loạt.'
  } finally {
    bulkBusy.value = false
  }
}

function openCreate() {
  editing.value = null
  formDirty.value = false
  form.value = { full_name: '', student_code: '', username: '', password: '', phone: '', parent_name: '', parent_phone: '' }
  errorMessage.value = ''
  showForm.value = true
}

function beginEdit(row: Student) {
  editing.value = row
  formDirty.value = false
  editForm.value = { student_code: row.student_code, full_name: row.full_name, phone: row.phone || '', parent_name: row.parent_name || '', parent_phone: row.parent_phone || '' }
  errorMessage.value = ''
  showForm.value = true
}

async function saveForm() {
  if (formBusy.value) return
  formBusy.value = true
  errorMessage.value = ''
  let newTemporaryPassword = ''
  try {
    if (editing.value) {
      const row = editing.value
      await updateStudent(row.id, { student_code: editForm.value.student_code, full_name: editForm.value.full_name, phone: editForm.value.phone || null, parent_name: editForm.value.parent_name || null, parent_phone: editForm.value.parent_phone || null })
      toast.success('Đã cập nhật hồ sơ học sinh.')
    } else {
      const suppliedPassword = form.value.password
      form.value.password = ''
      const result = await adminCreateUser({ role: 'STUDENT', username: form.value.username, password: suppliedPassword || undefined, phone: form.value.phone || undefined, display_name: form.value.full_name, student: { student_code: form.value.student_code || undefined, full_name: form.value.full_name, parent_name: form.value.parent_name, parent_phone: form.value.parent_phone } })
      if (!suppliedPassword) newTemporaryPassword = result.temporary_password
    }
    formDirty.value = false
    form.value = { full_name: '', student_code: '', username: '', password: '', phone: '', parent_name: '', parent_phone: '' }
    if (newTemporaryPassword) {
      temporaryPassword.value = newTemporaryPassword
      passwordDialogAfterClose.value = 'form'
    }
    formBusy.value = false
    showForm.value = false
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : editing.value ? 'Không thể cập nhật học sinh' : 'Không thể tạo học sinh' }
  finally { formBusy.value = false }
}

function onFormHidden() {
  if (passwordDialogAfterClose.value !== 'form') return
  passwordDialogAfterClose.value = null
  showPassword.value = true
}

function askFor(row: Student, action: 'archive' | 'toggle' | 'reset') {
  if (action === 'archive') {
    confirmDetails.value = { title: 'Lưu trữ học sinh?', message: 'Hồ sơ sẽ không còn nằm trong danh sách đang hoạt động. Lịch sử học tập vẫn được giữ nguyên.', itemName: `${row.full_name} · ${row.student_code}`, warning: 'Thao tác này không xóa dữ liệu học tập.', confirmLabel: 'Lưu trữ học sinh', destructive: true }
    pendingAction.value = async () => { await archiveStudent(row.id); toast.success(`Đã lưu trữ ${row.full_name}.`); await load() }
  } else if (action === 'toggle') {
    const locking = row.status === 'ACTIVE'
    confirmDetails.value = { title: locking ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?', message: locking ? 'Người dùng sẽ không thể đăng nhập cho đến khi tài khoản được mở lại.' : 'Người dùng sẽ có thể đăng nhập lại.', itemName: `${row.full_name} · ${row.student_code}`, warning: '', confirmLabel: locking ? 'Khóa tài khoản' : 'Mở khóa', destructive: locking }
    pendingAction.value = async () => { await setAccountStatus(row.user_id, locking ? 'LOCKED' : 'ACTIVE'); toast.success(locking ? 'Đã khóa tài khoản học sinh.' : 'Đã mở khóa tài khoản học sinh.'); await load() }
  } else {
    confirmDetails.value = { title: 'Đặt lại mật khẩu?', message: 'Mật khẩu sẽ được đặt lại thành 12345678. Học sinh cần đổi mật khẩu này trước khi sử dụng cổng học tập.', itemName: `${row.full_name} · ${row.student_code}`, warning: 'Mật khẩu chỉ hiển thị một lần sau khi đặt lại thành công. Hãy bàn giao qua kênh bảo mật.', confirmLabel: 'Đặt lại mật khẩu', destructive: false }
    temporaryPassword.value = ''
    pendingAction.value = async () => { const result = await adminResetPassword(row.user_id); temporaryPassword.value = result.temporary_password }
  }
  confirmOpen.value = true
}

async function confirmAction() {
  if (!pendingAction.value || confirmBusy.value) return
  confirmBusy.value = true
  errorMessage.value = ''
  try {
    await pendingAction.value()
    if (temporaryPassword.value) passwordDialogAfterClose.value = 'confirm'
    confirmBusy.value = false
    confirmOpen.value = false
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể hoàn tất thao tác'
    toast.error(errorMessage.value)
  }
  finally { confirmBusy.value = false }
}

function onConfirmHidden() {
  if (passwordDialogAfterClose.value !== 'confirm') return
  passwordDialogAfterClose.value = null
  showPassword.value = true
}

function closePassword() { showPassword.value = false; temporaryPassword.value = '' }
onMounted(load)
</script>

<template>
  <AppPageHeader title="Học sinh" eyebrow="Hồ sơ và tài khoản" description="Theo dõi hồ sơ, thông tin phụ huynh và trạng thái tài khoản.">
    <template #actions><button class="btn btn-primary" type="button" @click="openCreate">Thêm học sinh</button></template>
  </AppPageHeader>
  <div v-if="errorMessage && rows.length" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
  <section class="card"><div class="card-body">
    <form class="app-list-search d-flex flex-wrap gap-2 mb-3" role="search" @submit.prevent="load"><label class="visually-hidden" for="student-search">Tìm học sinh</label><input id="student-search" v-model="search" class="form-control flex-grow-1" placeholder="Tìm theo tên hoặc mã học sinh" /><button class="btn btn-outline-primary" type="submit" :disabled="loading">Tìm</button></form>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
      <p class="mb-0 small text-secondary">{{ activeRows.length }} tài khoản đang hoạt động · {{ selectedUserIds.length }}/{{ MAX_BULK_RESET_TARGETS }} đã chọn</p>
      <button class="btn btn-outline-primary" type="button" data-testid="bulk-reset-students" :disabled="!selectedUserIds.length || loading" @click="beginBulkReset">Đặt lại mật khẩu đã chọn</button>
    </div>
    <p v-if="tooManyActiveRows" class="small text-secondary mb-2">Có hơn {{ MAX_BULK_RESET_TARGETS }} học sinh đang hoạt động trong kết quả. Hãy lọc thêm trước khi chọn tất cả.</p>
    <AppState v-if="loading" kind="loading" title="Đang tải danh sách học sinh" message="Thông tin sẽ xuất hiện tại đây sau khi tải xong." />
    <AppState v-else-if="errorMessage && !rows.length" kind="error" title="Không thể tải danh sách học sinh" :message="errorMessage" @retry="load" />
    <AppState v-else-if="!rows.length" kind="empty" title="Chưa có học sinh phù hợp" message="Thêm hồ sơ mới hoặc điều chỉnh từ khóa tìm kiếm." />
    <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th><input type="checkbox" class="form-check-input" data-testid="select-all-active-students" aria-label="Chọn tất cả học sinh đang hoạt động trong kết quả lọc" :checked="allActiveSelected" :disabled="loading || !activeRows.length || tooManyActiveRows" @change="toggleAllActive(($event.target as HTMLInputElement).checked)" /></th><th>Mã</th><th>Họ tên</th><th>SĐT</th><th>Phụ huynh</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
      <tr v-for="row in rows" :key="row.id"><td><input type="checkbox" class="form-check-input" data-testid="select-student-row" :aria-label="`Chọn ${row.full_name}`" :checked="selectedUserIds.includes(row.user_id)" :disabled="loading || row.status !== 'ACTIVE' || (selectedUserIds.length >= MAX_BULK_RESET_TARGETS && !selectedUserIds.includes(row.user_id))" @change="toggleSelectedUser(row.user_id, ($event.target as HTMLInputElement).checked)" /></td><td><code>{{ row.student_code }}</code></td><td class="fw-semibold">{{ row.full_name }}</td><td>{{ row.phone || '—' }}</td><td>{{ row.parent_name || '—' }}</td><td><span class="badge" :class="row.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status === 'ACTIVE' ? 'Đang hoạt động' : row.status === 'LOCKED' ? 'Đã khóa' : row.status }}</span></td><td>{{ formatDateTime(row.created_at) }}</td><td><div class="d-flex flex-wrap gap-1"><RouterLink class="btn btn-sm btn-outline-primary" :to="`/admin/students/${row.id}`">Chi tiết</RouterLink><button class="btn btn-sm btn-outline-secondary" type="button" @click="beginEdit(row)">Sửa</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-danger" type="button" @click="askFor(row, 'archive')">Lưu trữ</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-secondary" type="button" @click="askFor(row, 'toggle')">{{ row.status === 'ACTIVE' ? 'Khóa TK' : 'Mở TK' }}</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-primary" type="button" @click="askFor(row, 'reset')">Đặt lại mật khẩu</button></div></td></tr>
    </tbody></table></div>
  </div></section>

  <FormModal v-model="showForm" :title="modalTitle" :description="editing ? 'Cập nhật thông tin hồ sơ hiện có.' : 'Có thể đặt mật khẩu ban đầu; để trống để hệ thống tạo mật khẩu tạm.'" :busy="formBusy" :dirty="formDirty" :submit-disabled="editing ? !editForm.full_name : !form.full_name" :submit-label="editing ? 'Lưu thay đổi' : 'Tạo tài khoản'" @submit="saveForm" @cancel="showForm = false" @hidden="onFormHidden">
    <div class="row g-3" @input="formDirty = true" @change="formDirty = true">
      <template v-if="editing"><AppField id="student-name-edit" class="col-md-7" label="Họ tên" required><template #default="field"><input :id="field.id" v-model="editForm.full_name" class="form-control" required :aria-describedby="field.describedBy" /></template></AppField><AppField id="student-code-edit" class="col-md-5" label="Mã học sinh"><template #default="field"><input :id="field.id" v-model="editForm.student_code" class="form-control" /></template></AppField><AppField id="student-phone-edit" class="col-md-6" label="Số điện thoại"><template #default="field"><input :id="field.id" v-model="editForm.phone" class="form-control" inputmode="tel" /></template></AppField><AppField id="parent-name-edit" class="col-md-6" label="Tên phụ huynh"><template #default="field"><input :id="field.id" v-model="editForm.parent_name" class="form-control" /></template></AppField><AppField id="parent-phone-edit" class="col-12" label="Số điện thoại phụ huynh"><template #default="field"><input :id="field.id" v-model="editForm.parent_phone" class="form-control" inputmode="tel" /></template></AppField></template>
      <template v-else><AppField id="student-name" class="col-md-7" label="Họ tên" required><template #default="field"><input :id="field.id" v-model="form.full_name" class="form-control" required data-modal-autofocus /></template></AppField><AppField id="student-code" class="col-md-5" label="Mã học sinh" description="Để trống để hệ thống tự tạo."><template #default="field"><input :id="field.id" v-model="form.student_code" class="form-control" :aria-describedby="field.describedBy" /></template></AppField><AppField id="student-username" class="col-md-6" label="Tên đăng nhập" description="Có thể để trống để hệ thống tự tạo."><template #default="field"><input :id="field.id" v-model="form.username" class="form-control" autocomplete="off" :aria-describedby="field.describedBy" /></template></AppField><AppField id="student-password" class="col-md-6" label="Mật khẩu ban đầu" description="Để trống để hệ thống tạo mật khẩu tạm."><template #default="field"><input :id="field.id" v-model="form.password" class="form-control" type="password" autocomplete="new-password" :aria-describedby="field.describedBy" /></template></AppField><AppField id="student-phone" class="col-md-6" label="Số điện thoại"><template #default="field"><input :id="field.id" v-model="form.phone" class="form-control" inputmode="tel" /></template></AppField><AppField id="parent-name" class="col-md-6" label="Tên phụ huynh"><template #default="field"><input :id="field.id" v-model="form.parent_name" class="form-control" /></template></AppField><AppField id="parent-phone" class="col-md-6" label="Số điện thoại phụ huynh"><template #default="field"><input :id="field.id" v-model="form.parent_phone" class="form-control" inputmode="tel" /></template></AppField></template>
    </div>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
  </FormModal>
  <ConfirmModal v-model="confirmOpen" v-bind="confirmDetails" :busy="confirmBusy" @confirm="confirmAction" @hidden="onConfirmHidden" />
  <BulkPasswordResetModal v-model="bulkDialogOpen" :mode="bulkDialogMode" :people="bulkPeople" :results="bulkResults" :temporary-password="bulkTemporaryPassword" :busy="bulkBusy" :error-message="bulkErrorMessage" @confirm="confirmBulkReset" />
  <DetailModal v-model="showPassword" title="Mật khẩu tạm thời" description="Mật khẩu là 12345678. Học sinh sẽ cần đổi mật khẩu ở lần đăng nhập kế tiếp. Mật khẩu chỉ hiển thị trong phiên này; hãy bàn giao qua kênh bảo mật." size="sm">
    <label class="form-label" for="temporary-password">Mật khẩu tạm</label><input id="temporary-password" class="form-control fw-semibold" :value="temporaryPassword" readonly data-modal-autofocus @focus="($event.target as HTMLInputElement).select()" />
    <template #footer><button class="btn btn-primary" type="button" @click="closePassword">Đã ghi lại</button></template>
  </DetailModal>
</template>
