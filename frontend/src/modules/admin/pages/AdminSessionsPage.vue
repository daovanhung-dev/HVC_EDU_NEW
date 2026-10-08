<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  addTeacherToClassSchedule,
  createClassSchedule,
  createManualSession,
  removeTeacherFromClassSchedule,
  previewDeleteSessionsForMonth,
  deleteSessionsForMonth,
  previewMonthWeekTemplateReplacement,
  replaceMonthWithWeekTemplate,
  setClassScheduleStatus,
  updateClassSchedule,
  updateSessionOccurrence,
  updateSessionTeachers,
} from '@/services/commands'
import type { MonthWeekTemplateSlot } from '@/services/commands'
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
import { deleteRpcErrorMessage, userErrorMessage } from '@/shared/utils/errors'
import { useToastStore } from '@/stores/toast.store'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'
import AppField from '@/app/components/AppField.vue'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'
import DetailModal from '@/app/components/DetailModal.vue'
import YouTubePlayer from '@/app/components/YouTubePlayer.vue'
import TeacherPicker from '../components/TeacherPicker.vue'
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
type WeeklyTemplateSlotDraft = MonthWeekTemplateSlot & { client_id: string }
type WeeklyTemplateDayDraft = { day_of_week: number; slots: WeeklyTemplateSlotDraft[] }

const weekdayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const route = useRoute()
const toast = useToastStore()
const sessions = ref<SessionRow[]>([])
const classes = ref<ClassDetailRow[]>([])
const teachersList = ref<any[]>([])
const schedules = ref<ClassScheduleRow[]>([])
const schedulesByClass = ref<Record<string, ClassScheduleRow[]>>({})
const students = ref<any[]>([])
const selected = ref<SessionRow | null>(null)
const selectedDetailOpen = ref(false)
const selectedTeacherIds = ref<string[]>([])
const selectedClassId = ref(typeof route.query.class_id === 'string' ? route.query.class_id : '')
const loading = ref(false)
const scheduleLoading = ref(false)
const sessionsLoaded = ref(false)
const scheduleLoadErrors = ref<Record<string, boolean>>({})
const errorMessage = ref('')
const startInput = ref('')
const endInput = ref('')
const sessionRoomInput = ref('')
const viewMode = ref<ViewMode>('month')
const calendarAnchorDate = ref(getBusinessDateKey(new Date()))
const todayDateKey = ref(getBusinessDateKey(new Date()))
const scheduleEditorOpen = ref(false)
const sessionFormOpen = ref(false)
const sessionFormBusy = ref(false)
const sessionFormDirty = ref(false)
const sessionFormTeacherTouched = ref(false)
const scheduleFormOpen = ref(false)
const scheduleFormBusy = ref(false)
const scheduleFormDirty = ref(false)
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const deleteError = ref('')
const deletePreviewBusy = ref(false)
const templateEditorOpen = ref(false)
const templatePreviewBusy = ref(false)
const templateError = ref('')
const weeklyTemplateDays = ref<WeeklyTemplateDayDraft[]>([])
const pendingTemplateMonthStart = ref('')
const pendingTemplateSlots = ref<MonthWeekTemplateSlot[]>([])
let weeklyTemplateSlotSequence = 0
const pendingDeleteMonthStart = ref('')
const showHistory = ref(false)
const confirmDetails = ref({ title: '', message: '', itemName: '', warning: '', confirmLabel: 'Xác nhận', destructive: false })
const confirmActionType = ref<'archive-schedule' | 'cancel-session' | 'delete-month-sessions' | 'replace-month-template' | ''>('')
const pendingSchedule = ref<ClassScheduleRow | null>(null)
const editingScheduleId = ref('')
const teacherSelections = ref<Record<string, string>>({})
const sessionForm = ref({ class_id: '', date: getBusinessDateKey(new Date()), start_time: '17:30', end_time: '19:30', room: '', staff_ids: [] as string[] })
const scheduleForm = ref({ day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '', staff_id: '' })
const editSchedule = ref({ day_of_week: 1, start_time: '', end_time: '', room: '' })
const scheduleFormDay = computed({ get: () => editingScheduleId.value ? editSchedule.value.day_of_week : scheduleForm.value.day_of_week, set: (value: number) => { if (editingScheduleId.value) editSchedule.value.day_of_week = value; else scheduleForm.value.day_of_week = value } })
const scheduleFormStart = computed({ get: () => editingScheduleId.value ? editSchedule.value.start_time : scheduleForm.value.start_time, set: (value: string) => { if (editingScheduleId.value) editSchedule.value.start_time = value; else scheduleForm.value.start_time = value } })
const scheduleFormEnd = computed({ get: () => editingScheduleId.value ? editSchedule.value.end_time : scheduleForm.value.end_time, set: (value: string) => { if (editingScheduleId.value) editSchedule.value.end_time = value; else scheduleForm.value.end_time = value } })
const scheduleFormRoom = computed({ get: () => editingScheduleId.value ? editSchedule.value.room : scheduleForm.value.room, set: (value: string) => { if (editingScheduleId.value) editSchedule.value.room = value; else scheduleForm.value.room = value } })
const teachers = computed(() => (selected.value?.session_staff || []).map((item) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công')
const activeTeachers = computed(() => teachersList.value.filter((row) => row.status === 'ACTIVE'))
const activeTemplateClasses = computed(() => classes.value.filter((row) => row.status === 'ACTIVE'))
const weeklyTemplateSlotCount = computed(() => weeklyTemplateDays.value.reduce((total, day) => total + day.slots.length, 0))
const weeklyTemplateValidationError = computed(() => {
  const slots = weeklyTemplateDays.value.flatMap((day) => day.slots)
  if (!slots.length) return 'Hãy thêm ít nhất một buổi vào mẫu tuần.'
  if (slots.length > 100) return 'Mẫu tuần tối đa 100 dòng buổi.'

  const teachersByClass = new Map<string, Set<string>>()
  for (const slot of slots) {
    if (!slot.class_id) return 'Hãy chọn lớp cho từng buổi.'
    if (!slot.start_time || !slot.end_time || slot.end_time <= slot.start_time) {
      return 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.'
    }
    if (!slot.staff_ids.length) return 'Mỗi buổi cần ít nhất một giáo viên.'
    if (slot.staff_ids.length > 5 || new Set(slot.staff_ids).size !== slot.staff_ids.length) {
      return 'Mỗi buổi cần từ 1 đến 5 giáo viên duy nhất.'
    }
    const selectedTeachers = teachersByClass.get(slot.class_id) || new Set<string>()
    slot.staff_ids.forEach((teacherId) => selectedTeachers.add(teacherId))
    teachersByClass.set(slot.class_id, selectedTeachers)
  }
  for (const [classId, selectedTeachers] of teachersByClass) {
    if (selectedTeachers.size > MAX_CLASS_TEACHERS) {
      const classRow = activeTemplateClasses.value.find((row) => row.id === classId)
      return `${classRow?.name || 'Lớp đã chọn'} có tối đa ${MAX_CLASS_TEACHERS} giáo viên được phân công.`
    }
  }
  return ''
})
const sessionFormStartTimestamp = computed(() => {
  if (!sessionForm.value.date || !sessionForm.value.start_time) return Number.NaN
  return Date.parse(`${sessionForm.value.date}T${sessionForm.value.start_time}:00+07:00`)
})
const sessionFormIsBackdated = computed(() => Number.isFinite(sessionFormStartTimestamp.value)
  && sessionFormStartTimestamp.value <= Date.now())
const sessionFormClasses = computed(() => sessionFormIsBackdated.value
  ? classes.value
  : classes.value.filter((row) => row.status === 'ACTIVE'))
const classFilterOptions = computed(() => classes.value.filter((row) => row.status !== 'ARCHIVED'))
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

const classSessions = computed(() => selectedClassId.value
    ? sessions.value.filter((session) => session.class_id === selectedClassId.value)
    : sessions.value)
const sessionsHiddenByClassFilter = computed(() => selectedClassId.value
  ? sessions.value.filter((session) => session.class_id !== selectedClassId.value)
  : [])
const isHiddenByHistoryFilter = (session: SessionRow) => session.status === 'CANCELLED'
  || getBusinessDateKey(session.scheduled_start_at) < todayDateKey.value
const hiddenHistorySessions = computed(() => classSessions.value.filter(isHiddenByHistoryFilter))
const visibleSessions = computed(() => showHistory.value
  ? classSessions.value
  : classSessions.value.filter((session) => !isHiddenByHistoryFilter(session)))
const visibleSessionsByDate = computed(() => groupSessionsByBusinessDate(visibleSessions.value))
const monthDateKeys = computed(() => getMonthGridDateKeys(calendarAnchorDate.value))
const weekDateKeys = computed(() => getWeekDateKeys(calendarAnchorDate.value))
const visibleDateKeys = computed(() => viewMode.value === 'week' ? weekDateKeys.value : monthDateKeys.value)
const sessionDateKeysInView = computed(() => new Set(visibleDateKeys.value))
const sessionsInView = computed(() => classSessions.value.filter((session) => sessionDateKeysInView.value.has(getBusinessDateKey(session.scheduled_start_at))))
const visibleSessionsInView = computed(() => visibleSessions.value.filter((session) => sessionDateKeysInView.value.has(getBusinessDateKey(session.scheduled_start_at))))
const hiddenHistorySessionsInView = computed(() => sessionsInView.value.filter(isHiddenByHistoryFilter))
const sessionsHiddenByClassFilterInView = computed(() => sessionsHiddenByClassFilter.value.filter((session) => sessionDateKeysInView.value.has(getBusinessDateKey(session.scheduled_start_at))))
const listEmptyMessage = computed(() => {
  if (classSessions.value.length) {
    return hiddenHistorySessions.value.length
      ? `Không có buổi sắp tới. ${hiddenHistorySessions.value.length} buổi cũ hoặc đã hủy đang ẩn.`
      : 'Chưa có buổi học trong danh sách.'
  }
  if (selectedClassId.value && sessionsHiddenByClassFilter.value.length) {
    return `Lớp đang chọn chưa có buổi học. ${sessionsHiddenByClassFilter.value.length} buổi ở lớp khác đang bị bộ lọc lớp ẩn.`
  }
  return selectedClassId.value ? 'Lớp đang chọn chưa có buổi học.' : 'Chưa có buổi học nào.'
})
const calendarEmptyMessage = computed(() => {
  const hiddenReasons = [
    hiddenHistorySessionsInView.value.length
      ? `${hiddenHistorySessionsInView.value.length} buổi cũ hoặc đã hủy đang ẩn`
      : '',
    sessionsHiddenByClassFilterInView.value.length
      ? `${sessionsHiddenByClassFilterInView.value.length} buổi ở lớp khác đang bị bộ lọc lớp ẩn`
      : '',
  ].filter(Boolean)
  if (hiddenReasons.length) {
    return `Không có buổi học nào hiển thị trong kỳ này. ${hiddenReasons.join('; ')}.`
  }
  if (visibleSessions.value.length) return 'Không có buổi học trong khoảng thời gian này.'
  if (hiddenHistorySessions.value.length) {
    return `Không có buổi sắp tới trong kỳ này. ${hiddenHistorySessions.value.length} buổi cũ hoặc đã hủy đang ẩn.`
  }
  return listEmptyMessage.value
})
const agendaSessions = computed(() => {
  const dates = new Set(visibleDateKeys.value)
  return visibleSessions.value.filter((session) => dates.has(getBusinessDateKey(session.scheduled_start_at)))
    .sort((left, right) => left.scheduled_start_at.localeCompare(right.scheduled_start_at))
})
const periodTitle = computed(() => viewMode.value === 'month'
  ? formatBusinessMonth(calendarAnchorDate.value)
  : `${formatBusinessDate(weekDateKeys.value[0])} – ${formatBusinessDate(weekDateKeys.value[6])}`)
const visibleCalendarSessionCount = computed(() => visibleDateKeys.value.reduce((total, dateKey) => total + (visibleSessionsByDate.value[dateKey]?.length || 0), 0))
const displayedMonthStart = computed(() => `${calendarAnchorDate.value.slice(0, 7)}-01`)

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

function revealHiddenHistory() {
  showHistory.value = true
  if (!visibleSessionsInView.value.length && hiddenHistorySessions.value.length) viewMode.value = 'list'
}

async function load(): Promise<boolean> {
  loading.value = true
  let sessionsRequestSucceeded = false
  refreshTodayDateKey()
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
      sessionsRequestSucceeded = true
      if (selected.value) {
        selected.value = sessions.value.find((session) => session.id === selected.value?.id) || null
        if (!selected.value) { students.value = []; selectedTeacherIds.value = [] }
      }
    } else {
      sessionsLoaded.value = false
      loadErrors.push(sessionResult.reason instanceof Error ? sessionResult.reason.message : 'Không thể tải buổi học.')
    }

    if (classResult.status === 'fulfilled') {
      classes.value = classResult.value as ClassDetailRow[]
    } else {
      loadErrors.push(classResult.reason instanceof Error ? classResult.reason.message : 'Không thể tải danh sách lớp.')
    }

    if (staffResult.status === 'fulfilled') {
      teachersList.value = staffResult.value as any[]
    } else {
      loadErrors.push(staffResult.reason instanceof Error ? staffResult.reason.message : 'Không thể tải danh sách giáo viên.')
    }

    if (selectedClassId.value && !classFilterOptions.value.some((row) => row.id === selectedClassId.value)) selectedClassId.value = ''
    errorMessage.value = loadErrors.join(' ')
  } finally {
    loading.value = false
  }
  await loadSchedules()
  return sessionsRequestSucceeded
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

function teacherIdsFrom(value: string | string[]) {
  return Array.isArray(value) ? value : value ? [value] : []
}

function updateCreateTeacherSelection(value: string | string[]) {
  sessionFormTeacherTouched.value = true
  sessionForm.value.staff_ids = teacherIdsFrom(value)
}

function updateSelectedTeacherSelection(value: string | string[]) {
  selectedTeacherIds.value = teacherIdsFrom(value)
}

function updateScheduleFormTeacher(value: string | string[]) {
  scheduleForm.value.staff_id = Array.isArray(value) ? value[0] || '' : value
}

function updateScheduleTeacherSelection(scheduleId: string, value: string | string[]) {
  teacherSelections.value[scheduleId] = Array.isArray(value) ? value[0] || '' : value
}

function classStatusLabel(status: ClassDetailRow['status']) {
  if (status === 'INACTIVE') return 'Ngừng hoạt động'
  if (status === 'ARCHIVED') return 'Đã lưu trữ'
  return 'Đang hoạt động'
}

function manualSessionTimeError(start: string, end: string) {
  const startAt = Date.parse(start)
  const endAt = Date.parse(end)
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
    return 'Giờ kết thúc phải sau giờ bắt đầu.'
  }
  if (getBusinessDateKey(new Date(startAt)) !== getBusinessDateKey(new Date(endAt))) {
    return 'Buổi học phải bắt đầu và kết thúc trong cùng một ngày.'
  }
  return ''
}

function roomGenerationWarning(value: unknown) {
  const result = value && typeof value === 'object' ? value as { room_conflicts?: number; missing_room_conflicts?: number } : {}
  const occupied = Number(result.room_conflicts || 0)
  const missing = Number(result.missing_room_conflicts || 0)
  const messages: string[] = []
  if (missing) messages.push(`${missing} buổi chưa được xếp vì lịch trùng giờ nhưng chưa nhập phòng.`)
  if (occupied) messages.push(`${occupied} buổi chưa được xếp vì phòng đã có buổi khác trong khung giờ đó.`)
  return messages.join(' ')
}

