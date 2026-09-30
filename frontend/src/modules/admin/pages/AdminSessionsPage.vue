<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  addTeacherToClassSchedule,
  applyWeekToMonth,
  createClassSchedule,
  createManualSession,
  removeTeacherFromClassSchedule,
  setClassScheduleStatus,
  updateClassSchedule,
  updateSessionOccurrence,
  updateSessionTeachers,
} from '@/services/commands'
import {
  getClassActiveRosterSize,
  getClassSchedules,
  getClasses,
  getMySessions,
  getSessionStudents,
  getStaff,
} from '@/services/data-queries'
import type { ClassDetailRow, ClassScheduleRow, SessionRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { canSelectClassTeacher, getClassTeacherIds, MAX_CLASS_TEACHERS, selectedTeacherCount } from '@/shared/utils/class-teacher-limit'
import { userErrorMessage } from '@/shared/utils/errors'
import {
  addCalendarDays,
  formatBusinessDate,
  formatBusinessMonth,
  formatBusinessTime,
  getBusinessDateKey,
  getMonthGridDateKeys,
  getWeekDateKeys,
  groupSessionsByBusinessDate,
  shiftCalendarMonth,
} from '@/shared/utils/session-calendar'

type ViewMode = 'month' | 'week' | 'list'

const weekdayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const route = useRoute()
const sessions = ref<SessionRow[]>([])
const classes = ref<ClassDetailRow[]>([])
const teachersList = ref<any[]>([])
const schedules = ref<ClassScheduleRow[]>([])
const schedulesByClass = ref<Record<string, ClassScheduleRow[]>>({})
const students = ref<any[]>([])
const selected = ref<SessionRow | null>(null)
const selectedTeacherIds = ref<string[]>([])
const selectedClassId = ref(typeof route.query.class_id === 'string' ? route.query.class_id : '')
const loading = ref(false)
const scheduleLoading = ref(false)
const sessionsLoaded = ref(false)
const scheduleLoadErrors = ref<Record<string, boolean>>({})
const errorMessage = ref('')
const successMessage = ref('')
const startInput = ref('')
const endInput = ref('')
const viewMode = ref<ViewMode>('month')
const calendarAnchorDate = ref(getBusinessDateKey(new Date()))
const todayDateKey = ref(getBusinessDateKey(new Date()))
const scheduleEditorOpen = ref(false)
const sessionFormOpen = ref(false)
const editingScheduleId = ref('')
const teacherSelections = ref<Record<string, string>>({})
const sessionForm = ref({ class_id: '', date: getBusinessDateKey(new Date()), start_time: '17:30', end_time: '19:30', staff_ids: [] as string[] })
const scheduleForm = ref({ day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '', staff_id: '' })
const editSchedule = ref({ day_of_week: 1, start_time: '', end_time: '', room: '' })
const teachers = computed(() => (selected.value?.session_staff || []).map((item) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công')
const activeTeachers = computed(() => teachersList.value.filter((row) => row.status === 'ACTIVE'))
const activeRosterReady = ref(false)
const selectedClassTeacherIds = computed(() => getClassTeacherIds(selectedClassId.value, Object.values(schedulesByClass.value).flat(), sessions.value))
const sessionFormTeacherBaseIds = computed(() => getClassTeacherIds(sessionForm.value.class_id, Object.values(schedulesByClass.value).flat(), sessions.value))
const sessionFormTeacherCount = computed(() => selectedTeacherCount(sessionFormTeacherBaseIds.value, sessionForm.value.staff_ids))
const selectedSessionTeacherBaseIds = computed(() => selected.value
  ? getClassTeacherIds(selected.value.class_id, Object.values(schedulesByClass.value).flat(), sessions.value, selected.value.id)
  : new Set<string>())
const selectedSessionTeacherCount = computed(() => selectedTeacherCount(selectedSessionTeacherBaseIds.value, selectedTeacherIds.value))

function refreshTodayDateKey() {
  todayDateKey.value = getBusinessDateKey(new Date())
  return todayDateKey.value
}

function toLocalInput(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

function fromLocalInput(value: string) {
  return new Date(`${value}:00+07:00`).toISOString()
}

const visibleSessions = computed(() => selectedClassId.value
  ? sessions.value.filter((session) => session.class_id === selectedClassId.value)
  : sessions.value)
const visibleSessionsByDate = computed(() => groupSessionsByBusinessDate(visibleSessions.value))
const monthDateKeys = computed(() => getMonthGridDateKeys(calendarAnchorDate.value))
const weekDateKeys = computed(() => getWeekDateKeys(calendarAnchorDate.value))
const visibleDateKeys = computed(() => viewMode.value === 'week' ? weekDateKeys.value : monthDateKeys.value)
const periodTitle = computed(() => viewMode.value === 'month'
  ? formatBusinessMonth(calendarAnchorDate.value)
  : `${formatBusinessDate(weekDateKeys.value[0])} – ${formatBusinessDate(weekDateKeys.value[6])}`)
const visibleCalendarSessionCount = computed(() => visibleDateKeys.value.reduce((total, dateKey) => total + (visibleSessionsByDate.value[dateKey]?.length || 0), 0))
const sourceWeekSessions = computed(() => {
  const dates = new Set(weekDateKeys.value)
  return visibleSessions.value.filter((session) => dates.has(getBusinessDateKey(session.scheduled_start_at))
    && session.status === 'SCHEDULED' && Date.parse(session.scheduled_start_at) > Date.now()
    && (session.session_staff || []).some((assignment) => assignment.assignment_role === 'TEACHER'))
})

function dayLabel(day: number) {
  return day === 7 ? 'Chủ nhật' : `Thứ ${day + 1}`
}

function weekdayForDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  return date.getUTCDay() === 0 ? 7 : date.getUTCDay()
}

function localDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).toISOString()
}

function className(session: SessionRow) {
  return session.classes?.name?.trim() || 'Chưa có tên lớp'
}

function sessionStatusClass(status: SessionRow['status']) {
  if (status === 'COMPLETED') return 'text-bg-success'
  if (status === 'CANCELLED') return 'text-bg-danger'
  if (status === 'IN_PROGRESS') return 'text-bg-primary'
  return 'text-bg-secondary'
}

function changePeriod(amount: number) {
  refreshTodayDateKey()
  calendarAnchorDate.value = viewMode.value === 'month'
    ? shiftCalendarMonth(calendarAnchorDate.value, amount)
    : addCalendarDays(calendarAnchorDate.value, amount * 7)
}

function goToToday() {
  calendarAnchorDate.value = refreshTodayDateKey()
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [sessionResult, classResult, staffResult] = await Promise.allSettled([
      getMySessions(),
      getClasses(),
      getStaff(),
    ])
    const loadErrors: string[] = []

    if (sessionResult.status === 'fulfilled') {
      sessions.value = sessionResult.value
      sessionsLoaded.value = true
      if (selected.value) {
        selected.value = sessions.value.find((session) => session.id === selected.value?.id) || null
        if (!selected.value) { students.value = []; selectedTeacherIds.value = [] }
      }
    } else {
      sessionsLoaded.value = false
      loadErrors.push(sessionResult.reason instanceof Error ? sessionResult.reason.message : 'Không thể tải buổi học.')
    }

    if (classResult.status === 'fulfilled') {
      classes.value = (classResult.value as ClassDetailRow[]).filter((row) => row.status !== 'ARCHIVED')
    } else {
      loadErrors.push(classResult.reason instanceof Error ? classResult.reason.message : 'Không thể tải danh sách lớp.')
    }

    if (staffResult.status === 'fulfilled') {
      teachersList.value = staffResult.value as any[]
    } else {
      loadErrors.push(staffResult.reason instanceof Error ? staffResult.reason.message : 'Không thể tải danh sách giáo viên.')
    }

    if (selectedClassId.value && !classes.value.some((row) => row.id === selectedClassId.value)) selectedClassId.value = ''
    errorMessage.value = loadErrors.join(' ')
  } finally {
    loading.value = false
  }
  await loadSchedules()
}

