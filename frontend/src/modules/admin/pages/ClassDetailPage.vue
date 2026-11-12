<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { addClassMembership, updateClassMembership, updateClassMembershipStartDateAndSyncFutureRosters } from '@/services/commands'
import { getClassActiveMemberships, getClassDetail, getStudents } from '@/services/data-queries'
import type { ClassDetailRow, ClassMembershipDetailRow } from '@/shared/types/domain'
import { userErrorMessage } from '@/shared/utils/errors'
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
const editingMembership = ref<ClassMembershipDetailRow | null>(null)
const showStartDateEdit = ref(false)
const startDateEditBusy = ref(false)
const startDateEditError = ref('')
const startDateForm = ref({ start_date: '' })
const endingMembership = ref<ClassMembershipDetailRow | null>(null)
const confirmEnd = ref(false)
const confirmBusy = ref(false)
const localDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const membershipForm = ref({ student_id: '', start_date: localDate() })
const availableStudents = computed(() => students.value.filter((student) => !memberships.value.some((row) => row.student_id === student.id)))
const startDateEditDirty = computed(() => Boolean(editingMembership.value && startDateForm.value.start_date !== editingMembership.value.start_date))
const startDateEditInvalid = computed(() => Boolean(
  !startDateForm.value.start_date
  || (editingMembership.value?.end_date && startDateForm.value.start_date > editingMembership.value.end_date),
))

function membershipStartDateErrorMessage(error: unknown): string {
  const value = error && typeof error === 'object' ? error as { message?: unknown; details?: unknown } : {}
  if (value.message === 'MEMBERSHIP_ROSTER_SYNC_CONFLICT') {
    let detail: Record<string, unknown> = {}
    if (typeof value.details === 'string') {
      try { detail = JSON.parse(value.details) as Record<string, unknown> } catch { detail = {} }
    } else if (value.details && typeof value.details === 'object') {
      detail = value.details as Record<string, unknown>
    }
    const date = typeof detail.session_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(detail.session_date)
      ? detail.session_date
      : null
    const reason = detail.reason === 'ROOM_REQUIRED_FOR_OVERLAP'
      ? 'cần khai báo phòng cho cả hai buổi trùng giờ'
      : detail.reason === 'ROOM_ALREADY_BOOKED'
        ? 'phòng đã có buổi học khác trong cùng khung giờ'
        : 'học sinh hoặc lớp có buổi học trùng giờ'
    return `Không thể đồng bộ buổi${date ? ` ngày ${date}` : ''}: ${reason}. Ngày bắt đầu và các roster đã được giữ nguyên.`
  }
  return userErrorMessage(error, 'Không thể sửa ngày bắt đầu. Ngày và roster buổi học được giữ nguyên.')
}

function membershipAddErrorMessage(error: unknown): string {
  const value = error && typeof error === 'object'
    ? error as { code?: unknown; details?: unknown }
    : {}
  if (value.code === 'MEMBERSHIP_ROSTER_SYNC_CONFLICT') {
    let detail: Record<string, unknown> = {}
    if (typeof value.details === 'string') {
      try { detail = JSON.parse(value.details) as Record<string, unknown> } catch { detail = {} }
    } else if (value.details && typeof value.details === 'object') {
      detail = value.details as Record<string, unknown>
    }
    const date = typeof detail.session_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(detail.session_date)
      ? detail.session_date
      : null
    const reason = detail.reason === 'ROOM_REQUIRED_FOR_OVERLAP'
      ? 'cần khai báo phòng cho hai buổi trùng giờ'
      : detail.reason === 'ROOM_ALREADY_BOOKED'
        ? 'phòng đã có lịch khác trong khung giờ'
        : 'học sinh có buổi học khác trùng giờ'
    return `Không thể thêm học sinh: buổi${date ? ` ngày ${date}` : ''} ${reason}. Membership và roster chưa được thay đổi.`
  }
  return userErrorMessage(error, 'Không thể thêm học sinh vào lớp.')
}

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
    const result = await addClassMembership({ class_id: classId.value, student_id: membershipForm.value.student_id, start_date: membershipForm.value.start_date })
    membershipForm.value = { student_id: '', start_date: localDate() }
    membershipBusy.value = false
    showMembership.value = false
    membershipDirty.value = false
    const skipped = result.sessions_skipped_with_attendance
    toast.success(`Đã thêm học sinh vào lớp và đồng bộ ${result.sessions_updated} buổi còn lại trong tháng${skipped ? `; giữ nguyên ${skipped} buổi có attendance` : ''}.`)
    await load()
  } catch (error) { errorMessage.value = membershipAddErrorMessage(error) }
  finally { membershipBusy.value = false }
}