function setScheduleResult(result: unknown, success: string) {
  const value = result && typeof result === 'object' ? result as { generation?: unknown } : {}
  const warning = roomGenerationWarning(value.generation ?? result)
  toast.success(success)
  errorMessage.value = warning
}

function changeClassFilter() {
  selected.value = null
  students.value = []
  selectedTeacherIds.value = []
  void loadSchedules()
}

watch(visibleSessions, (rows) => {
  if (selected.value && !rows.some((session) => session.id === selected.value?.id)) {
    selected.value = null
    selectedDetailOpen.value = false
    students.value = []
    selectedTeacherIds.value = []
  }
})

async function selectSession(session: SessionRow) {
  selected.value = session
  selectedDetailOpen.value = true
  selectedTeacherIds.value = (session.session_staff || []).map((item) => item.staff_id)
  startInput.value = toLocalInput(session.scheduled_start_at)
  endInput.value = toLocalInput(session.scheduled_end_at)
  sessionRoomInput.value = session.room ?? session.class_schedules?.room ?? ''
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
  const selectedClass = classes.value.find((row) => row.id === selectedClassId.value)
  const defaultStartAt = Date.parse(`${selectedDate}T17:30:00+07:00`)
  const canUseFilteredClass = selectedClass
    && (selectedClass.status === 'ACTIVE' || (Number.isFinite(defaultStartAt) && defaultStartAt <= Date.now()))
  sessionForm.value = {
    class_id: canUseFilteredClass ? selectedClassId.value : '',
    date: selectedDate,
    start_time: '17:30',
    end_time: '19:30',
    room: '',
    staff_ids: [],
  }
  sessionFormDirty.value = false
  sessionFormTeacherTouched.value = false
  errorMessage.value = ''
  sessionFormOpen.value = true
  void loadCreateDefaults()
}

async function loadCreateDefaults(resetTeacherSelection = false) {
  if (resetTeacherSelection) sessionFormTeacherTouched.value = false
  if (!sessionFormTeacherTouched.value) sessionForm.value.staff_ids = []
  if (!sessionForm.value.class_id) return
  try {
    const rows = await loadClassSchedules(sessionForm.value.class_id)
    const day = weekdayForDate(sessionForm.value.date)
    const preferred = rows.find((row) => row.status === 'ACTIVE'
      && row.day_of_week === day
      && String(row.start_time).slice(0, 5) === sessionForm.value.start_time
      && String(row.end_time).slice(0, 5) === sessionForm.value.end_time)
    if (preferred) {
      if (!sessionFormTeacherTouched.value) {
        sessionForm.value.staff_ids = (preferred.class_schedule_staff || []).map((item) => item.staff_id)
      }
      sessionForm.value.room = preferred.room || ''
    }
  } catch {
    scheduleLoadErrors.value = { ...scheduleLoadErrors.value, [sessionForm.value.class_id]: true }
    // A teacher can still be selected manually if no active fixed schedule is available.
  }
}