async function loadSchedules() {
  if (!selectedClassId.value) {
    schedules.value = []
    activeRosterReady.value = false
    return
  }
  scheduleLoading.value = true
  try {
    const [scheduleRows, memberships] = await Promise.all([
      getClassSchedules(selectedClassId.value),
      getClassActiveRosterSize(selectedClassId.value),
    ])
    schedules.value = scheduleRows
    schedulesByClass.value = { ...schedulesByClass.value, [selectedClassId.value]: scheduleRows }
    scheduleLoadErrors.value = { ...scheduleLoadErrors.value, [selectedClassId.value]: false }
    activeRosterReady.value = memberships > 0
  } catch (error) {
    scheduleLoadErrors.value = { ...scheduleLoadErrors.value, [selectedClassId.value]: true }
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải lịch lớp.'
  } finally {
    scheduleLoading.value = false
  }
}

async function loadClassSchedules(classId: string) {
  const rows = await getClassSchedules(classId)
  schedulesByClass.value = { ...schedulesByClass.value, [classId]: rows }
  scheduleLoadErrors.value = { ...scheduleLoadErrors.value, [classId]: false }
  if (selectedClassId.value === classId) schedules.value = rows
  return rows
}

function teacherCountKnown(classId: string) {
  return Boolean(classId) && sessionsLoaded.value
    && Object.prototype.hasOwnProperty.call(schedulesByClass.value, classId)
    && !scheduleLoadErrors.value[classId]
}

function teacherCountLabel(classId: string, selectedIds: string[] = [], excludeSessionId?: string) {
  if (!classId || !teacherCountKnown(classId)) return `—/${MAX_CLASS_TEACHERS}`
  const baseIds = getClassTeacherIds(classId, Object.values(schedulesByClass.value).flat(), sessions.value, excludeSessionId)
  return `${selectedTeacherCount(baseIds, selectedIds)}/${MAX_CLASS_TEACHERS}`
}

function canSelectCreateTeacher(teacherId: string) {
  return !teacherCountKnown(sessionForm.value.class_id)
    || canSelectClassTeacher(sessionFormTeacherBaseIds.value, sessionForm.value.staff_ids, teacherId)
}

