<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { addClassMembership, addTeacherToClassSchedule, createClassSchedule, generateUpcomingSessions, removeTeacherFromClassSchedule, setClassScheduleStatus, updateClassMembership, updateClassSchedule } from '@/services/commands'
import { getClassActiveMemberships, getClassDetail, getClassSchedules, getStaff, getStudents } from '@/services/data-queries'
import type { ClassDetailRow, ClassMembershipDetailRow, ClassScheduleRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'

const route = useRoute()
const classId = computed(() => String(route.params.classId || ''))
const classRow = ref<ClassDetailRow | null>(null)
const memberships = ref<ClassMembershipDetailRow[]>([])
const schedules = ref<ClassScheduleRow[]>([])
const students = ref<any[]>([])
const teachers = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const localDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const membershipForm = ref({ student_id: '', start_date: localDate() })
const scheduleForm = ref({ day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '', staff_id: '' })
const teacherSelections = ref<Record<string, string>>({})
const editingScheduleId = ref('')
const editSchedule = ref({ day_of_week: 1, start_time: '', end_time: '', room: '' })
const availableStudents = computed(() => students.value.filter((student) => !memberships.value.some((row) => row.student_id === student.id)))
const activeRosterReady = computed(() => memberships.value.some((row) => !row.end_date || row.end_date >= localDate()))

function dayLabel(day: number) { return day === 7 ? 'Chủ nhật' : `Thứ ${day + 1}` }
function normalizeRelation(value: any) { return Array.isArray(value) ? value[0] : value }

async function load() {
  if (!classId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [detail, currentMemberships, classSchedules, allStudents, staffRows] = await Promise.all([
      getClassDetail(classId.value), getClassActiveMemberships(classId.value), getClassSchedules(classId.value), getStudents(), getStaff(),
    ])
    if (!detail) throw new Error('Không tìm thấy lớp học')
    classRow.value = detail
    memberships.value = currentMemberships
    schedules.value = classSchedules
    students.value = allStudents as any[]
    teachers.value = (staffRows as any[]).filter((row) => row.status === 'ACTIVE')
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
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể thêm học sinh vào lớp' }
}

async function endMembership(row: ClassMembershipDetailRow) {
  const today = localDate()
  if (!window.confirm(`Kết thúc việc học lớp này của ${row.students?.full_name || 'học sinh'} từ hôm nay? Lịch sử buổi học vẫn được giữ.`)) return
  try {
    await updateClassMembership(row.id, { start_date: row.start_date, end_date: row.start_date > today ? null : today, status: 'INACTIVE' })
    successMessage.value = 'Đã kết thúc xếp lớp.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật xếp lớp' }
}

async function createSchedule() {
  errorMessage.value = ''; successMessage.value = ''
  try {
    const created = await createClassSchedule({ class_id: classId.value, day_of_week: scheduleForm.value.day_of_week, start_time: scheduleForm.value.start_time, end_time: scheduleForm.value.end_time, room: scheduleForm.value.room.trim() || null })
    if (scheduleForm.value.staff_id) await addTeacherToClassSchedule(created.id, scheduleForm.value.staff_id)
    scheduleForm.value = { day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '', staff_id: '' }
    successMessage.value = 'Đã lưu lịch nháp. Kiểm tra sĩ số và giáo viên, sau đó bật lịch để bắt đầu tự sinh buổi học.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu lịch' }
}

async function toggleSchedule(row: ClassScheduleRow) {
  errorMessage.value = ''; successMessage.value = ''
  if (row.status !== 'ACTIVE' && (!activeRosterReady.value || !row.class_schedule_staff?.some((mapping) => teachers.value.some((teacher) => teacher.id === mapping.staff_id)))) {
    errorMessage.value = 'Hãy xác nhận danh sách học sinh và phân công ít nhất một giáo viên trước khi bật lịch.'
    return
  }
  try {
    await setClassScheduleStatus(row.id, row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
    successMessage.value = row.status === 'ACTIVE' ? 'Đã tạm dừng lịch và sinh lại các buổi sắp tới.' : 'Đã xác nhận lịch và sinh buổi học trong 30 ngày tới.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật lịch' }
}

function beginEdit(row: ClassScheduleRow) {
  editingScheduleId.value = row.id
  editSchedule.value = { day_of_week: row.day_of_week, start_time: String(row.start_time).slice(0, 5), end_time: String(row.end_time).slice(0, 5), room: row.room || '' }
}

async function saveSchedule(row: ClassScheduleRow) {
  try {
    await updateClassSchedule(row.id, { ...editSchedule.value, room: editSchedule.value.room.trim() || null })
    successMessage.value = 'Đã cập nhật lịch và các buổi sắp tới.'
    editingScheduleId.value = ''
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật lịch' }
}

async function addTeacher(row: ClassScheduleRow) {
  const staffId = teacherSelections.value[row.id]
  if (!staffId) return
  try {
    await addTeacherToClassSchedule(row.id, staffId)
    teacherSelections.value[row.id] = ''
    successMessage.value = 'Đã phân công giáo viên.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể phân công giáo viên' }
}

async function removeTeacher(row: ClassScheduleRow, staffId: string) {
  try {
    await removeTeacherFromClassSchedule(row.id, staffId)
    successMessage.value = 'Đã gỡ phân công giáo viên.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể gỡ phân công giáo viên' }
}

async function generateNow() {
  try {
    const result = await generateUpcomingSessions() as { created?: number; cancelled?: number }
    successMessage.value = `Đã cập nhật lịch sắp tới. Tạo ${result.created || 0} buổi; hủy ${result.cancelled || 0} buổi không còn khớp lịch.`
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể sinh buổi học' }
}

watch(classId, () => { void load() })
onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
    <div><RouterLink to="/admin/classes" class="small text-decoration-none">← Danh sách lớp</RouterLink><div class="small text-secondary mt-2">Lớp học</div><h1 class="h3 mb-1">{{ classRow?.name || 'Chi tiết lớp' }}</h1><div v-if="classRow" class="text-secondary"><code>{{ classRow.code }}</code> · {{ classRow.subjects?.name || '—' }} · {{ classRow.grades?.name || '—' }}</div></div>
    <button class="btn btn-outline-primary" @click="generateNow">Cập nhật buổi 30 ngày tới</button>
  </div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div><div v-if="loading" class="alert alert-info">Đang tải lớp…</div>

  <div class="card border-0 shadow-sm mb-4"><div class="card-body">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 class="h6 mb-1">Học sinh trong lớp</h2><small class="text-secondary">Danh sách áp dụng liên tục theo ngày bắt đầu và kết thúc.</small></div><span class="badge text-bg-light">{{ memberships.length }} học sinh</span></div>
    <form class="row g-2 align-items-end mb-3" @submit.prevent="addStudent"><div class="col-md-6"><label class="form-label">Thêm học sinh</label><select v-model="membershipForm.student_id" class="form-select"><option value="">Chọn học sinh</option><option v-for="student in availableStudents" :key="student.id" :value="student.id">{{ student.student_code }} — {{ student.full_name }}</option></select></div><div class="col-md-3"><label class="form-label">Ngày bắt đầu</label><input v-model="membershipForm.start_date" type="date" class="form-control" required /></div><div class="col-md-3"><button class="btn btn-primary w-100" :disabled="!membershipForm.student_id">Thêm vào lớp</button></div></form>
    <div class="table-responsive"><table class="table align-middle"><thead><tr><th>Mã</th><th>Học sinh</th><th>Điện thoại</th><th>Bắt đầu</th><th>Thao tác</th></tr></thead><tbody><tr v-for="membership in memberships" :key="membership.id"><td><code>{{ membership.students?.student_code }}</code></td><td><RouterLink :to="`/admin/students/${membership.student_id}`">{{ membership.students?.full_name }}</RouterLink></td><td>{{ membership.students?.phone || '—' }}</td><td>{{ membership.start_date }}</td><td><button class="btn btn-sm btn-outline-danger" @click="endMembership(membership)">Kết thúc</button></td></tr><tr v-if="!memberships.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có học sinh trong lớp.</td></tr></tbody></table></div>
  </div></div>

  <div class="card border-0 shadow-sm"><div class="card-body">
    <div class="mb-3"><h2 class="h6 mb-1">Lịch lặp và giáo viên</h2><small class="text-secondary">Lịch chuyển từ cấu hình cũ cần được Admin rà soát và bật một lần.</small></div>
    <form class="row g-2 align-items-end border rounded p-3 mb-4" @submit.prevent="createSchedule"><div class="col-sm-2"><label class="form-label">Ngày</label><select v-model.number="scheduleForm.day_of_week" class="form-select"><option v-for="day in 7" :key="day" :value="day">{{ dayLabel(day) }}</option></select></div><div class="col-sm-2"><label class="form-label">Bắt đầu</label><input v-model="scheduleForm.start_time" type="time" class="form-control" required /></div><div class="col-sm-2"><label class="form-label">Kết thúc</label><input v-model="scheduleForm.end_time" type="time" class="form-control" required /></div><div class="col-sm-2"><label class="form-label">Phòng</label><input v-model="scheduleForm.room" class="form-control" /></div><div class="col-sm-3"><label class="form-label">Giáo viên</label><select v-model="scheduleForm.staff_id" class="form-select"><option value="">Chọn giáo viên</option><option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.full_name }}</option></select></div><div class="col-sm-1"><button class="btn btn-primary w-100">Lưu</button></div></form>
    <div v-for="schedule in schedules" :key="schedule.id" class="border rounded p-3 mb-3">
      <div v-if="editingScheduleId !== schedule.id" class="d-flex flex-wrap justify-content-between gap-2"><div><div class="fw-semibold">{{ dayLabel(schedule.day_of_week) }} · {{ String(schedule.start_time).slice(0, 5) }}–{{ String(schedule.end_time).slice(0, 5) }} · {{ schedule.room ? `Phòng ${schedule.room}` : 'Chưa có phòng' }}</div><span class="badge mt-1" :class="schedule.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-warning'">{{ schedule.status === 'ACTIVE' ? 'Đang sinh buổi' : 'Chờ Admin rà soát' }}</span><span v-if="schedule.reviewed_at" class="small text-secondary ms-2">Duyệt {{ formatDateTime(schedule.reviewed_at) }}</span><div class="d-flex flex-wrap gap-2 mt-2"> <span v-for="mapping in schedule.class_schedule_staff || []" :key="mapping.staff_id" class="badge text-bg-light">{{ normalizeRelation(mapping.staff)?.full_name || 'Giáo viên' }} <button class="btn-close ms-1" aria-label="Gỡ giáo viên" @click="removeTeacher(schedule, mapping.staff_id)"></button></span><span v-if="!schedule.class_schedule_staff?.length" class="small text-danger">Chưa phân công giáo viên.</span></div></div><div class="d-flex align-items-start gap-2"><button class="btn btn-sm btn-outline-secondary" @click="beginEdit(schedule)">Sửa</button><button class="btn btn-sm" :class="schedule.status === 'ACTIVE' ? 'btn-outline-warning' : 'btn-success'" @click="toggleSchedule(schedule)">{{ schedule.status === 'ACTIVE' ? 'Tạm dừng' : 'Rà soát và bật lịch' }}</button></div></div>
      <form v-else class="row g-2 align-items-end" @submit.prevent="saveSchedule(schedule)"><div class="col-sm-2"><label class="form-label">Ngày</label><select v-model.number="editSchedule.day_of_week" class="form-select"><option v-for="day in 7" :key="day" :value="day">{{ dayLabel(day) }}</option></select></div><div class="col-sm-2"><label class="form-label">Bắt đầu</label><input v-model="editSchedule.start_time" type="time" class="form-control" /></div><div class="col-sm-2"><label class="form-label">Kết thúc</label><input v-model="editSchedule.end_time" type="time" class="form-control" /></div><div class="col-sm-3"><label class="form-label">Phòng</label><input v-model="editSchedule.room" class="form-control" /></div><div class="col-sm-3 d-flex gap-2"><button class="btn btn-success">Lưu</button><button type="button" class="btn btn-outline-secondary" @click="editingScheduleId = ''">Hủy</button></div></form>
      <form class="row g-2 mt-2" @submit.prevent="addTeacher(schedule)"><div class="col-sm-8"><select v-model="teacherSelections[schedule.id]" class="form-select form-select-sm"><option value="">Thêm giáo viên vào slot</option><option v-for="teacher in teachers.filter((t) => !(schedule.class_schedule_staff || []).some((mapping) => mapping.staff_id === t.id))" :key="teacher.id" :value="teacher.id">{{ teacher.full_name }}</option></select></div><div class="col-sm-4"><button class="btn btn-sm btn-outline-primary" :disabled="!teacherSelections[schedule.id]">Phân công</button></div></form>
    </div>
    <div v-if="!schedules.length" class="text-center text-secondary py-4">Chưa có lịch lặp.</div>
  </div></div>
</template>