function editMembershipStartDate(row: ClassMembershipDetailRow) {
  editingMembership.value = row
  startDateForm.value = { start_date: row.start_date }
  startDateEditError.value = ''
  showStartDateEdit.value = true
}

async function saveMembershipStartDate() {
  const row = editingMembership.value
  if (!row || !startDateEditDirty.value || startDateEditInvalid.value || startDateEditBusy.value) return
  startDateEditError.value = ''
  startDateEditBusy.value = true
  try {
    const result = await updateClassMembershipStartDateAndSyncFutureRosters({
      membership_id: row.id,
      start_date: startDateForm.value.start_date,
    })
    showStartDateEdit.value = false
    editingMembership.value = null
    const skipped = result.sessions_skipped_with_attendance
    toast.success(
      `Đã sửa ngày bắt đầu. Đồng bộ ${result.sessions_updated} buổi tương lai (thêm ${result.students_added}, gỡ ${result.students_removed} học sinh); giữ nguyên ${skipped} buổi có attendance.`,
    )
    await load()
  } catch (error) {
    startDateEditError.value = membershipStartDateErrorMessage(error)
  } finally {
    startDateEditBusy.value = false
  }
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
              <td class="text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-2" type="button" @click="editMembershipStartDate(membership)">Sửa ngày</button>
                <button class="btn btn-sm btn-outline-danger" type="button" @click="endMembership(membership)">Kết thúc</button>
              </td>
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
  <FormModal
    v-model="showStartDateEdit"
    title="Sửa ngày bắt đầu"
    :description="`Cập nhật ngày bắt đầu xếp lớp của ${editingMembership?.students?.full_name || 'học sinh'}. Các buổi SCHEDULED chưa bắt đầu trong lớp này sẽ đồng bộ roster theo ngày mới.`"
    :busy="startDateEditBusy"
    :dirty="startDateEditDirty"
    :submit-disabled="!startDateEditDirty || startDateEditInvalid"
    submit-label="Lưu ngày bắt đầu"
    @submit="saveMembershipStartDate"
    @cancel="showStartDateEdit = false"
  >
    <div class="row g-3" @change="startDateEditError = ''">
      <AppField id="membership-edit-start" class="col-12" label="Ngày bắt đầu" required>
        <template #default="field"><input :id="field.id" v-model="startDateForm.start_date" :max="editingMembership?.end_date || undefined" type="date" class="form-control" required data-modal-autofocus /></template>
      </AppField>
    </div>
    <div class="alert alert-info mt-3 mb-0" role="note">
      Buổi đã có attendance được giữ nguyên. Nếu roster tương lai phát sinh xung đột lịch hoặc phòng, toàn bộ thay đổi sẽ được hoàn tác.
    </div>
    <div v-if="startDateEditInvalid && startDateForm.start_date" class="alert alert-danger mt-3 mb-0" role="alert">
      Ngày bắt đầu không được sau ngày kết thúc xếp lớp hiện có.
    </div>
    <div v-if="startDateEditError" class="alert alert-danger mt-3 mb-0" role="alert">{{ startDateEditError }}</div>
  </FormModal>
  <ConfirmModal v-model="confirmEnd" title="Kết thúc xếp lớp?" :message="`Membership của ${endingMembership?.students?.full_name || 'học sinh'} sẽ kết thúc từ hôm nay. Lịch sử các buổi học vẫn được giữ.`" :item-name="classRow?.name || ''" warning="Thao tác này chỉ kết thúc quan hệ hiện hành; dữ liệu lịch sử không bị xóa." confirm-label="Kết thúc xếp lớp" destructive :busy="confirmBusy" @confirm="confirmEndMembership" />
</template>