async function createSession() {
  if (sessionFormBusy.value) return
  if (!sessionForm.value.class_id || !sessionForm.value.date || !sessionForm.value.start_time
    || !sessionForm.value.end_time || !sessionForm.value.staff_ids.length) {
    errorMessage.value = 'Hãy chọn lớp, giờ bắt đầu/kết thúc và ít nhất một giáo viên.'
    return
  }
  if (teacherCountKnown(sessionForm.value.class_id) && sessionFormTeacherCount.value > MAX_CLASS_TEACHERS) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  const start = localDateTime(sessionForm.value.date, sessionForm.value.start_time)
  const end = localDateTime(sessionForm.value.date, sessionForm.value.end_time)
  const classRow = classes.value.find((row) => row.id === sessionForm.value.class_id)
  if (!classRow || (!sessionFormIsBackdated.value && classRow.status !== 'ACTIVE')) {
    errorMessage.value = 'Chỉ có thể tạo lịch tương lai cho lớp đang hoạt động.'
    return
  }
  const timeError = manualSessionTimeError(start, end)
  if (timeError) {
    errorMessage.value = timeError
    return
  }
  errorMessage.value = ''
  sessionFormBusy.value = true
  try {
    const createdClassId = sessionForm.value.class_id
    const createdDateKey = sessionForm.value.date
    const createdBackdated = sessionFormIsBackdated.value
    const result = await createManualSession({
      class_id: sessionForm.value.class_id,
      start,
      end,
      staff_ids: sessionForm.value.staff_ids,
      room: sessionForm.value.room.trim() || null,
    })
    const createdSessionId = result && typeof result === 'object' && 'session_id' in result
      ? String((result as { session_id?: unknown }).session_id || '')
      : ''
    refreshTodayDateKey()
    if (createdDateKey < todayDateKey.value) showHistory.value = true
    if (selectedClassId.value && selectedClassId.value !== createdClassId) {
      selectedClassId.value = createdClassId
      selected.value = null
      selectedDetailOpen.value = false
      students.value = []
      selectedTeacherIds.value = []
    }
    calendarAnchorDate.value = createdDateKey
    toast.success(createdBackdated ? 'Đã tạo buổi điểm danh bù.' : 'Đã tạo buổi học.')
    sessionFormBusy.value = false
    sessionFormOpen.value = false
    sessionFormDirty.value = false
    const refreshed = await load()
    if (!refreshed) {
      const refreshMessage = 'Buổi học đã được tạo nhưng không tải lại được danh sách. Hãy nhấn “Làm mới” để kiểm tra lại.'
      errorMessage.value = errorMessage.value ? `${refreshMessage} ${errorMessage.value}` : refreshMessage
    } else if (!createdSessionId) {
      errorMessage.value = 'Buổi học đã được tạo nhưng máy chủ không trả mã buổi để xác minh. Hãy nhấn “Làm mới” để kiểm tra lại.'
    } else if (!sessions.value.some((session) => session.id === createdSessionId)) {
      errorMessage.value = 'Buổi học đã được tạo nhưng chưa xuất hiện sau khi tải lại. Hãy nhấn “Làm mới” để kiểm tra lại.'
    }
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể tạo buổi học.') }
  finally { sessionFormBusy.value = false }
}

function initializeWeeklyTemplate() {
  if (weeklyTemplateDays.value.length) return
  weeklyTemplateDays.value = weekdayLabels.map((_, index) => ({ day_of_week: index + 1, slots: [] }))
}

function openWeeklyTemplate() {
  initializeWeeklyTemplate()
  templateError.value = ''
  templateEditorOpen.value = true
}

function addWeeklyTemplateSlot(day: WeeklyTemplateDayDraft) {
  if (weeklyTemplateSlotCount.value >= 100) {
    templateError.value = 'Mẫu tuần tối đa 100 dòng buổi.'
    return
  }
  weeklyTemplateSlotSequence += 1
  day.slots.push({
    client_id: `weekly-template-slot-${weeklyTemplateSlotSequence}`,
    day_of_week: day.day_of_week,
    class_id: '',
    start_time: '17:30',
    end_time: '19:30',
    room: '',
    staff_ids: [],
  })
  templateError.value = ''
}

function removeWeeklyTemplateSlot(day: WeeklyTemplateDayDraft, slotId: string) {
  day.slots = day.slots.filter((slot) => slot.client_id !== slotId)
  templateError.value = ''
}

function templatePayload(): MonthWeekTemplateSlot[] {
  return weeklyTemplateDays.value.flatMap((day) => day.slots.map((slot) => ({
    day_of_week: day.day_of_week,
    class_id: slot.class_id,
    start_time: slot.start_time,
    end_time: slot.end_time,
    room: slot.room.trim() || null,
    staff_ids: [...slot.staff_ids],
  })))
}

async function previewAndConfirmMonthTemplate() {
  if (templatePreviewBusy.value) return
  templateError.value = weeklyTemplateValidationError.value
  if (templateError.value) return

  templatePreviewBusy.value = true
  const monthStart = displayedMonthStart.value
  const slots = templatePayload()
  try {
    const preview = await previewMonthWeekTemplateReplacement(monthStart, slots)
    const statuses = [
      ['đã lên lịch', preview.status_counts.SCHEDULED],
      ['đang diễn ra', preview.status_counts.IN_PROGRESS],
      ['đã hoàn tất', preview.status_counts.COMPLETED],
      ['đã hủy', preview.status_counts.CANCELLED],
    ].filter(([, count]) => Number(count) > 0).map(([label, count]) => `${count} ${label}`).join(' · ')

    pendingTemplateMonthStart.value = monthStart
    pendingTemplateSlots.value = slots
    templateEditorOpen.value = false
    confirmActionType.value = 'replace-month-template'
    confirmDetails.value = {
      title: `Thay toàn bộ lịch ${formatBusinessMonth(monthStart)}?`,
      message: 'Xóa hẳn mọi buổi trong tháng này của tất cả lớp, ở mọi trạng thái; bộ lọc lớp không giới hạn phạm vi. Sau đó tạo lại buổi theo mẫu cho cả tháng, kể cả ngày đã qua.',
      itemName: `${preview.session_count} buổi cũ (${statuses || 'không có buổi'}) · ${preview.session_student_count} dòng học sinh · ${preview.session_staff_count} phân công giáo viên · ${preview.staff_replacement_count} thay giáo viên · ${preview.attendance_count} điểm danh · ${preview.assessment_count} kết quả · ${preview.timesheet_count} chấm công · ${preview.payroll_item_count} mục lương sẽ bị xóa; ${preview.new_session_count} buổi mới sẽ được tạo.`,
      warning: 'XÓA VĨNH VIỄN dữ liệu liên kết của các buổi cũ. Hồ sơ lớp, học sinh và nhân sự được giữ. Khung lịch lặp được giữ cho các tháng khác và không sinh buổi trong tháng vừa thay. Nếu mẫu thiếu thành viên phù hợp hoặc có xung đột, toàn bộ thao tác bị từ chối và lịch cũ được giữ nguyên. Nhật ký kiểm toán được lưu lại.',
      confirmLabel: 'Xóa lịch cũ và tạo lịch mới',
      destructive: true,
    }
    confirmOpen.value = true
  } catch (error) {
    templateError.value = userErrorMessage(error, 'Không thể xem trước phạm vi thay lịch tháng.')
  } finally {
    templatePreviewBusy.value = false
  }
}

async function replaceMonthTemplateNow() {
  const monthStart = pendingTemplateMonthStart.value
  if (!monthStart || !pendingTemplateSlots.value.length) return
  templateError.value = ''
  try {
    const result = await replaceMonthWithWeekTemplate(monthStart, pendingTemplateSlots.value)
    confirmBusy.value = false
    confirmOpen.value = false
    selected.value = null
    selectedDetailOpen.value = false
    students.value = []
    selectedTeacherIds.value = []
    selectedClassId.value = ''
    calendarAnchorDate.value = monthStart
    showHistory.value = true
    viewMode.value = 'month'
    weeklyTemplateDays.value = []
    pendingTemplateSlots.value = []

    const refreshed = await load()
    if (!refreshed) {
      const refreshMessage = `Đã xóa ${result.deleted_sessions} buổi cũ và tạo ${result.created_sessions} buổi mới, nhưng chưa tải lại được lịch. Hãy nhấn “Làm mới”.`
      errorMessage.value = refreshMessage
      toast.error(refreshMessage)
      return
    }
    toast.success(`Đã xóa ${result.deleted_sessions} buổi cũ và tạo ${result.created_sessions} buổi mới cho ${formatBusinessMonth(monthStart)}.`)
  } catch (error) {
    confirmOpen.value = false
    templateEditorOpen.value = true
    templateError.value = userErrorMessage(error, 'Không thể thay lịch tháng. Lịch cũ vẫn được giữ nguyên.')
    toast.error(templateError.value)
    confirmBusy.value = false
  }
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
  errorMessage.value = ''
  try {
    await updateSessionTeachers({ session_id: selected.value.id, staff_ids: selectedTeacherIds.value })
    toast.success('Đã cập nhật giáo viên cho buổi học.')
    await load()
    const refreshed = sessions.value.find((row) => row.id === selected.value?.id)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể cập nhật giáo viên.') }
}

async function createSchedule() {
  if (scheduleFormBusy.value) return
  if (!selectedClassId.value) return
  if (scheduleForm.value.staff_id && teacherCountKnown(selectedClassId.value)
    && !canSelectClassTeacher(selectedClassTeacherIds.value, [], scheduleForm.value.staff_id)) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  errorMessage.value = ''
  scheduleFormBusy.value = true
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
    toast.success('Đã lưu lịch cố định ở trạng thái chờ rà soát.')
    scheduleFormBusy.value = false
    scheduleFormOpen.value = false
    scheduleFormDirty.value = false
    await loadSchedules()
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể lưu lịch cố định.') }
  finally { scheduleFormBusy.value = false }
}

async function toggleSchedule(row: ClassScheduleRow) {
  errorMessage.value = ''
  if (row.status !== 'ACTIVE' && (!activeRosterReady.value || !row.class_schedule_staff?.length)) {
    errorMessage.value = 'Hãy xác nhận danh sách học sinh và phân công ít nhất một giáo viên trước khi bật lịch.'
    return
  }
  try {
    const result = await setClassScheduleStatus(row.id, row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
    await load()
    setScheduleResult(result, row.status === 'ACTIVE' ? 'Đã tạm dừng lịch lặp.' : 'Đã bật lịch lặp; buổi học sẽ được sinh trong 30 ngày tới.')
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
  scheduleFormDirty.value = false
  errorMessage.value = ''
  scheduleFormOpen.value = true
}

function openScheduleForm() {
  editingScheduleId.value = ''
  scheduleForm.value = { day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '', staff_id: '' }
  scheduleFormDirty.value = false
  errorMessage.value = ''
  scheduleFormOpen.value = true
}

async function saveClassSchedule(row: ClassScheduleRow) {
  if (scheduleFormBusy.value) return
  scheduleFormBusy.value = true
  errorMessage.value = ''
  try {
    const result = await updateClassSchedule(row.id, { ...editSchedule.value, room: editSchedule.value.room.trim() || null })
    editingScheduleId.value = ''
    scheduleFormBusy.value = false
    scheduleFormOpen.value = false
    scheduleFormDirty.value = false
    await load()
    setScheduleResult(result, 'Đã cập nhật lịch cố định.')
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật lịch.' }
  finally { scheduleFormBusy.value = false }
}

function submitScheduleForm() {
  if (editingScheduleId.value) {
    const row = schedules.value.find((item) => item.id === editingScheduleId.value)
    if (row) void saveClassSchedule(row)
    return
  }
  void createSchedule()
}

async function addScheduleTeacher(row: ClassScheduleRow) {
  const staffId = teacherSelections.value[row.id]
  if (!staffId) return
  if (teacherCountKnown(row.class_id) && !canSelectScheduleTeacher(staffId)) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  try {
    const result = await addTeacherToClassSchedule(row.id, staffId)
    teacherSelections.value[row.id] = ''
    await loadSchedules()
    await load()
    setScheduleResult(result, 'Đã phân công giáo viên cố định.')
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể phân công giáo viên.') }
}

async function removeScheduleTeacher(row: ClassScheduleRow, staffId: string) {
  try {
    const generation = await removeTeacherFromClassSchedule(row.id, staffId)
    await loadSchedules()
    await load()
    setScheduleResult(generation, 'Đã gỡ giáo viên khỏi khung lịch.')
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể gỡ giáo viên.' }
}

async function archiveSchedule(row: ClassScheduleRow) {
  pendingSchedule.value = row
  confirmActionType.value = 'archive-schedule'
  confirmDetails.value = { title: 'Lưu trữ khung lịch?', message: 'Các buổi tương lai còn ở trạng thái SCHEDULED sẽ bị hủy. Lịch sử đã diễn ra được giữ nguyên.', itemName: `${dayLabel(row.day_of_week)} · ${String(row.start_time).slice(0, 5)}–${String(row.end_time).slice(0, 5)}`, warning: 'Khung lịch đã lưu trữ không tiếp tục sinh buổi học mới.', confirmLabel: 'Lưu trữ khung lịch', destructive: true }
  confirmOpen.value = true
}

async function previewAndConfirmDeleteMonthSessions() {
  if (deletePreviewBusy.value || loading.value) return
  deletePreviewBusy.value = true
  errorMessage.value = ''
  deleteError.value = ''
  const monthStart = displayedMonthStart.value
  try {
    const preview = await previewDeleteSessionsForMonth(monthStart)
    const scheduleCount = Math.max(0, Number(preview.schedule_count) || 0)
    const sessionCount = Math.max(0, Number(preview.session_count) || 0)
    if (scheduleCount === 0 && sessionCount === 0) {
      toast.info('Không có buổi học hoặc mẫu lịch lặp nào để xóa.')
      return
    }
    const statuses = [
      ['đã lên lịch', preview.status_counts.SCHEDULED],
      ['đang diễn ra', preview.status_counts.IN_PROGRESS],
      ['đã hoàn tất', preview.status_counts.COMPLETED],
      ['đã hủy', preview.status_counts.CANCELLED],
    ].filter(([, count]) => Number(count) > 0).map(([label, count]) => count + ' ' + label).join(' · ')
    pendingDeleteMonthStart.value = monthStart
    confirmActionType.value = 'delete-month-sessions'
    confirmDetails.value = {
      title: 'Xóa toàn bộ buổi học — ' + formatBusinessMonth(monthStart) + '?',
      message: 'Xóa hẳn mọi buổi học của tất cả lớp thuộc tháng này, ở mọi trạng thái. Bộ lọc lớp không làm thay đổi phạm vi xóa.',
      itemName: sessionCount + ' buổi (' + (statuses || 'không có buổi') + ') · ' + scheduleCount + ' mẫu lịch lặp · '
        + preview.schedule_staff_count + ' phân công giáo viên trên mẫu lịch · '
        + preview.session_student_count + ' dòng học sinh · ' + preview.session_staff_count + ' phân công · '
        + preview.staff_replacement_count + ' thay giáo viên · ' + preview.attendance_count + ' điểm danh · '
        + preview.assessment_count + ' kết quả · ' + preview.timesheet_count + ' chấm công · '
        + preview.payroll_item_count + ' mục lương',
      warning: 'XÓA VĨNH VIỄN: điểm danh, kết quả, danh sách học sinh/giáo viên, thay giáo viên, chấm công và mục lương gắn với các buổi này đều bị xóa. Toàn bộ mẫu lịch lặp và phân công giáo viên trên các mẫu của trung tâm cũng bị xóa; buổi thuộc tháng khác được giữ. Nhật ký kiểm toán được lưu lại.',
      confirmLabel: 'Xóa vĩnh viễn',
      destructive: true,
    }
    confirmOpen.value = true
  } catch (error) {
    errorMessage.value = userErrorMessage(error, 'Không thể xem trước phạm vi xóa lịch.')
    toast.error(errorMessage.value)
  } finally {
    deletePreviewBusy.value = false
  }
}

async function deleteMonthSessionsNow() {
  try {
    const result = await deleteSessionsForMonth(pendingDeleteMonthStart.value)
    deleteError.value = ''
    confirmBusy.value = false
    confirmOpen.value = false
    selected.value = null
    selectedDetailOpen.value = false
    students.value = []
    selectedTeacherIds.value = []
    const sessionsLoaded = await load()
    if (!sessionsLoaded) {
      const refreshMessage = 'Đã xóa vĩnh viễn ' + result.deleted_sessions + ' buổi học, nhưng chưa tải lại được lịch. Hãy nhấn “Làm mới”.'
      errorMessage.value = refreshMessage
      toast.error(refreshMessage)
      return
    }
    toast.success('Đã xóa vĩnh viễn ' + result.deleted_sessions + ' buổi học trong tháng và ' + result.deleted_schedules + ' mẫu lịch lặp của trung tâm.')
  } catch (error) {
    errorMessage.value = deleteRpcErrorMessage(error, 'Không thể xóa lịch.')
    deleteError.value = errorMessage.value
    toast.error(errorMessage.value)
    confirmBusy.value = false
  }
}

async function archiveScheduleNow() {
  if (!pendingSchedule.value) return
  try {
    await setClassScheduleStatus(pendingSchedule.value.id, 'ARCHIVED')
    toast.success('Đã lưu trữ khung lịch và giữ nguyên lịch sử.')
    confirmBusy.value = false
    confirmOpen.value = false
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu trữ khung lịch.'
    toast.error(errorMessage.value)
  }
}

async function saveSchedule() {
  if (!selected.value || !startInput.value || !endInput.value) return
  const sessionId = selected.value.id
  try {
    await updateSessionOccurrence({ session_id: sessionId, start: fromLocalInput(startInput.value), end: fromLocalInput(endInput.value), room: sessionRoomInput.value.trim() || null })
    toast.success('Đã đổi lịch buổi học.')
    await load()
    const refreshed = sessions.value.find((item) => item.id === sessionId)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = userErrorMessage(error, 'Không thể đổi lịch buổi học.') }
}

async function cancel() {
  if (!selected.value) return
  confirmActionType.value = 'cancel-session'
  confirmDetails.value = { title: 'Hủy buổi học?', message: 'Buổi học sẽ được đánh dấu đã hủy. Thông tin và kết quả đã lưu vẫn được giữ.', itemName: `${className(selected.value)} · ${formatDateTime(selected.value.scheduled_start_at)}`, warning: 'Giáo viên và học sinh sẽ thấy trạng thái buổi học đã hủy.', confirmLabel: 'Hủy buổi học', destructive: true }
  confirmOpen.value = true
}

async function cancelSessionNow() {
  if (!selected.value) return
  const sessionId = selected.value.id
  try {
    await updateSessionOccurrence({ session_id: sessionId, cancel: true, room: sessionRoomInput.value.trim() || null })
    toast.success('Đã hủy buổi học.')
    confirmBusy.value = false
    confirmOpen.value = false
    await load()
    const refreshed = sessions.value.find((item) => item.id === sessionId)
    if (refreshed) await selectSession(refreshed)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể hủy buổi học.'
    toast.error(errorMessage.value)
  }
}

async function runConfirmation() {
  if (confirmBusy.value) return
  confirmBusy.value = true
  errorMessage.value = ''
  if (confirmActionType.value === 'delete-month-sessions') deleteError.value = ''
  try {
    if (confirmActionType.value === 'replace-month-template') await replaceMonthTemplateNow()
    else if (confirmActionType.value === 'archive-schedule') await archiveScheduleNow()
    else if (confirmActionType.value === 'cancel-session') await cancelSessionNow()
    else if (confirmActionType.value === 'delete-month-sessions') await deleteMonthSessionsNow()
  } finally { confirmBusy.value = false }
}

onMounted(load)
watch(() => route.query.class_id, (value) => {
  selectedClassId.value = typeof value === 'string' ? value : ''
  changeClassFilter()
})
watch(sessionFormIsBackdated, (isBackdated) => {
  if (isBackdated) return
  const classRow = classes.value.find((row) => row.id === sessionForm.value.class_id)
  if (classRow && classRow.status !== 'ACTIVE') {
    sessionForm.value.class_id = ''
    sessionForm.value.staff_ids = []
    sessionForm.value.room = ''
    sessionFormTeacherTouched.value = false
  }
})
</script>

<template>
  <AppPageHeader title="Buổi học" eyebrow="Lịch giảng dạy" description="Xem lịch tháng, tuần hoặc danh sách; quản lý buổi riêng và khung lịch lặp.">
    <template #actions>
      <button class="btn btn-primary" @click="scheduleEditorOpen = !scheduleEditorOpen">Chỉnh sửa lịch</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="openWeeklyTemplate">Tạo lịch mẫu</button>
      <button class="btn btn-outline-danger" :disabled="loading || deletePreviewBusy" :aria-busy="deletePreviewBusy || undefined" @click="previewAndConfirmDeleteMonthSessions">
        <span v-if="deletePreviewBusy" class="app-button__spinner" aria-hidden="true"></span>{{ deletePreviewBusy ? 'Đang kiểm tra…' : 'Xóa toàn bộ buổi trong tháng' }}
      </button>
      <button class="btn btn-outline-primary" @click="openSessionForm()">Thêm buổi</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button>
    </template>
  </AppPageHeader>
  <div v-if="errorMessage && sessionsLoaded" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" :disabled="loading" @click="load">Thử lại</button></div>

  <div class="card border-0 shadow-sm mb-4">
    <div class="card-body d-flex flex-wrap align-items-end justify-content-between gap-3">
      <div class="flex-grow-1 class-filter">
        <label for="session-class-filter" class="form-label">Lọc theo lớp</label>
        <select id="session-class-filter" v-model="selectedClassId" class="form-select" @change="changeClassFilter">
          <option value="">Tất cả lớp</option>
          <option v-for="classRow in classFilterOptions" :key="classRow.id" :value="classRow.id">{{ classRow.name }}</option>
        </select>
      </div>
    </div>
  </div>

  <FormModal v-model="sessionFormOpen" title="Tạo buổi học riêng" description="Chọn thời gian và giáo viên. Lịch cũ sẽ tạo buổi điểm danh bù; giới hạn 5 giáo viên và kiểm tra trùng lịch vẫn được áp dụng." :busy="sessionFormBusy" :dirty="sessionFormDirty" :submit-disabled="!sessionForm.class_id || !sessionForm.staff_ids.length || (teacherCountKnown(sessionForm.class_id) && sessionFormTeacherCount > MAX_CLASS_TEACHERS)" submit-label="Tạo buổi học" @submit="createSession" @cancel="sessionFormOpen = false">
    <form id="session-create-form" class="row g-3 session-create-form" @submit.prevent="createSession" @input="sessionFormDirty = true" @change="sessionFormDirty = true">
      <AppField id="session-class" class="col-md-6" label="Lớp" required><template #default="field"><select :id="field.id" v-model="sessionForm.class_id" class="form-select" required data-modal-autofocus @change="loadCreateDefaults(true)"><option value="">Chọn lớp</option><option v-for="classRow in sessionFormClasses" :key="classRow.id" :value="classRow.id">{{ classRow.name }}{{ classRow.status === 'ACTIVE' ? '' : ` · ${classStatusLabel(classRow.status)}` }}</option></select></template></AppField>
      <AppField id="session-date" class="col-md-6" label="Ngày" required><template #default="field"><input :id="field.id" v-model="sessionForm.date" type="date" class="form-control" required @change="loadCreateDefaults()" /></template></AppField>
      <AppField id="session-start-time" class="col-md-6" label="Giờ bắt đầu" required><template #default="field"><input :id="field.id" v-model="sessionForm.start_time" type="time" class="form-control" required @change="loadCreateDefaults()" /></template></AppField>
      <AppField id="session-end-time" class="col-md-6" label="Giờ kết thúc" required><template #default="field"><input :id="field.id" v-model="sessionForm.end_time" type="time" class="form-control" required @change="loadCreateDefaults()" /></template></AppField>
      <AppField id="session-room" class="col-md-6" label="Phòng"><template #default="field"><input :id="field.id" v-model="sessionForm.room" class="form-control" placeholder="Ví dụ: A1" /></template></AppField>
      <div v-if="sessionFormIsBackdated" class="col-12">
        <div class="alert alert-warning py-2 mb-0" role="status">Buổi điểm danh bù · {{ formatBusinessDate(sessionForm.date) }}. Giáo viên được phân công sẽ bắt đầu buổi và nhập điểm danh theo luồng thường.</div>
      </div>
      <AppField id="session-teachers" class="col-md-6" :label="`Giáo viên được phân công (${teacherCountLabel(sessionForm.class_id, sessionForm.staff_ids)})`" required description="Tìm theo tên hoặc mã giáo viên. Có thể chọn nhiều người, tối đa 5 giáo viên duy nhất trên một lớp."><template #default="field"><TeacherPicker :id="field.id" :model-value="sessionForm.staff_ids" :teachers="activeTeachers" multiple :disabled-ids="activeTeachers.filter((teacher) => !canSelectCreateTeacher(teacher.id)).map((teacher) => teacher.id)" :described-by="field.describedBy" @update:model-value="updateCreateTeacherSelection" /></template></AppField>
    </form>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
    <template #footer><button class="btn btn-outline-secondary" type="button" :disabled="sessionFormBusy" @click="sessionFormOpen = false">Hủy</button><button class="btn btn-primary" type="button" :disabled="sessionFormBusy || !sessionForm.class_id || !sessionForm.staff_ids.length || (teacherCountKnown(sessionForm.class_id) && sessionFormTeacherCount > MAX_CLASS_TEACHERS)" @click="createSession"><span v-if="sessionFormBusy" class="app-button__spinner" aria-hidden="true"></span>{{ sessionFormBusy ? 'Đang tạo…' : 'Tạo buổi học' }}</button></template>
  </FormModal>

  <FormModal
    v-model="templateEditorOpen"
    :title="`Tạo lịch mẫu cho ${formatBusinessMonth(displayedMonthStart)}`"
    description="Nhập các buổi theo thứ. Khi lưu, toàn bộ buổi trong tháng của mọi lớp sẽ bị xóa và tạo lại theo mẫu này, kể cả ngày đã qua."
    size="xl"
    :busy="templatePreviewBusy"
    :submit-disabled="Boolean(weeklyTemplateValidationError) || !activeTemplateClasses.length"
    submit-label="Xem phạm vi thay lịch"
    submitting-label="Đang kiểm tra…"
    @submit="previewAndConfirmMonthTemplate"
    @cancel="templateEditorOpen = false"
  >
    <div class="alert alert-warning" role="note">
      Phạm vi áp dụng là toàn trung tâm, không phụ thuộc bộ lọc lớp. Mỗi buổi mới dùng danh sách thành viên có hiệu lực vào ngày học.
    </div>
    <div v-if="!activeTemplateClasses.length" class="alert alert-danger" role="alert">
      Không có lớp đang hoạt động để đưa vào mẫu lịch.
    </div>
    <div class="weekly-template-days" @input="templateError = ''" @change="templateError = ''">
      <section v-for="day in weeklyTemplateDays" :key="day.day_of_week" class="weekly-template-day" :aria-labelledby="`weekly-template-day-${day.day_of_week}`">
        <div class="weekly-template-day__heading">
          <h3 :id="`weekly-template-day-${day.day_of_week}`" class="h6 mb-0">{{ weekdayLabels[day.day_of_week - 1] }}</h3>
          <button class="btn btn-sm btn-outline-primary" type="button" :disabled="weeklyTemplateSlotCount >= 100" @click="addWeeklyTemplateSlot(day)">Thêm buổi</button>
        </div>
        <p v-if="!day.slots.length" class="small text-secondary mb-0">Chưa có buổi mẫu cho ngày này.</p>
        <div v-for="(slot, slotIndex) in day.slots" :key="slot.client_id" class="weekly-template-slot">
          <div class="weekly-template-slot__heading">
            <strong class="small">Buổi {{ slotIndex + 1 }}</strong>
            <button
              class="btn btn-sm btn-outline-danger"
              type="button"
              :aria-label="`Xóa buổi ${slotIndex + 1}, ${weekdayLabels[day.day_of_week - 1]}`"
              @click="removeWeeklyTemplateSlot(day, slot.client_id)"
            >Xóa buổi</button>
          </div>
          <div class="row g-3">
            <AppField :id="`weekly-template-class-${slot.client_id}`" class="col-md-6" label="Lớp" required>
              <template #default="field">
                <select :id="field.id" v-model="slot.class_id" class="form-select" required>
                  <option value="">Chọn lớp</option>
                  <option v-for="classRow in activeTemplateClasses" :key="classRow.id" :value="classRow.id">{{ classRow.name }}</option>
                </select>
              </template>
            </AppField>
            <AppField :id="`weekly-template-room-${slot.client_id}`" class="col-md-6" label="Phòng">
              <template #default="field"><input :id="field.id" v-model="slot.room" class="form-control" placeholder="Ví dụ: A1" /></template>
            </AppField>
            <AppField :id="`weekly-template-start-${slot.client_id}`" class="col-md-3" label="Giờ bắt đầu" required>
              <template #default="field"><input :id="field.id" v-model="slot.start_time" class="form-control" type="time" required /></template>
            </AppField>
            <AppField :id="`weekly-template-end-${slot.client_id}`" class="col-md-3" label="Giờ kết thúc" required>
              <template #default="field"><input :id="field.id" v-model="slot.end_time" class="form-control" type="time" required /></template>
            </AppField>
            <div class="col-md-6">
              <TeacherPicker
                :id="`weekly-template-teachers-${slot.client_id}`"
                :model-value="slot.staff_ids"
                :teachers="activeTeachers"
                multiple
                label="Giáo viên"
                placeholder="Tìm và chọn giáo viên"
                @update:model-value="slot.staff_ids = Array.isArray($event) ? $event : ($event ? [$event] : [])"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
    <div v-if="weeklyTemplateValidationError" class="alert alert-info mt-3 mb-0" role="status">{{ weeklyTemplateValidationError }}</div>
    <div v-if="templateError" class="alert alert-danger mt-3 mb-0" role="alert">{{ templateError }}</div>
  </FormModal>

  <div v-if="scheduleEditorOpen" class="card border-0 shadow-sm mb-4">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h2 class="h5 mb-1">Khung lịch cố định</h2>
          <div class="small text-secondary">Giáo viên trong khung thứ/giờ được kế thừa cho buổi sinh tự động. Lịch lưu trữ không xóa lịch sử đã diễn ra.</div>
        </div>
        <span v-if="selectedClassId" class="badge text-bg-primary">Giáo viên của lớp: {{ teacherCountLabel(selectedClassId) }}</span>
        <button v-if="selectedClassId" class="btn btn-sm btn-primary" type="button" @click="openScheduleForm">Thêm khung lịch</button>
        <button class="btn btn-sm btn-outline-secondary" @click="scheduleEditorOpen = false">Đóng</button>
      </div>
      <div v-if="!selectedClassId" class="alert alert-info mb-0">Chọn một lớp ở bộ lọc để quản lý lịch cố định.</div>
      <template v-else>
        <div v-if="scheduleLoading" class="text-secondary py-3" role="status">Đang tải khung lịch…</div>
        <div v-for="schedule in schedules" :key="schedule.id" class="border rounded p-3 mb-3">
          <div class="d-flex flex-wrap justify-content-between gap-2">
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
          <form v-if="schedule.status !== 'ARCHIVED'" class="row g-2 mt-2" @submit.prevent="addScheduleTeacher(schedule)">
            <div class="col-sm-8"><TeacherPicker :id="`schedule-add-teacher-${schedule.id}`" :model-value="teacherSelections[schedule.id] || ''" label="Giáo viên cần thêm" label-class="visually-hidden" placeholder="Tìm giáo viên để thêm vào khung" :teachers="activeTeachers.filter((row) => !(schedule.class_schedule_staff || []).some((mapping) => mapping.staff_id === row.id))" :disabled-ids="activeTeachers.filter((teacher) => !canSelectScheduleTeacher(teacher.id)).map((teacher) => teacher.id)" @update:model-value="updateScheduleTeacherSelection(schedule.id, $event)" /></div>
            <div class="col-sm-4"><button class="btn btn-sm btn-outline-primary" :disabled="!teacherSelections[schedule.id]">Phân công</button></div>
          </form>
        </div>
        <div v-if="!schedules.length" class="text-center text-secondary py-4">Chưa có khung lịch cố định.</div>
      </template>
    </div>
  </div>

  <FormModal v-model="scheduleFormOpen" :title="editingScheduleId ? 'Sửa khung lịch cố định' : 'Thêm khung lịch cố định'" :description="editingScheduleId ? 'Thay đổi sẽ áp dụng theo quy tắc lịch lớp hiện hành.' : 'Khung lịch lặp được lưu ở trạng thái chờ rà soát trước khi sinh buổi.'" :busy="scheduleFormBusy" :dirty="scheduleFormDirty" :submit-disabled="!selectedClassId" :submit-label="editingScheduleId ? 'Lưu thay đổi' : 'Lưu khung lịch'" @submit="submitScheduleForm" @cancel="scheduleFormOpen = false">
    <form class="row g-3 schedule-editor-form" @submit.prevent="submitScheduleForm" @input="scheduleFormDirty = true" @change="scheduleFormDirty = true">
      <AppField id="schedule-day" class="col-md-6" label="Ngày trong tuần" required><template #default="field"><select :id="field.id" v-model.number="scheduleFormDay" class="form-select" required data-modal-autofocus><option v-for="day in 7" :key="day" :value="day">{{ dayLabel(day) }}</option></select></template></AppField>
      <AppField id="schedule-start" class="col-md-6" label="Giờ bắt đầu" required><template #default="field"><input :id="field.id" v-model="scheduleFormStart" type="time" class="form-control" required /></template></AppField>
      <AppField id="schedule-end" class="col-md-6" label="Giờ kết thúc" required><template #default="field"><input :id="field.id" v-model="scheduleFormEnd" type="time" class="form-control" required /></template></AppField>
      <AppField id="schedule-room" class="col-md-6" label="Phòng"><template #default="field"><input :id="field.id" v-model="scheduleFormRoom" class="form-control" /></template></AppField>
      <AppField v-if="!editingScheduleId" id="schedule-teacher" class="col-12" :label="`Giáo viên cố định (${teacherCountLabel(selectedClassId)})`" description="Tìm theo tên hoặc mã giáo viên. Có thể phân công thêm trong thẻ khung lịch."><template #default="field"><TeacherPicker :id="field.id" :model-value="scheduleForm.staff_id" :teachers="activeTeachers" placeholder="Tìm giáo viên hoặc để trống" :disabled-ids="activeTeachers.filter((teacher) => !canSelectScheduleTeacher(teacher.id)).map((teacher) => teacher.id)" :described-by="field.describedBy" @update:model-value="updateScheduleFormTeacher" /></template></AppField>
    </form>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
  </FormModal>
  <ConfirmModal v-model="confirmOpen" v-bind="confirmDetails" :busy="confirmBusy" :error="confirmActionType === 'delete-month-sessions' ? deleteError : ''" @confirm="runConfirmation" />

  <div class="card border-0 shadow-sm mb-4">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <div class="btn-group" role="group" aria-label="Chế độ hiển thị buổi học">
            <button class="btn" :class="viewMode === 'month' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'month'" @click="viewMode = 'month'">Tháng</button>
            <button class="btn" :class="viewMode === 'week' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'week'" @click="viewMode = 'week'">Tuần</button>
            <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'">Danh sách</button>
          </div>
          <button class="btn btn-sm" :class="showHistory ? 'btn-primary' : 'btn-outline-secondary'" :aria-pressed="showHistory" @click="showHistory = !showHistory">
            {{ showHistory ? 'Ẩn lịch sử' : 'Hiện lịch sử' }}
          </button>
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

  <div class="row g-4 mb-4 admin-session-layout-row">
    <div :class="viewMode === 'list' ? 'col-12' : 'col-12'">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <AppState v-if="!loading && errorMessage && !sessionsLoaded" kind="error" title="Không thể tải lịch buổi học" :message="errorMessage" @retry="load" />
          <template v-else>
          <Transition name="view-swap" mode="out-in">
          <div v-if="viewMode === 'list'" key="list" class="session-list">
            <div v-if="loading" class="text-center text-secondary py-4" role="status">Đang tải buổi học…</div>
            <div v-else-if="!loading && !errorMessage && !visibleSessions.length" class="text-center text-secondary py-5">
              <p class="mb-2">{{ listEmptyMessage }}</p>
              <button v-if="!showHistory && hiddenHistorySessions.length" type="button" class="btn btn-sm btn-outline-primary" @click="revealHiddenHistory">Xem lịch sử trong danh sách</button>
            </div>
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead><tr><th>Ngày</th><th>Lớp</th><th>Thời gian</th><th>Phòng</th><th>Giáo viên</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  <tr v-for="session in visibleSessions" :key="session.id" :class="selected?.id === session.id ? 'table-primary' : ''" role="button" tabindex="0" @click="selectSession(session)" @keydown.enter="selectSession(session)">
                    <td>{{ formatBusinessDate(getBusinessDateKey(session.scheduled_start_at)) }}</td>
                    <td class="fw-semibold">{{ className(session) }}</td>
                    <td>{{ formatBusinessTime(session.scheduled_start_at) }}–{{ formatBusinessTime(session.scheduled_end_at) }}</td>
                    <td>{{ session.room || session.class_schedules?.room || 'Chưa xếp phòng' }}</td>
                    <td>{{ (session.session_staff || []).map((item) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công' }}</td>
                    <td><span class="badge" :class="sessionStatusClass(session.status)">{{ session.status }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else key="calendar" class="session-calendar-view">
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
                      <span class="calendar-event-room">{{ session.room || session.class_schedules?.room || 'Chưa xếp phòng' }}</span>
                      <span class="badge align-self-start" :class="sessionStatusClass(session.status)">{{ session.status }}</span>
                    </button>
                  </div>
                </section>
              </div>
            </div>
            <div class="session-agenda" aria-label="Buổi học trong kỳ này">
              <div v-for="session in agendaSessions" :key="session.id" class="session-agenda__item">
                <button type="button" class="session-agenda__select" :aria-pressed="selected?.id === session.id" @click="selectSession(session)">
                  <span class="session-agenda__time">{{ formatBusinessDate(getBusinessDateKey(session.scheduled_start_at)) }} · {{ formatBusinessTime(session.scheduled_start_at) }}–{{ formatBusinessTime(session.scheduled_end_at) }}</span>
                  <strong>{{ className(session) }}</strong>
                  <span>{{ session.room || session.class_schedules?.room || 'Chưa xếp phòng' }}</span>
                </button>
                <span class="badge" :class="sessionStatusClass(session.status)">{{ session.status }}</span>
              </div>
            </div>
            <div v-if="loading" class="text-center text-secondary py-3" role="status">Đang tải buổi học…</div>
            <div v-else-if="!loading && !errorMessage && !visibleCalendarSessionCount" class="session-calendar-empty text-center text-secondary py-3">
              <p class="mb-2">{{ calendarEmptyMessage }}</p>
              <button v-if="!showHistory && hiddenHistorySessions.length" type="button" class="btn btn-sm btn-outline-primary" @click="revealHiddenHistory">
                {{ hiddenHistorySessionsInView.length ? 'Hiện lịch sử' : 'Xem lịch sử trong danh sách' }}
              </button>
            </div>
          </div>
          </Transition>
          </template>
        </div>
      </div>
    </div>

    <div class="col-12">
      <DetailModal v-if="selected" v-model="selectedDetailOpen" :title="className(selected)" :description="`${formatDateTime(selected.scheduled_start_at)} · ${selected.status}`" size="xl">
          <h2 class="h5">{{ className(selected) }}</h2>
          <div class="text-secondary mb-3">Giáo viên: {{ teachers }} · {{ selected.status }} · {{ sessionRoomInput || 'Chưa xếp phòng' }}</div>
          <div v-if="selected.status === 'SCHEDULED'" class="row g-2 align-items-end mb-3">
            <div class="col-md-8"><label class="form-label" for="session-detail-teachers">Giáo viên được phân công cho buổi này ({{ teacherCountLabel(selected.class_id, selectedTeacherIds, selected.id) }})</label><TeacherPicker id="session-detail-teachers" :model-value="selectedTeacherIds" :teachers="activeTeachers" multiple placeholder="Tìm theo tên hoặc mã giáo viên" :disabled-ids="activeTeachers.filter((teacher) => !canSelectSessionTeacher(teacher.id)).map((teacher) => teacher.id)" @update:model-value="updateSelectedTeacherSelection" /></div>
            <div class="col-md-4"><button class="btn btn-outline-primary" :disabled="selectedSessionTeacherCount > MAX_CLASS_TEACHERS" @click="saveTeachers">Lưu phân công buổi này</button></div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-md-4"><label class="form-label">Bắt đầu</label><input v-model="startInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div>
            <div class="col-md-4"><label class="form-label">Kết thúc</label><input v-model="endInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div>
            <div class="col-md-4"><label class="form-label">Phòng</label><input v-model="sessionRoomInput" class="form-control" :disabled="selected.status !== 'SCHEDULED'" /></div>
          </div>
          <div v-if="selected.status === 'SCHEDULED'" class="d-flex gap-2 mb-4">
            <button class="btn btn-primary btn-sm" @click="saveSchedule">Lưu lịch mới</button>
            <button class="btn btn-outline-danger btn-sm" @click="cancel">Hủy buổi học</button>
          </div>
          <p v-if="selected.session_note" class="border-start border-3 ps-3">{{ selected.session_note }}</p>
          <YouTubePlayer v-if="selected.lesson_youtube_url" class="mb-3" :url="selected.lesson_youtube_url" :title="`Video bài học ${className(selected)}`" />
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
          <div v-if="errorMessage" class="alert alert-danger mt-3" role="alert">{{ errorMessage }}</div>
          <template #footer><button class="btn btn-outline-secondary" type="button" @click="selectedDetailOpen = false">Đóng</button></template>
      </DetailModal>
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

.weekly-template-days {
  display: grid;
  gap: 0.85rem;
}

.weekly-template-day {
  padding: 1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.65rem;
  background: var(--bs-tertiary-bg);
}

.weekly-template-day__heading,
.weekly-template-slot__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.weekly-template-day__heading {
  margin-bottom: 0.75rem;
}

.weekly-template-slot {
  padding: 0.9rem 0 0.15rem;
  border-top: 1px solid var(--bs-border-color);
}

.weekly-template-slot + .weekly-template-slot {
  margin-top: 0.75rem;
}

.weekly-template-slot__heading {
  margin-bottom: 0.75rem;
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

.calendar-event-room {
  color: var(--bs-secondary-color);
  font-size: 0.72rem;
}
</style>
