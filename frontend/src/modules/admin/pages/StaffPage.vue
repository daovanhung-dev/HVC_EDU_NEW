<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { adminCreateUser, adminResetPassword, adminResetPasswordBulk, archiveStaff, setAccountStatus, updateStaff } from '@/services/commands'
import { getStaff } from '@/services/data-queries'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppField from '@/app/components/AppField.vue'
import AppState from '@/app/components/AppState.vue'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'
import DetailModal from '@/app/components/DetailModal.vue'
import BulkPasswordResetModal from '@/modules/admin/components/BulkPasswordResetModal.vue'
import type { BulkResetDisplayResult, BulkResetPerson } from '@/modules/admin/components/bulk-password-reset.types'

interface Staff { id: string; user_id: string; staff_code: string | null; full_name: string; staff_type: string; phone: string | null; status: string }
interface StaffForm { staff_code: string; full_name: string; phone: string }
const toast = useToastStore()
const MAX_BULK_RESET_TARGETS = 100
const rows = ref<Staff[]>([])
const search = ref('')
const selectedUserIds = ref<string[]>([])
const bulkDialogOpen = ref(false)
const bulkDialogMode = ref<'confirm' | 'result'>('confirm')
const bulkBusy = ref(false)
const bulkErrorMessage = ref('')
const bulkPeople = ref<BulkResetPerson[]>([])
const bulkResults = ref<BulkResetDisplayResult[]>([])
const bulkTemporaryPassword = ref('')
const showForm = ref(false)
const editing = ref<Staff | null>(null)
const formBusy = ref(false)
const formDirty = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const temporaryPassword = ref('')
const showPassword = ref(false)
const passwordDialogAfterClose = ref<'form' | 'confirm' | null>(null)
const form = ref({ full_name: '', staff_code: '', username: '', email: '', password: '', phone: '' })
const editForm = ref<StaffForm>({ staff_code: '', full_name: '', phone: '' })
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmDetails = ref({ title: '', message: '', itemName: '', warning: '', confirmLabel: 'Xác nhận', destructive: false })
const pendingAction = ref<(() => Promise<void>) | null>(null)
const modalTitle = computed(() => editing.value ? 'Sửa hồ sơ nhân sự' : 'Tạo tài khoản nhân sự')
const activeRows = computed(() => rows.value.filter((row) => row.status === 'ACTIVE' && row.staff_type === 'TEACHER'))
const allActiveSelected = computed(() => activeRows.value.length > 0 && activeRows.value.length <= MAX_BULK_RESET_TARGETS && activeRows.value.every((row) => selectedUserIds.value.includes(row.user_id)))
const tooManyActiveRows = computed(() => activeRows.value.length > MAX_BULK_RESET_TARGETS)

async function load() {
  selectedUserIds.value = []
  loading.value = true
  errorMessage.value = ''
  try { rows.value = await getStaff(search.value) as Staff[] }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải nhân sự' }
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
  bulkPeople.value = selected.map((row) => ({ user_id: row.user_id, full_name: row.full_name, code: row.staff_code }))
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
      ...(peopleById.get(result.user_id.toLowerCase()) || { user_id: result.user_id, full_name: 'Tài khoản không xác định', code: null }),
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
  form.value = { full_name: '', staff_code: '', username: '', email: '', password: '', phone: '' }
  errorMessage.value = ''
  showForm.value = true
}

function beginEdit(row: Staff) {
  editing.value = row
  formDirty.value = false
  editForm.value = { staff_code: row.staff_code || '', full_name: row.full_name, phone: row.phone || '' }
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
      await updateStaff(editing.value.id, { staff_code: editForm.value.staff_code || null, full_name: editForm.value.full_name, phone: editForm.value.phone || null })
      toast.success('Đã cập nhật thông tin nhân sự.')
    } else {
      const suppliedPassword = form.value.password
      form.value.password = ''
      const result = await adminCreateUser({ role: 'TEACHER', username: form.value.username, email: form.value.email || undefined, password: suppliedPassword || undefined, phone: form.value.phone || undefined, display_name: form.value.full_name, staff: { staff_code: form.value.staff_code || undefined, full_name: form.value.full_name } })
      if (!suppliedPassword) newTemporaryPassword = result.temporary_password
    }
    formDirty.value = false
    form.value = { full_name: '', staff_code: '', username: '', email: '', password: '', phone: '' }
    if (newTemporaryPassword) {
      temporaryPassword.value = newTemporaryPassword
      passwordDialogAfterClose.value = 'form'
    }
    formBusy.value = false
    showForm.value = false
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : editing.value ? 'Không thể cập nhật nhân sự' : 'Không thể tạo nhân sự' }
  finally { formBusy.value = false }
}

function onFormHidden() {
  if (passwordDialogAfterClose.value !== 'form') return
  passwordDialogAfterClose.value = null
  showPassword.value = true
}

