<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { adminCreateUser, adminResetPassword, archiveStaff, setAccountStatus, updateStaff } from '@/services/commands'
import { getStaff } from '@/services/data-queries'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppField from '@/app/components/AppField.vue'
import AppState from '@/app/components/AppState.vue'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'
import DetailModal from '@/app/components/DetailModal.vue'

interface Staff { id: string; user_id: string; staff_code: string | null; full_name: string; staff_type: string; phone: string | null; status: string }
interface StaffForm { staff_code: string; full_name: string; phone: string }
const toast = useToastStore()
const rows = ref<Staff[]>([])
const search = ref('')
const showForm = ref(false)
const editing = ref<Staff | null>(null)
const formBusy = ref(false)
const formDirty = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const temporaryPassword = ref('')
const showPassword = ref(false)
const form = ref({ full_name: '', staff_code: '', username: '', phone: '' })
const editForm = ref<StaffForm>({ staff_code: '', full_name: '', phone: '' })
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmDetails = ref({ title: '', message: '', itemName: '', warning: '', confirmLabel: 'Xác nhận', destructive: false })
const pendingAction = ref<(() => Promise<void>) | null>(null)
const modalTitle = computed(() => editing.value ? 'Sửa hồ sơ nhân sự' : 'Tạo tài khoản nhân sự')

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { rows.value = await getStaff(search.value) as Staff[] }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải nhân sự' }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  formDirty.value = false
  form.value = { full_name: '', staff_code: '', username: '', phone: '' }
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
      const result = await adminCreateUser({ role: 'TEACHER', username: form.value.username, phone: form.value.phone || undefined, display_name: form.value.full_name, staff: { staff_code: form.value.staff_code || undefined, full_name: form.value.full_name } })
      newTemporaryPassword = result.temporary_password
    }
    showForm.value = false
    formDirty.value = false
    form.value = { full_name: '', staff_code: '', username: '', phone: '' }
    await load()
    if (newTemporaryPassword) {
      temporaryPassword.value = newTemporaryPassword
      await nextTick()
      showPassword.value = true
    }
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : editing.value ? 'Không thể cập nhật nhân sự' : 'Không thể tạo nhân sự' }
  finally { formBusy.value = false }
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
    confirmDetails.value = { title: 'Đặt lại mật khẩu?', message: 'Mật khẩu hiện tại sẽ được thay bằng mật khẩu tạm mới. Mật khẩu chỉ hiện một lần sau khi thao tác thành công.', itemName: identity, warning: 'Bàn giao mật khẩu qua kênh bảo mật.', confirmLabel: 'Đặt lại mật khẩu', destructive: false }
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
    confirmOpen.value = false
    if (temporaryPassword.value) { await nextTick(); showPassword.value = true }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể hoàn tất thao tác'
    toast.error(errorMessage.value)
  }
  finally { confirmBusy.value = false }
}

function closePassword() { showPassword.value = false; temporaryPassword.value = '' }
onMounted(load)
</script>

