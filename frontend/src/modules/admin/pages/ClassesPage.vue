<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { archiveClass, createClass, updateClass } from '@/services/commands'
import { getClasses, getGrades, getSubjects } from '@/services/data-queries'

interface ClassForm {
  code: string
  name: string
  subject_id: string
  grade_id: string
  max_students: number | null
  capacity_policy: 'WARNING' | 'BLOCK' | 'UNLIMITED'
}

const rows = ref<any[]>([])
const subjects = ref<any[]>([])
const grades = ref<any[]>([])
const showForm = ref(false)
const editingId = ref<string | null>(null)
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)
const form = ref<ClassForm>({ code: '', name: '', subject_id: '', grade_id: '', max_students: null, capacity_policy: 'UNLIMITED' })
const editForm = ref<ClassForm>({ ...form.value })

function emptyForm(): ClassForm {
  return { code: '', name: '', subject_id: '', grade_id: '', max_students: null, capacity_policy: 'UNLIMITED' }
}

async function load() {
  loading.value = true
  try {
    ;[rows.value, subjects.value, grades.value] = await Promise.all([getClasses(), getSubjects(), getGrades()])
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải lớp học'
  } finally {
    loading.value = false
  }
}

async function create() {
  errorMessage.value = ''
  try {
    await createClass({ ...form.value, max_students: form.value.capacity_policy === 'UNLIMITED' ? null : form.value.max_students })
    successMessage.value = 'Đã tạo lớp học.'
    showForm.value = false
    form.value = emptyForm()
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tạo lớp học'
  }
}

function beginEdit(row: any) {
  editingId.value = row.id
  editForm.value = { code: row.code, name: row.name, subject_id: row.subject_id, grade_id: row.grade_id, max_students: row.max_students, capacity_policy: row.capacity_policy }
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(row: any) {
  errorMessage.value = ''
  try {
    await updateClass(row.id, { ...editForm.value, max_students: editForm.value.capacity_policy === 'UNLIMITED' ? null : editForm.value.max_students })
    successMessage.value = 'Đã cập nhật lớp học.'
    editingId.value = null
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật lớp học'
  }
}

async function archive(row: any) {
  if (!window.confirm(`Lưu trữ lớp ${row.name}? Lịch sử học tập vẫn được giữ nguyên.`)) return
  errorMessage.value = ''
  try {
    await archiveClass(row.id)
    successMessage.value = 'Đã lưu trữ lớp học.'
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu trữ lớp học'
  }
}

onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4">
    <div><div class="small text-secondary">Core</div><h1 class="h3 mb-0">Lớp học</h1></div>
    <button class="btn btn-primary" @click="showForm = !showForm">{{ showForm ? 'Đóng form' : 'Thêm lớp' }}</button>
  </div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div v-if="showForm" class="card border-0 shadow-sm mb-4"><div class="card-body"><div class="row g-3">
    <div class="col-md-3"><label class="form-label">Mã lớp</label><input v-model="form.code" class="form-control" /></div>
    <div class="col-md-5"><label class="form-label">Tên lớp</label><input v-model="form.name" class="form-control" /></div>
    <div class="col-md-2"><label class="form-label">Môn</label><select v-model="form.subject_id" class="form-select"><option value="">Chọn</option><option v-for="item in subjects" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
    <div class="col-md-2"><label class="form-label">Khối</label><select v-model="form.grade_id" class="form-select"><option value="">Chọn</option><option v-for="item in grades" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
    <div class="col-md-4"><label class="form-label">Chính sách sĩ số</label><select v-model="form.capacity_policy" class="form-select"><option value="UNLIMITED">Không giới hạn</option><option value="WARNING">Cảnh báo</option><option value="BLOCK">Chặn</option></select></div>
    <div v-if="form.capacity_policy !== 'UNLIMITED'" class="col-md-4"><label class="form-label">Sĩ số tối đa</label><input v-model.number="form.max_students" type="number" min="1" class="form-control" /></div>
  </div><button class="btn btn-success mt-3" :disabled="!form.code || !form.name || !form.subject_id || !form.grade_id" @click="create">Lưu lớp</button></div></div>
  <div class="card border-0 shadow-sm"><div class="card-body"><div class="table-responsive"><table class="table align-middle">
    <thead><tr><th>Mã</th><th>Tên lớp</th><th>Môn</th><th>Khối</th><th>Sĩ số</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody><template v-for="row in rows" :key="row.id">
      <tr v-if="editingId !== row.id"><td><code>{{ row.code }}</code></td><td class="fw-semibold">{{ row.name }}</td><td>{{ row.subjects?.name || '—' }}</td><td>{{ row.grades?.name || '—' }}</td><td>{{ row.capacity_policy === 'UNLIMITED' ? 'Không giới hạn' : row.max_students }}</td><td><span class="badge" :class="row.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status }}</span></td><td><div class="d-flex flex-wrap gap-1"><RouterLink class="btn btn-sm btn-outline-primary" :to="`/admin/classes/${row.id}`">Chi tiết</RouterLink><button class="btn btn-sm btn-outline-secondary" @click="beginEdit(row)">Sửa</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-danger" @click="archive(row)">Lưu trữ</button></div></td></tr>
      <tr v-else><td colspan="7"><div class="row g-2 align-items-end"><div class="col-md-2"><label class="form-label small">Mã lớp</label><input v-model="editForm.code" class="form-control form-control-sm" /></div><div class="col-md-3"><label class="form-label small">Tên lớp</label><input v-model="editForm.name" class="form-control form-control-sm" /></div><div class="col-md-2"><label class="form-label small">Môn</label><select v-model="editForm.subject_id" class="form-select form-select-sm"><option v-for="item in subjects" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div class="col-md-2"><label class="form-label small">Khối</label><select v-model="editForm.grade_id" class="form-select form-select-sm"><option v-for="item in grades" :key="item.id" :value="item.id">{{ item.name }}</option></select></div><div class="col-md-1"><label class="form-label small">Sĩ số</label><input v-model.number="editForm.max_students" type="number" min="1" class="form-control form-control-sm" /></div><div class="col-md-2"><label class="form-label small">Chính sách</label><select v-model="editForm.capacity_policy" class="form-select form-select-sm"><option value="UNLIMITED">Không giới hạn</option><option value="WARNING">Cảnh báo</option><option value="BLOCK">Chặn</option></select></div><div class="col-12 d-flex gap-2"><button class="btn btn-sm btn-success" @click="saveEdit(row)">Lưu</button><button class="btn btn-sm btn-outline-secondary" @click="cancelEdit">Hủy</button></div></div></td></tr>
    </template><tr v-if="!loading && !rows.length"><td colspan="7" class="text-center text-secondary py-4">Chưa có dữ liệu</td></tr></tbody>
  </table></div></div></div>
</template>
