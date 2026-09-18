<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getClassActiveMemberships, getClassDetail, getClassMonthScheduleDetails, getClassMonthScheduleStaffDetails, getClassMonthStaff, getClassMonthStudents, getClassMonthsForClass } from '@/services/data-queries'
import type { ClassDetailRow, ClassMembershipDetailRow, ClassMonthDetailRow, ClassMonthScheduleDetailRow, ClassMonthScheduleStaffDetailRow, ClassMonthStaffDetailRow, ClassMonthStudentDetailRow } from '@/shared/types/domain'
import { usePermissionStore } from '@/stores/permission.store'

const route = useRoute()
const permissions = usePermissionStore()
const classId = computed(() => String(route.params.classId || ''))
const classRow = ref<ClassDetailRow | null>(null)
const months = ref<ClassMonthDetailRow[]>([])
const selectedMonthId = ref('')
const memberships = ref<ClassMembershipDetailRow[]>([])
const snapshotStudents = ref<ClassMonthStudentDetailRow[]>([])
const staffRows = ref<ClassMonthStaffDetailRow[]>([])
const schedules = ref<ClassMonthScheduleDetailRow[]>([])
const scheduleStaff = ref<ClassMonthScheduleStaffDetailRow[]>([])
const loading = ref(false)
const monthLoading = ref(false)
const errorMessage = ref('')

const canViewStudents = computed(() => permissions.can('STUDENTS_VIEW'))
const canViewStaff = computed(() => permissions.can('STAFF_VIEW'))
const selectedMonth = computed(() => months.value.find((month) => month.id === selectedMonthId.value) || null)
const selectedMonthLabel = computed(() => selectedMonth.value ? `${String(selectedMonth.value.month).padStart(2, '0')}/${selectedMonth.value.year}` : 'Chưa có ClassMonth')
const rosterRows = computed(() => memberships.value.map((membership) => ({ ...membership, student: membership.students, snapshot: snapshotStudents.value.find((snapshot) => snapshot.student_id === membership.student_id) })))
const teachers = computed(() => staffRows.value.filter((row) => row.assignment_role === 'TEACHER'))
const assistants = computed(() => staffRows.value.filter((row) => row.assignment_role === 'ASSISTANT'))

function dayLabel(day: number) { return day === 7 ? 'Chủ nhật' : `Thứ ${day + 1}` }
function statusLabel(status: string) { return status === 'ACTIVE' ? 'Đang hoạt động' : status === 'DRAFT' ? 'Bản nháp' : status === 'ARCHIVED' ? 'Đã lưu trữ' : status === 'COMPLETED' ? 'Đã hoàn thành' : status === 'SCHEDULED' ? 'Đã lên lịch' : status }
function scheduleStaffLabel(scheduleId: string) {
  const rows = scheduleStaff.value.filter((row) => row.schedule_id === scheduleId)
  if (!rows.length) return 'Chưa phân công theo slot'
  return rows.map((row) => `${row.staff?.full_name || '—'} (${row.assignment_role === 'TEACHER' ? 'GV' : 'TG'})`).join(', ')
}

async function loadSelectedMonth() {
  staffRows.value = []
  schedules.value = []
  scheduleStaff.value = []
  snapshotStudents.value = []
  if (!selectedMonthId.value) return
  monthLoading.value = true
  try {
    const requests: Array<Promise<unknown>> = []
    if (canViewStaff.value) {
      requests.push(getClassMonthStaff(selectedMonthId.value), getClassMonthScheduleDetails(selectedMonthId.value), getClassMonthScheduleStaffDetails(selectedMonthId.value))
    }
    if (canViewStudents.value) requests.push(getClassMonthStudents(selectedMonthId.value))
    const results = await Promise.all(requests)
    let index = 0
    if (canViewStaff.value) {
      staffRows.value = results[index++] as ClassMonthStaffDetailRow[]
      schedules.value = results[index++] as ClassMonthScheduleDetailRow[]
      scheduleStaff.value = results[index++] as ClassMonthScheduleStaffDetailRow[]
    }
    if (canViewStudents.value) snapshotStudents.value = results[index] as ClassMonthStudentDetailRow[]
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải dữ liệu ClassMonth'
  } finally {
    monthLoading.value = false
  }
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  classRow.value = null
  memberships.value = []
  selectedMonthId.value = ''
  months.value = []
  try {
    const [detail, classMonths] = await Promise.all([getClassDetail(classId.value), getClassMonthsForClass(classId.value)])
    if (!detail) throw new Error('Không tìm thấy lớp học')
    classRow.value = detail
    months.value = classMonths
    if (!months.value.some((month) => month.id === selectedMonthId.value)) selectedMonthId.value = months.value[0]?.id || ''
    const requests: Array<Promise<unknown>> = []
    if (canViewStudents.value) requests.push(getClassActiveMemberships(classId.value))
    const results = await Promise.all(requests)
    let index = 0
    if (canViewStudents.value) memberships.value = results[index++] as ClassMembershipDetailRow[]
    await loadSelectedMonth()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải chi tiết lớp'
  } finally {
    loading.value = false
  }
}