<template>
  <AppPageHeader title="Nhân sự" eyebrow="Đội ngũ giảng dạy" description="Quản lý hồ sơ, trạng thái truy cập và tài khoản giáo viên.">
    <template #actions><button class="btn btn-primary" type="button" @click="openCreate">Thêm nhân sự</button></template>
  </AppPageHeader>
  <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
  <section class="card"><div class="card-body">
    <form class="app-list-search d-flex flex-wrap gap-2 mb-3" role="search" @submit.prevent="load"><label class="visually-hidden" for="staff-search">Tìm nhân sự</label><input id="staff-search" v-model="search" class="form-control flex-grow-1" placeholder="Tìm theo tên hoặc mã nhân sự" /><button class="btn btn-outline-primary" type="submit" :disabled="loading">Tìm</button></form>
    <AppState v-if="loading" kind="loading" title="Đang tải danh sách nhân sự" />
    <AppState v-else-if="!rows.length" kind="empty" title="Chưa có nhân sự phù hợp" message="Thêm giáo viên mới hoặc điều chỉnh từ khóa tìm kiếm." />
    <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th>Mã</th><th>Họ tên</th><th>Vai trò</th><th>SĐT</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      <tr v-for="row in rows" :key="row.id"><td>{{ row.staff_code || '—' }}</td><td class="fw-semibold">{{ row.full_name }}</td><td>Giáo viên</td><td>{{ row.phone || '—' }}</td><td><span class="badge" :class="row.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status === 'ACTIVE' ? 'Đang hoạt động' : row.status === 'LOCKED' ? 'Đã khóa' : row.status }}</span></td><td><div class="d-flex flex-wrap gap-1"><button class="btn btn-sm btn-outline-secondary" type="button" @click="beginEdit(row)">Sửa</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-danger" type="button" @click="askFor(row, 'archive')">Lưu trữ</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-secondary" type="button" @click="askFor(row, 'toggle')">{{ row.status === 'ACTIVE' ? 'Khóa TK' : 'Mở TK' }}</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-primary" type="button" @click="askFor(row, 'reset')">Đặt lại mật khẩu</button></div></td></tr>
    </tbody></table></div>
  </div></section>

  <FormModal v-model="showForm" :title="modalTitle" :description="editing ? 'Cập nhật thông tin hồ sơ nhân sự.' : 'Tài khoản mới có vai trò Giáo viên và được cấp mật khẩu tạm.'" :busy="formBusy" :dirty="formDirty" :submit-disabled="editing ? !editForm.full_name : !form.full_name" :submit-label="editing ? 'Lưu thay đổi' : 'Tạo tài khoản'" @submit="saveForm" @cancel="showForm = false">
    <div class="row g-3" @input="formDirty = true" @change="formDirty = true">
      <template v-if="editing"><AppField id="staff-name-edit" class="col-md-7" label="Họ tên" required><template #default="field"><input :id="field.id" v-model="editForm.full_name" class="form-control" required data-modal-autofocus /></template></AppField><AppField id="staff-code-edit" class="col-md-5" label="Mã nhân sự"><template #default="field"><input :id="field.id" v-model="editForm.staff_code" class="form-control" /></template></AppField><AppField id="staff-phone-edit" class="col-12" label="Số điện thoại"><template #default="field"><input :id="field.id" v-model="editForm.phone" class="form-control" inputmode="tel" /></template></AppField></template>
      <template v-else><AppField id="staff-name" class="col-md-7" label="Họ tên" required><template #default="field"><input :id="field.id" v-model="form.full_name" class="form-control" required data-modal-autofocus /></template></AppField><AppField id="staff-code" class="col-md-5" label="Mã nhân sự"><template #default="field"><input :id="field.id" v-model="form.staff_code" class="form-control" /></template></AppField><AppField id="staff-username" class="col-md-6" label="Tên đăng nhập" description="Có thể để trống để hệ thống tự tạo."><template #default="field"><input :id="field.id" v-model="form.username" class="form-control" autocomplete="off" :aria-describedby="field.describedBy" /></template></AppField><AppField id="staff-phone" class="col-md-6" label="Số điện thoại"><template #default="field"><input :id="field.id" v-model="form.phone" class="form-control" inputmode="tel" /></template></AppField><p class="col-12 mb-0 small text-secondary">Tài khoản được tạo với vai trò Giáo viên.</p></template>
    </div>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
  </FormModal>
  <ConfirmModal v-model="confirmOpen" v-bind="confirmDetails" :busy="confirmBusy" @confirm="confirmAction" />
  <DetailModal v-model="showPassword" title="Mật khẩu tạm thời" description="Mật khẩu chỉ hiển thị trong phiên này. Hãy ghi lại và bàn giao qua kênh bảo mật." size="sm"><label class="form-label" for="staff-temporary-password">Mật khẩu tạm</label><input id="staff-temporary-password" class="form-control fw-semibold" :value="temporaryPassword" readonly data-modal-autofocus /><template #footer><button class="btn btn-primary" type="button" @click="closePassword">Đã ghi lại</button></template></DetailModal>
</template>