function askFor(row: Staff, action: 'archive' | 'toggle' | 'reset') {
  const identity = `${row.full_name}${row.staff_code ? ` · ${row.staff_code}` : ''}`
  if (action === 'archive') {
    confirmDetails.value = { title: 'Lưu trữ nhân sự?', message: 'Tài khoản sẽ rời khỏi danh sách đang hoạt động. Lịch sử phân công và chấm công được giữ nguyên.', itemName: identity, warning: 'Thao tác này không xóa lịch sử làm việc.', confirmLabel: 'Lưu trữ nhân sự', destructive: true }
    pendingAction.value = async () => { await archiveStaff(row.id); toast.success(`Đã lưu trữ ${row.full_name}.`); await load() }
  } else if (action === 'toggle') {
    const locking = row.status === 'ACTIVE'
    confirmDetails.value = { title: locking ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?', message: locking ? 'Nhân sự sẽ không thể đăng nhập cho đến khi tài khoản được mở lại.' : 'Nhân sự sẽ có thể đăng nhập lại.', itemName: identity, warning: '', confirmLabel: locking ? 'Khóa tài khoản' : 'Mở khóa', destructive: locking }
    pendingAction.value = async () => { await setAccountStatus(row.user_id, locking ? 'LOCKED' : 'ACTIVE'); toast.success(locking ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.'); await load() }
  } else {
    confirmDetails.value = { title: 'Đặt lại mật khẩu?', message: 'Mật khẩu sẽ được đặt lại thành 12345678. Giáo viên cần đổi mật khẩu này ở lần đăng nhập kế tiếp.', itemName: identity, warning: 'Mật khẩu chỉ hiện một lần sau khi thao tác thành công. Bàn giao qua kênh bảo mật.', confirmLabel: 'Đặt lại mật khẩu', destructive: false }
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
  } catch (error) {
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
  <AppPageHeader title="Nhân sự" eyebrow="Đội ngũ giảng dạy" description="Quản lý hồ sơ, trạng thái truy cập và tài khoản giáo viên.">
    <template #actions><button class="btn btn-primary" type="button" @click="openCreate">Thêm nhân sự</button></template>
  </AppPageHeader>
  <div v-if="errorMessage && rows.length" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
  <section class="card"><div class="card-body">
    <form class="app-list-search d-flex flex-wrap gap-2 mb-3" role="search" @submit.prevent="load"><label class="visually-hidden" for="staff-search">Tìm nhân sự</label><input id="staff-search" v-model="search" class="form-control flex-grow-1" placeholder="Tìm theo tên hoặc mã nhân sự" /><button class="btn btn-outline-primary" type="submit" :disabled="loading">Tìm</button></form>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
      <p class="mb-0 small text-secondary">{{ activeRows.length }} tài khoản giáo viên đang hoạt động · {{ selectedUserIds.length }}/{{ MAX_BULK_RESET_TARGETS }} đã chọn</p>
      <button class="btn btn-outline-primary" type="button" data-testid="bulk-reset-staff" :disabled="!selectedUserIds.length || loading" @click="beginBulkReset">Đặt lại mật khẩu đã chọn</button>
    </div>
    <p v-if="tooManyActiveRows" class="small text-secondary mb-2">Có hơn {{ MAX_BULK_RESET_TARGETS }} giáo viên đang hoạt động trong kết quả. Hãy lọc thêm trước khi chọn tất cả.</p>
    <AppState v-if="loading" kind="loading" title="Đang tải danh sách nhân sự" />
    <AppState v-else-if="errorMessage && !rows.length" kind="error" title="Không thể tải danh sách nhân sự" :message="errorMessage" @retry="load" />
    <AppState v-else-if="!rows.length" kind="empty" title="Chưa có nhân sự phù hợp" message="Thêm giáo viên mới hoặc điều chỉnh từ khóa tìm kiếm." />
    <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th><input type="checkbox" class="form-check-input" data-testid="select-all-active-staff" aria-label="Chọn tất cả giáo viên đang hoạt động trong kết quả lọc" :checked="allActiveSelected" :disabled="loading || !activeRows.length || tooManyActiveRows" @change="toggleAllActive(($event.target as HTMLInputElement).checked)" /></th><th>Mã</th><th>Họ tên</th><th>Vai trò</th><th>SĐT</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      <tr v-for="row in rows" :key="row.id"><td><input type="checkbox" class="form-check-input" data-testid="select-staff-row" :aria-label="`Chọn ${row.full_name}`" :checked="selectedUserIds.includes(row.user_id)" :disabled="loading || row.status !== 'ACTIVE' || row.staff_type !== 'TEACHER' || (selectedUserIds.length >= MAX_BULK_RESET_TARGETS && !selectedUserIds.includes(row.user_id))" @change="toggleSelectedUser(row.user_id, ($event.target as HTMLInputElement).checked)" /></td><td>{{ row.staff_code || '—' }}</td><td class="fw-semibold">{{ row.full_name }}</td><td>Giáo viên</td><td>{{ row.phone || '—' }}</td><td><span class="badge" :class="row.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status === 'ACTIVE' ? 'Đang hoạt động' : row.status === 'LOCKED' ? 'Đã khóa' : row.status }}</span></td><td><div class="d-flex flex-wrap gap-1"><button class="btn btn-sm btn-outline-secondary" type="button" @click="beginEdit(row)">Sửa</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-danger" type="button" @click="askFor(row, 'archive')">Lưu trữ</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-secondary" type="button" @click="askFor(row, 'toggle')">{{ row.status === 'ACTIVE' ? 'Khóa TK' : 'Mở TK' }}</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-primary" type="button" @click="askFor(row, 'reset')">Đặt lại mật khẩu</button></div></td></tr>
    </tbody></table></div>
  </div></section>

  <FormModal v-model="showForm" :title="modalTitle" :description="editing ? 'Cập nhật thông tin hồ sơ nhân sự.' : 'Tài khoản mới có vai trò Giáo viên; có thể nhập email và mật khẩu ban đầu.'" :busy="formBusy" :dirty="formDirty" :submit-disabled="editing ? !editForm.full_name : !form.full_name" :submit-label="editing ? 'Lưu thay đổi' : 'Tạo tài khoản'" @submit="saveForm" @cancel="showForm = false" @hidden="onFormHidden">
    <div class="row g-3" @input="formDirty = true" @change="formDirty = true">
      <template v-if="editing"><AppField id="staff-name-edit" class="col-md-7" label="Họ tên" required><template #default="field"><input :id="field.id" v-model="editForm.full_name" class="form-control" required data-modal-autofocus /></template></AppField><AppField id="staff-code-edit" class="col-md-5" label="Mã nhân sự"><template #default="field"><input :id="field.id" v-model="editForm.staff_code" class="form-control" /></template></AppField><AppField id="staff-phone-edit" class="col-12" label="Số điện thoại"><template #default="field"><input :id="field.id" v-model="editForm.phone" class="form-control" inputmode="tel" /></template></AppField></template>
      <template v-else><AppField id="staff-name" class="col-md-7" label="Họ tên" required><template #default="field"><input :id="field.id" v-model="form.full_name" class="form-control" required data-modal-autofocus /></template></AppField><AppField id="staff-code" class="col-md-5" label="Mã nhân sự"><template #default="field"><input :id="field.id" v-model="form.staff_code" class="form-control" /></template></AppField><AppField id="staff-username" class="col-md-6" label="Tên đăng nhập" description="Có thể để trống để hệ thống tự tạo."><template #default="field"><input :id="field.id" v-model="form.username" class="form-control" autocomplete="off" :aria-describedby="field.describedBy" /></template></AppField><AppField id="staff-email" class="col-md-6" label="Email"><template #default="field"><input :id="field.id" v-model="form.email" class="form-control" type="email" autocomplete="email" :aria-describedby="field.describedBy" /></template></AppField><AppField id="staff-password" class="col-md-6" label="Mật khẩu ban đầu" description="Để trống để hệ thống tạo mật khẩu tạm."><template #default="field"><input :id="field.id" v-model="form.password" class="form-control" type="password" autocomplete="new-password" :aria-describedby="field.describedBy" /></template></AppField><AppField id="staff-phone" class="col-md-6" label="Số điện thoại"><template #default="field"><input :id="field.id" v-model="form.phone" class="form-control" inputmode="tel" /></template></AppField><p class="col-12 mb-0 small text-secondary">Tài khoản được tạo với vai trò Giáo viên.</p></template>
    </div>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
  </FormModal>
  <ConfirmModal v-model="confirmOpen" v-bind="confirmDetails" :busy="confirmBusy" @confirm="confirmAction" @hidden="onConfirmHidden" />
  <BulkPasswordResetModal v-model="bulkDialogOpen" :mode="bulkDialogMode" :people="bulkPeople" :results="bulkResults" :temporary-password="bulkTemporaryPassword" :busy="bulkBusy" :error-message="bulkErrorMessage" @confirm="confirmBulkReset" />
  <DetailModal v-model="showPassword" title="Mật khẩu tạm thời" description="Mật khẩu chỉ hiển thị trong phiên này. Hãy ghi lại và bàn giao qua kênh bảo mật." size="sm"><label class="form-label" for="staff-temporary-password">Mật khẩu tạm</label><input id="staff-temporary-password" class="form-control fw-semibold" :value="temporaryPassword" readonly data-modal-autofocus /><template #footer><button class="btn btn-primary" type="button" @click="closePassword">Đã ghi lại</button></template></DetailModal>
</template>