watch(classId, () => { void load() })
onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
    <div>
      <RouterLink to="/admin/classes" class="small text-decoration-none">← Danh sách lớp</RouterLink>
      <div class="small text-secondary mt-2">Class detail</div>
      <h1 class="h3 mb-1">{{ classRow?.name || 'Chi tiết lớp' }}</h1>
      <div v-if="classRow" class="text-secondary"><code>{{ classRow.code }}</code> · {{ classRow.subjects?.name || '—' }} · {{ classRow.grades?.name || '—' }}</div>
    </div>
    <span v-if="classRow" class="badge text-bg-success">{{ statusLabel(classRow.status) }}</span>
  </div>

  <div v-if="loading" class="alert alert-info">Đang tải thông tin lớp…</div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

  <template v-if="classRow">
    <div class="row g-3 mb-4">
      <div class="col-6 col-xl-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Tên lớp</div><div class="fw-semibold mt-2">{{ classRow.name }}</div><small class="text-secondary">{{ classRow.code }}</small></div></div></div>
      <div class="col-6 col-xl-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Số học sinh đang học</div><div class="h4 mt-2 mb-0">{{ canViewStudents ? memberships.length : '—' }}</div><small class="text-secondary">Membership ACTIVE</small></div></div></div>
      <div class="col-6 col-xl-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">ClassMonth đang xem</div><div class="fw-semibold mt-2">{{ selectedMonthLabel }}</div><small v-if="selectedMonth">{{ statusLabel(selectedMonth.status) }}</small><small v-else class="text-secondary">Chưa tạo tháng</small></div></div></div>
      <div class="col-6 col-xl-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Chính sách sĩ số</div><div class="fw-semibold mt-2">{{ classRow.capacity_policy === 'UNLIMITED' ? 'Không giới hạn' : classRow.max_students }}</div><small class="text-secondary">Theo cấu hình lớp</small></div></div></div>
    </div>

    <div class="card border-0 shadow-sm mb-4"><div class="card-body"><div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3"><div><h2 class="h6 mb-1">Phân công giáo viên và trợ giảng</h2><small class="text-secondary">Theo ClassMonth và từng slot lịch</small></div><div v-if="months.length" class="col-12 col-md-4"><label class="form-label small">ClassMonth</label><select v-model="selectedMonthId" class="form-select" @change="loadSelectedMonth"><option v-for="month in months" :key="month.id" :value="month.id">{{ String(month.month).padStart(2, '0') }}/{{ month.year }} — {{ statusLabel(month.status) }}</option></select></div></div><div v-if="!canViewStaff" class="alert alert-warning mb-0">Bạn chưa có quyền <code>STAFF_VIEW</code> để xem phân công nhân sự.</div><div v-else-if="monthLoading" class="text-secondary small">Đang tải phân công…</div><div v-else-if="!selectedMonth" class="text-secondary small">Lớp chưa có ClassMonth.</div><div v-else><div class="row g-3 mb-3"><div class="col-md-6"><div class="border rounded p-3 h-100"><div class="small text-secondary mb-2">Giáo viên</div><div v-if="teachers.length" v-for="row in teachers" :key="row.id" class="d-flex justify-content-between border-bottom py-2 small"><span>{{ row.staff?.full_name || '—' }}</span><code>{{ row.staff?.staff_code || '—' }}</code></div><div v-else class="small text-secondary">Chưa phân công giáo viên.</div></div></div><div class="col-md-6"><div class="border rounded p-3 h-100"><div class="small text-secondary mb-2">Trợ giảng</div><div v-if="assistants.length" v-for="row in assistants" :key="row.id" class="d-flex justify-content-between border-bottom py-2 small"><span>{{ row.staff?.full_name || '—' }}</span><code>{{ row.staff?.staff_code || '—' }}</code></div><div v-else class="small text-secondary">Không có trợ giảng.</div></div></div></div><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Slot</th><th>Phòng</th><th>Phân công</th></tr></thead><tbody><tr v-for="schedule in schedules" :key="schedule.id"><td>{{ dayLabel(schedule.day_of_week) }} · {{ String(schedule.start_time).slice(0, 5) }}–{{ String(schedule.end_time).slice(0, 5) }}</td><td>{{ schedule.room ? `Phòng ${schedule.room}` : '—' }}</td><td class="small">{{ scheduleStaffLabel(schedule.id) }}</td></tr><tr v-if="!schedules.length"><td colspan="3" class="text-secondary">Chưa có lịch học.</td></tr></tbody></table></div></div></div></div>

    <div class="card border-0 shadow-sm mb-4"><div class="card-body"><div class="d-flex justify-content-between align-items-center gap-2 mb-3"><div><h2 class="h6 mb-1">Học sinh</h2><small class="text-secondary">{{ canViewStudents ? `${rosterRows.length} học sinh đang có membership ACTIVE` : 'Danh sách học sinh' }}</small></div><span v-if="canViewStudents && selectedMonth" class="badge text-bg-light">Snapshot {{ snapshotStudents.length }}</span></div><div v-if="!canViewStudents" class="alert alert-warning mb-0">Bạn chưa có quyền <code>STUDENTS_VIEW</code> để xem hồ sơ học sinh.</div><template v-else><div v-if="selectedMonth && snapshotStudents.length !== rosterRows.length" class="alert alert-info small">Sĩ số membership hiện tại và snapshot tháng đang khác nhau: {{ rosterRows.length }} / {{ snapshotStudents.length }}.</div><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Mã</th><th>Họ tên</th><th>Liên hệ</th><th>Phụ huynh</th><th>Membership</th><th></th></tr></thead><tbody><tr v-for="row in rosterRows" :key="row.id"><td><code>{{ row.student?.student_code }}</code></td><td class="fw-semibold">{{ row.student?.full_name }}</td><td>{{ row.student?.phone || row.student?.email || '—' }}</td><td>{{ row.student?.parent_name || '—' }}</td><td class="small">{{ row.start_date }}<span v-if="row.end_date"> → {{ row.end_date }}</span></td><td><RouterLink class="btn btn-sm btn-outline-primary" :to="`/admin/classes/${classId}/students/${row.student_id}`">Chi tiết</RouterLink></td></tr><tr v-if="!rosterRows.length"><td colspan="6" class="text-center text-secondary py-4">Lớp chưa có membership ACTIVE.</td></tr></tbody></table></div></template></div></div>

  </template>
</template>