function canSelectSessionTeacher(teacherId: string) {
  if (!selected.value || !teacherCountKnown(selected.value.class_id)) return true
  return canSelectClassTeacher(selectedSessionTeacherBaseIds.value, selectedTeacherIds.value, teacherId)
}

function canSelectScheduleTeacher(teacherId: string) {
  return !teacherCountKnown(selectedClassId.value)
    || canSelectClassTeacher(selectedClassTeacherIds.value, [], teacherId)
}

function teacherLimitMessage(error: unknown, fallback: string) {
  return userErrorMessage(error, fallback)
}

function changeClassFilter() {
  selected.value = null
  students.value = []
  selectedTeacherIds.value = []
  void loadSchedules()
}

async function selectSession(session: SessionRow) {
  selected.value = session
  selectedTeacherIds.value = (session.session_staff || []).map((item) => item.staff_id)
  startInput.value = toLocalInput(session.scheduled_start_at)
  endInput.value = toLocalInput(session.scheduled_end_at)
  errorMessage.value = ''
  const [studentsResult, schedulesResult] = await Promise.allSettled([
    getSessionStudents(session.id),
    loadClassSchedules(session.class_id),
  ])
  if (studentsResult.status === 'fulfilled') students.value = studentsResult.value as any[]
  else errorMessage.value = studentsResult.reason instanceof Error ? studentsResult.reason.message : 'Không thể tải chi tiết buổi học.'
  if (schedulesResult.status === 'rejected') {
    scheduleLoadErrors.value = { ...scheduleLoadErrors.value, [session.class_id]: true }
    if (!errorMessage.value) errorMessage.value = schedulesResult.reason instanceof Error ? schedulesResult.reason.message : 'Không thể tải phân công giáo viên của lớp.'
  }
}

function openSessionForm(dateKey?: string) {
  const selectedDate = dateKey || refreshTodayDateKey()
  sessionForm.value = {
    class_id: selectedClassId.value,
    date: selectedDate,
    start_time: '17:30',
    end_time: '19:30',
    staff_ids: [],
  }
  sessionFormOpen.value = true
  void loadCreateDefaults()
}

async function loadCreateDefaults() {
  sessionForm.value.staff_ids = []
  if (!sessionForm.value.class_id) return
  try {
    const rows = await loadClassSchedules(sessionForm.value.class_id)
    const day = weekdayForDate(sessionForm.value.date)
    const preferred = rows.find((row) => row.status === 'ACTIVE'
      && row.day_of_week === day
      && String(row.start_time).slice(0, 5) === sessionForm.value.start_time
      && String(row.end_time).slice(0, 5) === sessionForm.value.end_time)
    if (preferred) sessionForm.value.staff_ids = (preferred.class_schedule_staff || []).map((item) => item.staff_id)
  } catch {
    scheduleLoadErrors.value = { ...scheduleLoadErrors.value, [sessionForm.value.class_id]: true }
    // A teacher can still be selected manually if no active fixed schedule is available.
  }
}

