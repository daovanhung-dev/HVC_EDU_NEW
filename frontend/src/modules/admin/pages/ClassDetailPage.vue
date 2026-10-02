<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { addClassMembership, updateClassMembership } from '@/services/commands'
import { getClassActiveMemberships, getClassDetail, getStudents } from '@/services/data-queries'
import type { ClassDetailRow, ClassMembershipDetailRow } from '@/shared/types/domain'
import { useToastStore } from '@/stores/toast.store'
import AppField from '@/app/components/AppField.vue'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'

const route = useRoute()
const toast = useToastStore()
const classId = computed(() => String(route.params.classId || ''))
const classRow = ref<ClassDetailRow | null>(null)
const memberships = ref<ClassMembershipDetailRow[]>([])
const students = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')
const showMembership = ref(false)
const membershipBusy = ref(false)
const membershipDirty = ref(false)
const endingMembership = ref<ClassMembershipDetailRow | null>(null)
const confirmEnd = ref(false)
const confirmBusy = ref(false)
const localDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const membershipForm = ref({ student_id: '', start_date: localDate() })
const availableStudents = computed(() => students.value.filter((student) => !memberships.value.some((row) => row.student_id === student.id)))

async function load() {
  if (!classId.value) return
  loading.value = true
  errorMessage.value = ''
  classRow.value = null
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
  if (!membershipForm.value.student_id || membershipBusy.value) return
  errorMessage.value = ''
  membershipBusy.value = true
  try {
    await addClassMembership({ class_id: classId.value, student_id: membershipForm.value.student_id, start_date: membershipForm.value.start_date })
    membershipForm.value = { student_id: '', start_date: localDate() }
    membershipBusy.value = false
    showMembership.value = false
    membershipDirty.value = false
    toast.success('Đã thêm học sinh vào lớp.')
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể thêm học sinh vào lớp.' }
  finally { membershipBusy.value = false }
}

function endMembership(row: ClassMembershipDetailRow) {
  endingMembership.value = row
  confirmEnd.value = true
}

async function confirmEndMembership() {
  const row = endingMembership.value
  if (!row || confirmBusy.value) return
  confirmBusy.value = true
  const today = localDate()
  try {
    await updateClassMembership(row.id, { start_date: row.start_date, end_date: row.start_date > today ? null : today, status: 'INACTIVE' })
    confirmBusy.value = false
    confirmEnd.value = false
    toast.success(`Đã kết thúc xếp lớp của ${row.students?.full_name || 'học sinh'}.`)
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật xếp lớp.'
    toast.error(errorMessage.value)
  }
  finally { confirmBusy.value = false }
}

watch(classId, () => { void load() })
onMounted(load)
</script>

<template>
  <AppPageHeader :title="classRow?.name || 'Chi tiết lớp'" eyebrow="Lớp học" :description="classRow ? `${classRow.code} · ${classRow.subjects?.name || '—'} · ${classRow.grades?.name || '—'}` : 'Thành viên và lịch học của lớp.'">
    <template #actions><RouterLink to="/admin/classes" class="btn btn-outline-primary">Danh sách lớp</RouterLink><RouterLink class="btn btn-primary" :to="{ path: '/admin/sessions', query: { class_id: classId } }">Xếp lịch và buổi học</RouterLink></template>
  </AppPageHeader>

  <AppState v-if="loading" kind="loading" title="Đang tải thông tin lớp" />
  <AppState v-else-if="errorMessage && !classRow" kind="error" title="Không thể mở lớp học" :message="errorMessage"><button class="btn btn-outline-primary" type="button" @click="load">Thử tải lại</button></AppState>
  <div v-else-if="classRow">
    <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
  <section class="card">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 class="h6 mb-1">Học sinh trong lớp</h2>
          <small class="text-secondary">Danh sách áp dụng liên tục theo ngày bắt đầu và kết thúc.</small>
        </div>
        <span class="badge text-bg-light">{{ memberships.length }} học sinh</span>
      </div>
      <button class="btn btn-primary mb-3" type="button" @click="showMembership = true; errorMessage = ''">Thêm học sinh vào lớp</button>
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
  </section>
  </div>

  <FormModal v-model="showMembership" title="Thêm học sinh vào lớp" description="Xếp lớp có hiệu lực liên tục từ ngày bắt đầu đã chọn." :busy="membershipBusy" :dirty="membershipDirty" :submit-disabled="!membershipForm.student_id" submit-label="Thêm vào lớp" @submit="addStudent" @cancel="showMembership = false">
    <div class="row g-3" @change="membershipDirty = true">
      <AppField id="membership-student" class="col-12" label="Học sinh" required><template #default="field"><select :id="field.id" v-model="membershipForm.student_id" class="form-select" required data-modal-autofocus><option value="">Chọn học sinh</option><option v-for="student in availableStudents" :key="student.id" :value="student.id">{{ student.student_code }} — {{ student.full_name }}</option></select></template></AppField>
      <AppField id="membership-start" class="col-12" label="Ngày bắt đầu" required><template #default="field"><input :id="field.id" v-model="membershipForm.start_date" type="date" class="form-control" required /></template></AppField>
    </div>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
  </FormModal>
  <ConfirmModal v-model="confirmEnd" title="Kết thúc xếp lớp?" :message="`Membership của ${endingMembership?.students?.full_name || 'học sinh'} sẽ kết thúc từ hôm nay. Lịch sử các buổi học vẫn được giữ.`" :item-name="classRow?.name || ''" warning="Thao tác này chỉ kết thúc quan hệ hiện hành; dữ liệu lịch sử không bị xóa." confirm-label="Kết thúc xếp lớp" destructive :busy="confirmBusy" @confirm="confirmEndMembership" />
</template>
