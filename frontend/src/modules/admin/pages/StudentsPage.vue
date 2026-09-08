<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminCreateUser, adminResetPassword, setAccountStatus } from '@/services/commands'
import { getStudents } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'

interface Student { id: string; user_id: string; student_code: string; full_name: string; phone: string | null; parent_name: string | null; status: string; created_at: string }
const rows = ref<Student[]>([])
const search = ref('')
const loading = ref(false)
const showForm = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const temporaryPassword = ref('')
const form = ref({ full_name: '', student_code: '', username: '', phone: '', parent_name: '', parent_phone: '' })

async function load() {
  loading.value = true
  try { rows.value = await getStudents(search.value) as Student[] } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải học sinh' } finally { loading.value = false }
}

async function create() {
  errorMessage.value = ''; successMessage.value = ''; temporaryPassword.value = ''
  try {
    const result = await adminCreateUser({ role: 'STUDENT', username: form.value.username, phone: form.value.phone || undefined, display_name: form.value.full_name, student: { student_code: form.value.student_code || undefined, full_name: form.value.full_name, parent_name: form.value.parent_name, parent_phone: form.value.parent_phone } })
    temporaryPassword.value = result.temporary_password
    successMessage.value = 'Đã tạo tài khoản học sinh. Hãy ghi lại mật khẩu tạm thời và bàn giao bảo mật.'
    form.value = { full_name: '', student_code: '', username: '', phone: '', parent_name: '', parent_phone: '' }
    showForm.value = false
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tạo học sinh' }
}

async function toggleStatus(row: Student) { try { await setAccountStatus(row.user_id, row.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE'); successMessage.value = row.status === 'ACTIVE' ? 'Đã khóa tài khoản học sinh.' : 'Đã mở khóa tài khoản học sinh.'; await load() } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể đổi trạng thái tài khoản' } }
async function resetPassword(row: Student) { try { const result = await adminResetPassword(row.user_id); temporaryPassword.value = result.temporary_password; successMessage.value = `Mật khẩu tạm của ${row.full_name} chỉ hiển thị một lần.` } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể reset mật khẩu' } }

onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4">
    <div><div class="small text-secondary">Core</div><h1 class="h3 mb-0">Học sinh</h1></div>
    <button class="btn btn-primary" @click="showForm = !showForm">{{ showForm ? 'Đóng form' : 'Thêm học sinh' }}</button>
  </div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }} <code v-if="temporaryPassword">{{ temporaryPassword }}</code></div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div v-if="showForm" class="card border-0 shadow-sm mb-4"><div class="card-body">
    <h2 class="h6">Tạo hồ sơ và tài khoản học sinh</h2>
    <div class="row g-3">
      <div class="col-md-6"><label class="form-label">Họ tên</label><input v-model="form.full_name" class="form-control" required /></div>
      <div class="col-md-3"><label class="form-label">Mã học sinh</label><input v-model="form.student_code" class="form-control" placeholder="Tự sinh nếu bỏ trống" /></div>
      <div class="col-md-3"><label class="form-label">Username</label><input v-model="form.username" class="form-control" placeholder="Tự sinh nếu bỏ trống" /></div>
      <div class="col-md-4"><label class="form-label">Số điện thoại</label><input v-model="form.phone" class="form-control" /></div>
      <div class="col-md-4"><label class="form-label">Tên phụ huynh</label><input v-model="form.parent_name" class="form-control" /></div>
      <div class="col-md-4"><label class="form-label">SĐT phụ huynh</label><input v-model="form.parent_phone" class="form-control" /></div>
    </div>
    <button class="btn btn-success mt-3" :disabled="!form.full_name" @click="create">Tạo tài khoản</button>
  </div></div>
  <div class="card border-0 shadow-sm"><div class="card-body">
    <div class="d-flex gap-2 mb-3"><input v-model="search" class="form-control" placeholder="Tìm theo tên hoặc mã học sinh" @keyup.enter="load" /><button class="btn btn-outline-primary" @click="load">Tìm</button></div>
    <div class="table-responsive"><table class="table align-middle"><thead><tr><th>Mã</th><th>Họ tên</th><th>SĐT</th><th>Phụ huynh</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
      <tr v-for="row in rows" :key="row.id"><td><code>{{ row.student_code }}</code></td><td class="fw-semibold">{{ row.full_name }}</td><td>{{ row.phone || '—' }}</td><td>{{ row.parent_name || '—' }}</td><td><span class="badge" :class="row.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status }}</span></td><td>{{ formatDateTime(row.created_at) }}</td><td><div class="d-flex gap-1"><button class="btn btn-sm btn-outline-secondary" @click="toggleStatus(row)">{{ row.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa' }}</button><button class="btn btn-sm btn-outline-warning" @click="resetPassword(row)">Reset</button></div></td></tr>
      <tr v-if="!loading && !rows.length"><td colspan="7" class="text-center text-secondary py-4">Chưa có dữ liệu</td></tr>
    </tbody></table></div>
  </div></div>
</template>
