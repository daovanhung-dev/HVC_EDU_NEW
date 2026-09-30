<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { addClassMembership, updateClassMembership } from '@/services/commands'
import { getClassActiveMemberships, getClassDetail, getStudents } from '@/services/data-queries'
import type { ClassDetailRow, ClassMembershipDetailRow } from '@/shared/types/domain'

const route = useRoute()
const classId = computed(() => String(route.params.classId || ''))
const classRow = ref<ClassDetailRow | null>(null)
const memberships = ref<ClassMembershipDetailRow[]>([])
const students = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const localDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const membershipForm = ref({ student_id: '', start_date: localDate() })
const availableStudents = computed(() => students.value.filter((student) => !memberships.value.some((row) => row.student_id === student.id)))

async function load() {
  if (!classId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [detail, currentMemberships, allStudents] = await Promise.all([
      getClassDetail(classId.value),
      getClassActiveMemberships(classId.value),
      getStudents(),
    ])
    if (!detail) throw new Error('Không tìm thấy lớp học')
    classRow.value = detail
    memberships.value = currentMemberships
    students.value = allStudents as any[]
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải thông tin lớp'
  } finally {
    loading.value = false
  }
}

async function addStudent() {
  if (!membershipForm.value.student_id) return
  errorMessage.value = ''; successMessage.value = ''
  try {
    await addClassMembership({ class_id: classId.value, student_id: membershipForm.value.student_id, start_date: membershipForm.value.start_date })
    membershipForm.value.student_id = ''
    successMessage.value = 'Đã thêm học sinh vào lớp.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể thêm học sinh vào lớp.' }
}

async function endMembership(row: ClassMembershipDetailRow) {
  const today = localDate()
  if (!window.confirm(`Kết thúc việc học lớp này của ${row.students?.full_name || 'học sinh'} từ hôm nay? Lịch sử buổi học vẫn được giữ.`)) return
  try {
    await updateClassMembership(row.id, { start_date: row.start_date, end_date: row.start_date > today ? null : today, status: 'INACTIVE' })
    successMessage.value = 'Đã kết thúc xếp lớp.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật xếp lớp.' }
}

watch(classId, () => { void load() })
onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
    <div>
      <RouterLink to="/admin/classes" class="small text-decoration-none">← Danh sách lớp</RouterLink>
      <div class="small text-secondary mt-2">Lớp học</div>
      <h1 class="h3 mb-1">{{ classRow?.name || 'Chi tiết lớp' }}</h1>
      <div v-if="classRow" class="text-secondary"><code>{{ classRow.code }}</code> · {{ classRow.subjects?.name || '—' }} · {{ classRow.grades?.name || '—' }}</div>
    </div>
    <RouterLink class="btn btn-primary" :to="{ path: '/admin/sessions', query: { class_id: classId } }">Xếp lịch và buổi học</RouterLink>
  </div>

  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div v-if="loading" class="alert alert-info">Đang tải lớp…</div>

  <div class="card border-0 shadow-sm">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 class="h6 mb-1">Học sinh trong lớp</h2>
          <small class="text-secondary">Danh sách áp dụng liên tục theo ngày bắt đầu và kết thúc.</small>
        </div>
        <span class="badge text-bg-light">{{ memberships.length }} học sinh</span>
      </div>
      <form class="row g-2 align-items-end mb-3" @submit.prevent="addStudent">
        <div class="col-md-6">
          <label class="form-label">Thêm học sinh</label>
          <select v-model="membershipForm.student_id" class="form-select">
            <option value="">Chọn học sinh</option>
            <option v-for="student in availableStudents" :key="student.id" :value="student.id">{{ student.student_code }} — {{ student.full_name }}</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Ngày bắt đầu</label>
          <input v-model="membershipForm.start_date" type="date" class="form-control" required />
        </div>
        <div class="col-md-3"><button class="btn btn-primary w-100" :disabled="!membershipForm.student_id">Thêm vào lớp</button></div>
      </form>
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Mã</th><th>Học sinh</th><th>Điện thoại</th><th>Bắt đầu</th><th>Thao tác</th></tr></thead>
          <tbody>
            <tr v-for="membership in memberships" :key="membership.id">
              <td><code>{{ membership.students?.student_code }}</code></td>
              <td><RouterLink :to="`/admin/students/${membership.student_id}`">{{ membership.students?.full_name }}</RouterLink></td>
              <td>{{ membership.students?.phone || '—' }}</td>
              <td>{{ membership.start_date }}</td>
              <td><button class="btn btn-sm btn-outline-danger" @click="endMembership(membership)">Kết thúc</button></td>
            </tr>
            <tr v-if="!memberships.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có học sinh trong lớp.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