async function createSession() {
  if (!sessionForm.value.class_id || !sessionForm.value.date || !sessionForm.value.start_time
    || !sessionForm.value.end_time || !sessionForm.value.staff_ids.length) {
    errorMessage.value = 'Hãy chọn lớp, giờ bắt đầu/kết thúc và ít nhất một giáo viên.'
    return
  }
  if (teacherCountKnown(sessionForm.value.class_id) && sessionFormTeacherCount.value > MAX_CLASS_TEACHERS) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  errorMessage.value = ''; successMessage.value = ''
  try {
    await createManualSession({
      class_id: sessionForm.value.class_id,
      start: localDateTime(sessionForm.value.date, sessionForm.value.start_time),
      end: localDateTime(sessionForm.value.date, sessionForm.value.end_time),
      staff_ids: sessionForm.value.staff_ids,
    })
    successMessage.value = 'Đã tạo buổi học.'
    sessionFormOpen.value = false
    await load()
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể tạo buổi học.') }
}

async function copyWeekToMonth() {
  const sourceIds = sourceWeekSessions.value.map((session) => session.id)
  if (!sourceIds.length) {
    errorMessage.value = 'Tuần này chưa có buổi SCHEDULED trong tương lai có giáo viên để làm mẫu.'
    return
  }
  const monthStart = `${calendarAnchorDate.value.slice(0, 7)}-01`
  if (!window.confirm(`Áp dụng ${sourceIds.length} buổi mẫu cho các ngày tương ứng trong tháng ${formatBusinessMonth(monthStart)}? Buổi trùng/xung đột sẽ làm cả đợt bị từ chối.`)) return
  errorMessage.value = ''; successMessage.value = ''
  try {
    const result = await applyWeekToMonth({ source_session_ids: sourceIds, month_start: monthStart }) as { created?: number }
    successMessage.value = `Đã tạo ${result.created || 0} buổi cụ thể cho tháng.`
    await load()
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể áp dụng tuần mẫu.') }
}

async function saveTeachers() {
  if (!selected.value || !selectedTeacherIds.value.length) {
    errorMessage.value = 'Mỗi buổi cần có ít nhất một giáo viên được phân công.'
    return
  }
  if (selected.value && teacherCountKnown(selected.value.class_id) && selectedSessionTeacherCount.value > MAX_CLASS_TEACHERS) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  errorMessage.value = ''; successMessage.value = ''
  try {
    await updateSessionTeachers({ session_id: selected.value.id, staff_ids: selectedTeacherIds.value })
    successMessage.value = 'Đã cập nhật giáo viên cho buổi học.'
    await load()
    const refreshed = sessions.value.find((row) => row.id === selected.value?.id)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể cập nhật giáo viên.') }
}

async function createSchedule() {
  if (!selectedClassId.value) return
  if (scheduleForm.value.staff_id && teacherCountKnown(selectedClassId.value)
    && !canSelectClassTeacher(selectedClassTeacherIds.value, [], scheduleForm.value.staff_id)) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  errorMessage.value = ''; successMessage.value = ''
  try {
    const created = await createClassSchedule({
      class_id: selectedClassId.value,
      day_of_week: scheduleForm.value.day_of_week,
      start_time: scheduleForm.value.start_time,
      end_time: scheduleForm.value.end_time,
      room: scheduleForm.value.room.trim() || null,
    })
    if (scheduleForm.value.staff_id) await addTeacherToClassSchedule(created.id, scheduleForm.value.staff_id)
    scheduleForm.value = { day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '', staff_id: '' }
    successMessage.value = 'Đã lưu lịch cố định ở trạng thái chờ rà soát.'
    await loadSchedules()
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể lưu lịch cố định.') }
}

async function toggleSchedule(row: ClassScheduleRow) {
  errorMessage.value = ''; successMessage.value = ''
  if (row.status !== 'ACTIVE' && (!activeRosterReady.value || !row.class_schedule_staff?.length)) {
    errorMessage.value = 'Hãy xác nhận danh sách học sinh và phân công ít nhất một giáo viên trước khi bật lịch.'
    return
  }
  try {
    await setClassScheduleStatus(row.id, row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
    successMessage.value = row.status === 'ACTIVE' ? 'Đã tạm dừng lịch lặp.' : 'Đã bật lịch lặp; buổi học sẽ được sinh trong 30 ngày tới.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật lịch.' }
}

function beginEditSchedule(row: ClassScheduleRow) {
  editingScheduleId.value = row.id
  editSchedule.value = {
    day_of_week: row.day_of_week,
    start_time: String(row.start_time).slice(0, 5),
    end_time: String(row.end_time).slice(0, 5),
    room: row.room || '',
  }
}

async function saveClassSchedule(row: ClassScheduleRow) {
  try {
    await updateClassSchedule(row.id, { ...editSchedule.value, room: editSchedule.value.room.trim() || null })
    successMessage.value = 'Đã cập nhật lịch cố định.'
    editingScheduleId.value = ''
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật lịch.' }
}

async function addScheduleTeacher(row: ClassScheduleRow) {
  const staffId = teacherSelections.value[row.id]
  if (!staffId) return
  if (teacherCountKnown(row.class_id) && !canSelectScheduleTeacher(staffId)) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  try {
    await addTeacherToClassSchedule(row.id, staffId)
    teacherSelections.value[row.id] = ''
    successMessage.value = 'Đã phân công giáo viên cố định.'
    await loadSchedules()
    await load()
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể phân công giáo viên.') }
}

async function removeScheduleTeacher(row: ClassScheduleRow, staffId: string) {
  try {
    await removeTeacherFromClassSchedule(row.id, staffId)
    successMessage.value = 'Đã gỡ giáo viên khỏi khung lịch.'
    await loadSchedules()
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể gỡ giáo viên.' }
}

async function archiveSchedule(row: ClassScheduleRow) {
  if (!window.confirm('Lưu trữ khung lịch này và hủy các buổi tương lai còn ở trạng thái SCHEDULED? Lịch sử đã diễn ra được giữ nguyên.')) return
  try {
    await setClassScheduleStatus(row.id, 'ARCHIVED')
    successMessage.value = 'Đã lưu trữ khung lịch và giữ nguyên lịch sử.'
    await load()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu trữ khung lịch.' }
}

async function saveSchedule() {
  if (!selected.value || !startInput.value || !endInput.value) return
  const sessionId = selected.value.id
  try {
    await updateSessionOccurrence({ session_id: sessionId, start: fromLocalInput(startInput.value), end: fromLocalInput(endInput.value) })
    successMessage.value = 'Đã đổi lịch buổi học.'
    await load()
    const refreshed = sessions.value.find((item) => item.id === sessionId)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể đổi lịch buổi học.' }
}

async function cancel() {
  if (!selected.value || !window.confirm(`Hủy buổi học ${formatDateTime(selected.value.scheduled_start_at)}?`)) return
  const sessionId = selected.value.id
  try {
    await updateSessionOccurrence({ session_id: sessionId, cancel: true })
    successMessage.value = 'Đã hủy buổi học.'
    await load()
    const refreshed = sessions.value.find((item) => item.id === sessionId)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể hủy buổi học.' }
}

onMounted(load)
watch(() => route.query.class_id, (value) => {
  selectedClassId.value = typeof value === 'string' ? value : ''
  changeClassFilter()
})
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
    <div><div class="small text-secondary">Học tập</div><h1 class="h3 mb-0">Buổi học</h1></div>
    <div class="d-flex flex-wrap gap-2">
      <button class="btn btn-primary" @click="scheduleEditorOpen = !scheduleEditorOpen">Chỉnh sửa lịch</button>
      <button class="btn btn-outline-primary" @click="openSessionForm()">Thêm buổi</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button>
    </div>
  </div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

  <div class="card border-0 shadow-sm mb-4">
    <div class="card-body d-flex flex-wrap align-items-end justify-content-between gap-3">
      <div class="flex-grow-1 class-filter">
        <label for="session-class-filter" class="form-label">Lọc theo lớp</label>
        <select id="session-class-filter" v-model="selectedClassId" class="form-select" @change="changeClassFilter">
          <option value="">Tất cả lớp</option>
          <option v-for="classRow in classes" :key="classRow.id" :value="classRow.id">{{ classRow.name }}</option>
        </select>
      </div>
      <div v-if="viewMode === 'week'" class="d-flex align-items-center gap-2">
        <span class="small text-secondary">{{ sourceWeekSessions.length }} buổi mẫu trong tuần</span>
        <button class="btn btn-outline-primary" :disabled="!sourceWeekSessions.length || loading" @click="copyWeekToMonth">
          Áp dụng tuần này cho tháng
        </button>
      </div>
    </div>
  </div>

  <div v-if="sessionFormOpen" class="card border-primary shadow-sm mb-4">
    <div class="card-header bg-primary-subtle fw-semibold">Tạo buổi học riêng</div>
    <form class="card-body row g-3 align-items-end session-create-form" @submit.prevent="createSession">
      <div class="col-md-4">
        <label class="form-label">Lớp</label>
        <select v-model="sessionForm.class_id" class="form-select" required @change="loadCreateDefaults">
          <option value="">Chọn lớp</option>
          <option v-for="classRow in classes.filter((row) => row.status === 'ACTIVE')" :key="classRow.id" :value="classRow.id">{{ classRow.name }}</option>
        </select>
      </div>
      <div class="col-md-2">
        <label class="form-label">Ngày</label>
        <input v-model="sessionForm.date" type="date" class="form-control" required @change="loadCreateDefaults" />
      </div>
      <div class="col-md-2">
        <label class="form-label">Giờ bắt đầu</label>
        <input v-model="sessionForm.start_time" type="time" class="form-control" required @change="loadCreateDefaults" />
      </div>
      <div class="col-md-2">
        <label class="form-label">Giờ kết thúc</label>
        <input v-model="sessionForm.end_time" type="time" class="form-control" required @change="loadCreateDefaults" />
      </div>
      <div class="col-md-6">
        <label class="form-label">Giáo viên được phân công ({{ teacherCountLabel(sessionForm.class_id, sessionForm.staff_ids) }})</label>
        <select v-model="sessionForm.staff_ids" class="form-select" multiple required size="3" aria-describedby="teacher-assignment-help">
          <option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id" :disabled="!canSelectCreateTeacher(teacher.id)">{{ teacher.full_name }}</option>
        </select>
        <div id="teacher-assignment-help" class="form-text">Giáo viên từ khung cố định phù hợp sẽ được chọn sẵn; có thể đổi riêng buổi này. Mỗi lớp tối đa {{ MAX_CLASS_TEACHERS }} giáo viên đang được phân công.</div>
      </div>
      <div class="col-12 d-flex gap-2">
        <button class="btn btn-primary" :disabled="loading || (teacherCountKnown(sessionForm.class_id) && sessionFormTeacherCount > MAX_CLASS_TEACHERS)">Tạo buổi</button>
        <button type="button" class="btn btn-outline-secondary" @click="sessionFormOpen = false">Đóng</button>
      </div>
    </form>
  </div>

  <div v-if="scheduleEditorOpen" class="card border-0 shadow-sm mb-4">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h2 class="h5 mb-1">Khung lịch cố định</h2>
          <div class="small text-secondary">Giáo viên trong khung thứ/giờ được kế thừa cho buổi sinh tự động. Lịch lưu trữ không xóa lịch sử đã diễn ra.</div>
        </div>
        <span v-if="selectedClassId" class="badge text-bg-primary">Giáo viên của lớp: {{ teacherCountLabel(selectedClassId) }}</span>
        <button class="btn btn-sm btn-outline-secondary" @click="scheduleEditorOpen = false">Đóng</button>
      </div>
      <div v-if="!selectedClassId" class="alert alert-info mb-0">Chọn một lớp ở bộ lọc để quản lý lịch cố định.</div>
      <template v-else>
        <div v-if="scheduleLoading" class="text-secondary py-3" role="status">Đang tải khung lịch…</div>
        <form class="row g-2 align-items-end border rounded p-3 mb-4 schedule-editor-form" @submit.prevent="createSchedule">
          <div class="col-sm-2"><label class="form-label">Ngày</label><select v-model.number="scheduleForm.day_of_week" class="form-select"><option v-for="day in 7" :key="day" :value="day">{{ dayLabel(day) }}</option></select></div>
          <div class="col-sm-2"><label class="form-label">Bắt đầu</label><input v-model="scheduleForm.start_time" type="time" class="form-control" required /></div>
          <div class="col-sm-2"><label class="form-label">Kết thúc</label><input v-model="scheduleForm.end_time" type="time" class="form-control" required /></div>
          <div class="col-sm-2"><label class="form-label">Phòng</label><input v-model="scheduleForm.room" class="form-control" /></div>
          <div class="col-sm-3"><label class="form-label">Giáo viên cố định ({{ teacherCountLabel(selectedClassId) }})</label><select v-model="scheduleForm.staff_id" class="form-select"><option value="">Chọn giáo viên</option><option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id" :disabled="!canSelectScheduleTeacher(teacher.id)">{{ teacher.full_name }}</option></select></div>
          <div class="col-sm-1"><button class="btn btn-primary w-100" :disabled="scheduleLoading">Lưu</button></div>
        </form>
        <div v-for="schedule in schedules" :key="schedule.id" class="border rounded p-3 mb-3">
          <div v-if="editingScheduleId !== schedule.id" class="d-flex flex-wrap justify-content-between gap-2">
            <div>
              <div class="fw-semibold">{{ dayLabel(schedule.day_of_week) }} · {{ String(schedule.start_time).slice(0, 5) }}–{{ String(schedule.end_time).slice(0, 5) }} · {{ schedule.room ? `Phòng ${schedule.room}` : 'Chưa có phòng' }}</div>
              <span class="badge mt-1" :class="schedule.status === 'ACTIVE' ? 'text-bg-success' : schedule.status === 'ARCHIVED' ? 'text-bg-secondary' : 'text-bg-warning'">{{ schedule.status === 'ACTIVE' ? 'Đang sinh buổi' : schedule.status === 'ARCHIVED' ? 'Đã lưu trữ' : 'Chờ Admin rà soát' }}</span>
              <div class="d-flex flex-wrap gap-2 mt-2">
                <span v-for="mapping in schedule.class_schedule_staff || []" :key="mapping.staff_id" class="badge text-bg-light">
                  {{ mapping.staff?.full_name || 'Giáo viên' }}
                  <button v-if="schedule.status !== 'ARCHIVED'" class="btn-close ms-1" aria-label="Gỡ giáo viên" @click="removeScheduleTeacher(schedule, mapping.staff_id)"></button>
                </span>
                <span v-if="!schedule.class_schedule_staff?.length" class="small text-danger">Chưa phân công giáo viên.</span>
              </div>
            </div>
            <div v-if="schedule.status !== 'ARCHIVED'" class="d-flex align-items-start gap-2">
              <button class="btn btn-sm btn-outline-secondary" @click="beginEditSchedule(schedule)">Sửa</button>
              <button class="btn btn-sm" :class="schedule.status === 'ACTIVE' ? 'btn-outline-warning' : 'btn-success'" @click="toggleSchedule(schedule)">{{ schedule.status === 'ACTIVE' ? 'Tạm dừng' : 'Rà soát và bật lịch' }}</button>
              <button class="btn btn-sm btn-outline-danger" @click="archiveSchedule(schedule)">Lưu trữ</button>
            </div>
          </div>
          <form v-else class="row g-2 align-items-end" @submit.prevent="saveClassSchedule(schedule)">
            <div class="col-sm-2"><label class="form-label">Ngày</label><select v-model.number="editSchedule.day_of_week" class="form-select"><option v-for="day in 7" :key="day" :value="day">{{ dayLabel(day) }}</option></select></div>
            <div class="col-sm-2"><label class="form-label">Bắt đầu</label><input v-model="editSchedule.start_time" type="time" class="form-control" required /></div>
            <div class="col-sm-2"><label class="form-label">Kết thúc</label><input v-model="editSchedule.end_time" type="time" class="form-control" required /></div>
            <div class="col-sm-3"><label class="form-label">Phòng</label><input v-model="editSchedule.room" class="form-control" /></div>
            <div class="col-sm-3 d-flex gap-2"><button class="btn btn-success">Lưu</button><button type="button" class="btn btn-outline-secondary" @click="editingScheduleId = ''">Hủy</button></div>
          </form>
          <form v-if="schedule.status !== 'ARCHIVED'" class="row g-2 mt-2" @submit.prevent="addScheduleTeacher(schedule)">
            <div class="col-sm-8"><select v-model="teacherSelections[schedule.id]" class="form-select form-select-sm"><option value="">Thêm giáo viên cố định vào khung</option><option v-for="teacher in activeTeachers.filter((row) => !(schedule.class_schedule_staff || []).some((mapping) => mapping.staff_id === row.id))" :key="teacher.id" :value="teacher.id" :disabled="!canSelectScheduleTeacher(teacher.id)">{{ teacher.full_name }}</option></select></div>
            <div class="col-sm-4"><button class="btn btn-sm btn-outline-primary" :disabled="!teacherSelections[schedule.id]">Phân công</button></div>
          </form>
        </div>
        <div v-if="!schedules.length" class="text-center text-secondary py-4">Chưa có khung lịch cố định.</div>
      </template>
    </div>
  </div>

  <div class="card border-0 shadow-sm mb-4">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div class="btn-group" role="group" aria-label="Chế độ hiển thị buổi học">
          <button class="btn" :class="viewMode === 'month' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'month'" @click="viewMode = 'month'">Tháng</button>
          <button class="btn" :class="viewMode === 'week' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'week'" @click="viewMode = 'week'">Tuần</button>
          <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'">Danh sách</button>
        </div>
        <div v-if="viewMode !== 'list'" class="d-flex flex-wrap align-items-center gap-2">
          <button class="btn btn-outline-secondary btn-sm" aria-label="Kỳ trước" @click="changePeriod(-1)">‹ Trước</button>
          <h2 class="h6 mb-0 text-capitalize text-center calendar-period-title">{{ periodTitle }}</h2>
          <button class="btn btn-outline-secondary btn-sm" aria-label="Kỳ sau" @click="changePeriod(1)">Sau ›</button>
          <button class="btn btn-outline-primary btn-sm" @click="goToToday">Hôm nay</button>
        </div>
      </div>
    </div>
  </div>

  <div class="row g-4 mb-4">
    <div :class="viewMode === 'list' ? 'col-12' : 'col-12'">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div v-if="viewMode === 'list'" class="session-list">
            <div v-if="loading" class="text-center text-secondary py-4" role="status">Đang tải buổi học…</div>
            <div v-else-if="!errorMessage && !visibleSessions.length" class="text-center text-secondary py-5">Chưa có buổi học.</div>
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead><tr><th>Ngày</th><th>Lớp</th><th>Thời gian</th><th>Giáo viên</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  <tr v-for="session in visibleSessions" :key="session.id" :class="selected?.id === session.id ? 'table-primary' : ''" role="button" tabindex="0" @click="selectSession(session)" @keydown.enter="selectSession(session)">
                    <td>{{ formatBusinessDate(getBusinessDateKey(session.scheduled_start_at)) }}</td>
                    <td class="fw-semibold">{{ className(session) }}</td>
                    <td>{{ formatBusinessTime(session.scheduled_start_at) }}–{{ formatBusinessTime(session.scheduled_end_at) }}</td>
                    <td>{{ (session.session_staff || []).map((item) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công' }}</td>
                    <td><span class="badge" :class="sessionStatusClass(session.status)">{{ session.status }}</span></td>
                  </tr>
                  <tr v-if="!errorMessage && !visibleSessions.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có buổi học.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else>
            <div class="calendar-scroll" :aria-label="viewMode === 'month' ? 'Lịch tháng' : 'Lịch tuần'">
              <div class="calendar-weekdays" aria-hidden="true">
                <div v-for="day in weekdayLabels" :key="day" class="calendar-weekday">{{ day }}</div>
              </div>

              <div class="calendar-grid" :class="viewMode === 'week' ? 'calendar-grid-week' : 'calendar-grid-month'">
                <section
                  v-for="dateKey in visibleDateKeys"
                  :key="dateKey"
                  class="calendar-day"
                  :class="{
                    'calendar-day-outside': viewMode === 'month' && dateKey.slice(0, 7) !== calendarAnchorDate.slice(0, 7),
                    'calendar-day-today': dateKey === todayDateKey,
                  }"
                  :aria-label="formatBusinessDate(dateKey)"
                >
                  <div class="calendar-day-heading">
                    <span class="calendar-day-number">{{ Number(dateKey.slice(-2)) }}</span>
                    <span v-if="dateKey === todayDateKey" class="badge text-bg-primary">Hôm nay</span>
                    <button class="btn btn-sm btn-outline-primary calendar-add-button" :aria-label="`Thêm buổi ngày ${formatBusinessDate(dateKey)}`" @click="openSessionForm(dateKey)">+</button>
                  </div>
                  <div class="calendar-day-events">
                  <button
                  v-for="session in visibleSessionsByDate[dateKey] || []"
                      :key="session.id"
                      class="calendar-event"
                      :class="{ 'calendar-event-selected': selected?.id === session.id }"
                      :aria-pressed="selected?.id === session.id"
                      :aria-label="`${formatBusinessTime(session.scheduled_start_at)} ${className(session)}, ${session.status}`"
                      @click="selectSession(session)"
                    >
                      <span class="calendar-event-time">{{ formatBusinessTime(session.scheduled_start_at) }}–{{ formatBusinessTime(session.scheduled_end_at) }}</span>
                      <span class="calendar-event-name">{{ className(session) }}</span>
                      <span class="badge align-self-start" :class="sessionStatusClass(session.status)">{{ session.status }}</span>
                    </button>
                  </div>
                </section>
              </div>
            </div>
            <div v-if="loading" class="text-center text-secondary py-3" role="status">Đang tải buổi học…</div>
            <div v-else-if="!errorMessage && !visibleCalendarSessionCount" class="text-center text-secondary py-3">
              {{ visibleSessions.length ? 'Không có buổi học trong khoảng thời gian này.' : 'Chưa có buổi học.' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-12">
      <div v-if="selected" class="card border-0 shadow-sm">
        <div class="card-body">
          <h2 class="h5">{{ className(selected) }}</h2>
          <div class="text-secondary mb-3">Giáo viên: {{ teachers }} · {{ selected.status }}</div>
          <div v-if="selected.status === 'SCHEDULED'" class="row g-2 align-items-end mb-3">
            <div class="col-md-8"><label class="form-label">Giáo viên được phân công cho buổi này ({{ teacherCountLabel(selected.class_id, selectedTeacherIds, selected.id) }})</label><select v-model="selectedTeacherIds" class="form-select" multiple size="3"><option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id" :disabled="!canSelectSessionTeacher(teacher.id)">{{ teacher.full_name }}</option></select></div>
            <div class="col-md-4"><button class="btn btn-outline-primary" :disabled="selectedSessionTeacherCount > MAX_CLASS_TEACHERS" @click="saveTeachers">Lưu phân công buổi này</button></div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-md-6"><label class="form-label">Bắt đầu</label><input v-model="startInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div>
            <div class="col-md-6"><label class="form-label">Kết thúc</label><input v-model="endInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div>
          </div>
          <div v-if="selected.status === 'SCHEDULED'" class="d-flex gap-2 mb-4">
            <button class="btn btn-primary btn-sm" @click="saveSchedule">Lưu lịch mới</button>
            <button class="btn btn-outline-danger btn-sm" @click="cancel">Hủy buổi học</button>
          </div>
          <p v-if="selected.session_note" class="border-start border-3 ps-3">{{ selected.session_note }}</p>
          <h3 class="h6 mt-3">Học sinh và kết quả</h3>
          <div v-for="row in students" :key="row.student_id" class="border rounded p-3 mb-2">
            <div class="fw-semibold">{{ row.students?.full_name }} <small class="text-secondary">{{ row.students?.student_code }}</small></div>
            <div class="small text-secondary">
              {{ row.student_attendances?.[0]?.status || 'Chưa điểm danh' }}
              <span v-if="row.student_attendances?.[0]?.absence_reason"> · {{ row.student_attendances[0].absence_reason }}</span>
              · BTVN {{ row.student_attendances?.[0]?.homework_score ?? '—' }}/10
              <span v-if="row.student_attendances?.[0]?.homework_note"> ({{ row.student_attendances[0].homework_note }})</span>
              · Hiểu bài {{ row.student_attendances?.[0]?.understanding_score ?? '—' }}/5
              · Thái độ {{ row.student_attendances?.[0]?.attitude_score ?? '—' }}/5
              · Điểm cộng {{ row.student_attendances?.[0]?.positive_feedback_count ?? 0 }}
              <span v-if="row.student_attendances?.[0]?.positive_feedback_raw"> · {{ row.student_attendances[0].positive_feedback_raw }}</span>
            </div>
            <div v-if="row.student_attendances?.[0]?.comment" class="small mt-1">{{ row.student_attendances[0].comment }}</div>
          </div>
          <div v-if="!students.length" class="text-secondary small">Buổi học chưa có danh sách học sinh.</div>
        </div>
      </div>
      <div v-else class="card border-0 shadow-sm">
        <div class="card-body text-center text-secondary py-5">Chọn một buổi học để xem chi tiết.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-period-title {
  min-width: 13rem;
}

.class-filter {
  min-width: min(100%, 18rem);
  max-width: 30rem;
}

.calendar-scroll {
  overflow-x: auto;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(115px, 1fr));
  min-width: 805px;
}

.calendar-weekday {
  padding: 0.5rem;
  color: var(--bs-secondary-color);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

.calendar-day {
  min-height: 8.25rem;
  padding: 0.45rem;
  overflow: hidden;
  border: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg);
}

.calendar-day-outside {
  color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg);
}

.calendar-day-today {
  box-shadow: inset 0 0 0 2px var(--bs-primary);
}

.calendar-day-heading {
  display: flex;
  min-height: 1.6rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
}

.calendar-day-number {
  font-weight: 600;
}

.calendar-add-button {
  width: 1.55rem;
  height: 1.55rem;
  padding: 0;
  line-height: 1;
}

.calendar-day-events {
  display: flex;
  max-height: 7.1rem;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.35rem;
  overflow-y: auto;
}

.calendar-grid-week .calendar-day {
  min-height: 22rem;
}

.calendar-grid-week .calendar-day-events {
  max-height: 19rem;
}

.calendar-event {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.12rem;
  padding: 0.35rem;
  border: 1px solid var(--bs-border-color);
  border-left: 3px solid var(--bs-primary);
  border-radius: 0.35rem;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  font-size: 0.78rem;
  text-align: left;
}

.calendar-event:hover,
.calendar-event-selected {
  background: var(--bs-primary-bg-subtle);
}

.calendar-event:focus-visible {
  outline: 2px solid var(--bs-primary);
  outline-offset: 1px;
}

.calendar-event-time {
  color: var(--bs-secondary-color);
  font-size: 0.72rem;
  white-space: nowrap;
}

.calendar-event-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
