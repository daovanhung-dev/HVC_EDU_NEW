<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { archiveClass, createClass, updateClass } from '@/services/commands'
import { getClasses, getGrades, getSubjects } from '@/services/data-queries'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppField from '@/app/components/AppField.vue'
import AppState from '@/app/components/AppState.vue'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'

interface ClassForm { code: string; name: string; subject_id: string; grade_id: string; max_students: number | null; capacity_policy: 'WARNING' | 'BLOCK' | 'UNLIMITED' }
const toast = useToastStore()
const rows = ref<any[]>([])
const subjects = ref<any[]>([])
const grades = ref<any[]>([])
const showForm = ref(false)
const editing = ref<any | null>(null)
const formBusy = ref(false)
const formDirty = ref(false)
const errorMessage = ref('')
const loading = ref(false)
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const pendingClass = ref<any | null>(null)
const form = ref<ClassForm>({ code: '', name: '', subject_id: '', grade_id: '', max_students: null, capacity_policy: 'UNLIMITED' })
const modalTitle = computed(() => editing.value ? `Sửa lớp ${editing.value.name}` : 'Tạo lớp học')

function emptyForm(): ClassForm { return { code: '', name: '', subject_id: '', grade_id: '', max_students: null, capacity_policy: 'UNLIMITED' } }

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { ;[rows.value, subjects.value, grades.value] = await Promise.all([getClasses(), getSubjects(), getGrades()]) }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải lớp học' }
  finally { loading.value = false }
}

function openCreate() { editing.value = null; form.value = emptyForm(); formDirty.value = false; errorMessage.value = ''; showForm.value = true }
function beginEdit(row: any) {
  editing.value = row
  form.value = { code: row.code, name: row.name, subject_id: row.subject_id, grade_id: row.grade_id, max_students: row.max_students, capacity_policy: row.capacity_policy }
  formDirty.value = false
  errorMessage.value = ''
  showForm.value = true
}

async function saveForm() {
  if (formBusy.value) return
  formBusy.value = true
  errorMessage.value = ''
  try {
    const payload = { ...form.value, max_students: form.value.capacity_policy === 'UNLIMITED' ? null : form.value.max_students }
    if (editing.value) { await updateClass(editing.value.id, payload); toast.success('Đã cập nhật lớp học.') }
    else { await createClass(payload); toast.success('Đã tạo lớp học.') }
    formBusy.value = false
    showForm.value = false
    formDirty.value = false
    form.value = emptyForm()
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : editing.value ? 'Không thể cập nhật lớp học' : 'Không thể tạo lớp học' }
  finally { formBusy.value = false }
}

function askArchive(row: any) { pendingClass.value = row; confirmOpen.value = true }
async function archive() {
  if (!pendingClass.value || confirmBusy.value) return
  confirmBusy.value = true
  errorMessage.value = ''
  try { await archiveClass(pendingClass.value.id); toast.success(`Đã lưu trữ lớp ${pendingClass.value.name}.`); confirmBusy.value = false; confirmOpen.value = false; await load() }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu trữ lớp học'
    toast.error(errorMessage.value)
  }
  finally { confirmBusy.value = false }
}

onMounted(load)
</script>

<template>
  <AppPageHeader title="Lớp học" eyebrow="Tổ chức giảng dạy" description="Quản lý lớp, môn học, khối và chính sách sĩ số.">
    <template #actions><button class="btn btn-primary" type="button" @click="openCreate">Thêm lớp</button></template>
  </AppPageHeader>
  <div v-if="errorMessage && rows.length" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
  <section class="card"><div class="card-body">
    <AppState v-if="loading" kind="loading" title="Đang tải danh sách lớp" />
    <AppState v-else-if="errorMessage && !rows.length" kind="error" title="Không thể tải danh sách lớp" :message="errorMessage" @retry="load" />
    <AppState v-else-if="!rows.length" kind="empty" title="Chưa có lớp học" message="Tạo lớp để bắt đầu quản lý thành viên và lịch học." />
    <div v-else class="table-responsive"><table class="table align-middle"><thead><tr><th>Mã</th><th>Tên lớp</th><th>Môn</th><th>Khối</th><th>Sĩ số</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      <tr v-for="row in rows" :key="row.id"><td><code>{{ row.code }}</code></td><td class="fw-semibold">{{ row.name }}</td><td>{{ row.subjects?.name || '—' }}</td><td>{{ row.grades?.name || '—' }}</td><td>{{ row.capacity_policy === 'UNLIMITED' ? 'Không giới hạn' : row.max_students }}</td><td><span class="badge" :class="row.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-secondary'">{{ row.status === 'ACTIVE' ? 'Đang hoạt động' : row.status }}</span></td><td><div class="d-flex flex-wrap gap-1"><RouterLink class="btn btn-sm btn-outline-primary" :to="`/admin/classes/${row.id}`">Chi tiết</RouterLink><button class="btn btn-sm btn-outline-secondary" type="button" @click="beginEdit(row)">Sửa</button><button v-if="row.status !== 'ARCHIVED'" class="btn btn-sm btn-outline-danger" type="button" @click="askArchive(row)">Lưu trữ</button></div></td></tr>
    </tbody></table></div>
  </div></section>

  <FormModal v-model="showForm" :title="modalTitle" :description="editing ? 'Cập nhật thông tin và chính sách sĩ số của lớp.' : 'Tạo lớp mới trong phạm vi tổ chức giảng dạy hiện hành.'" :busy="formBusy" :dirty="formDirty" :submit-disabled="!form.code || !form.name || !form.subject_id || !form.grade_id || (form.capacity_policy !== 'UNLIMITED' && !form.max_students)" :submit-label="editing ? 'Lưu thay đổi' : 'Tạo lớp'" @submit="saveForm" @cancel="showForm = false">
    <div class="row g-3" @input="formDirty = true" @change="formDirty = true">
      <AppField id="class-code" class="col-md-4" label="Mã lớp" required><template #default="field"><input :id="field.id" v-model="form.code" class="form-control" required data-modal-autofocus /></template></AppField>
      <AppField id="class-name" class="col-md-8" label="Tên lớp" required><template #default="field"><input :id="field.id" v-model="form.name" class="form-control" required /></template></AppField>
      <AppField id="class-subject" class="col-md-6" label="Môn học" required><template #default="field"><select :id="field.id" v-model="form.subject_id" class="form-select" required><option value="">Chọn môn</option><option v-for="item in subjects" :key="item.id" :value="item.id">{{ item.name }}</option></select></template></AppField>
      <AppField id="class-grade" class="col-md-6" label="Khối" required><template #default="field"><select :id="field.id" v-model="form.grade_id" class="form-select" required><option value="">Chọn khối</option><option v-for="item in grades" :key="item.id" :value="item.id">{{ item.name }}</option></select></template></AppField>
      <AppField id="class-capacity-policy" class="col-md-6" label="Chính sách sĩ số"><template #default="field"><select :id="field.id" v-model="form.capacity_policy" class="form-select"><option value="UNLIMITED">Không giới hạn</option><option value="WARNING">Cảnh báo khi vượt</option><option value="BLOCK">Chặn khi đủ sĩ số</option></select></template></AppField>
      <AppField v-if="form.capacity_policy !== 'UNLIMITED'" id="class-capacity" class="col-md-6" label="Sĩ số tối đa" required><template #default="field"><input :id="field.id" v-model.number="form.max_students" type="number" min="1" class="form-control" required /></template></AppField>
    </div>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
  </FormModal>
  <ConfirmModal v-model="confirmOpen" title="Lưu trữ lớp học?" :message="`Lớp ${pendingClass?.name || ''} sẽ rời khỏi danh sách đang hoạt động. Lịch sử học tập vẫn được giữ nguyên.`" :item-name="pendingClass?.code || ''" warning="Không xóa lớp, thành viên hoặc lịch sử buổi học." confirm-label="Lưu trữ lớp" destructive :busy="confirmBusy" @confirm="archive" />
</template>
