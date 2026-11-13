<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  addTeacherToClassSchedule,
  createClassSchedule,
  createManualSession,
  correctCompletedSession,
  deleteSession,
  previewDeleteSession,
  removeTeacherFromClassSchedule,
  previewDeleteSessionsForMonth,
  deleteSessionsForMonth,
  previewMonthWeekTemplateReplacement,
  replaceMonthWithWeekTemplate,
  previewMonthWeekTemplateAddition,
  addMonthWithWeekTemplate,
  getMonthWeekScheduleTemplate,
  previewMonthWeekScheduleImport,
  importMonthWeekSchedule,
  correctSessionSchedule,
  correctSessionLearning,
  cancelRoomRental,
  deleteRoomRental,
  createRoomRental,
  createRoomRentalMonth,
  recordAdminSessionAttendance,
  rescheduleRoomRental,
  setCompletedSessionTimesheets,
  setClassScheduleStatus,
  updateClassSchedule,
  updateSessionOccurrence,
  updateSessionStudentRoster,
  syncSessionStudentRoster,
  updateSessionTeachers,
} from '@/services/commands'
import type {
  DeleteSessionPreview,
  RoomRentalConflictDetail,
  MonthWeekScheduleImportPreview,
  MonthWeekTemplateAdditionPreview,
  MonthWeekTemplateAdditionMatch,
  MonthWeekTemplateAdditionRange,
  MonthWeekTemplateDuplicateAction,
  MonthWeekTemplateSlot,
} from '@/services/commands'
import {
  getClassActiveRosterSize,
  getClassMembershipsForSessionDate,
  getClassSchedules,
  getClassSchedulesForClasses,
  getClasses,
  getMySessions,
  getRoomRentals,
  getSessionAttendanceSummaries,
  getSessionStudents,
  getStaff,
} from '@/services/data-queries'
import type { SessionStudentQueryRow } from '@/services/data-queries'
import type { ClassDetailRow, ClassScheduleRow, RoomRental, SessionRow } from '@/shared/types/domain'
import {
  attendanceIsDirty,
  attendanceStatuses,
  attendanceStatusLabel,
  attendanceValidationError,
  createAttendanceValue,
  toAttendanceSaveInput,
  type AttendanceSaveInput,
  type AttendanceStudentRow,
} from '@/modules/staff/attendance'
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
import CompletedSessionAttendanceEditor from '../components/CompletedSessionAttendanceEditor.vue'
import RoomRentalModal from '../components/RoomRentalModal.vue'
import SessionAttendanceExcelModal from '@/modules/staff/components/SessionAttendanceExcelModal.vue'
import {
  addCalendarDays,
  formatBusinessDate,
  formatBusinessMonth,
  formatBusinessTime,
  getBusinessDateKey,
  getMonthGridDateKeys,
  getTimetableTimeRange,
  getWeekDateKeys,
  layoutTimedEvents,
  shiftCalendarMonth,
} from '@/shared/utils/session-calendar'
import {
  downloadMonthWeekScheduleTemplate,
  parseMonthWeekScheduleWorkbook,
  MAX_MONTH_WEEK_SCHEDULE_SLOTS,
  type MonthWeekScheduleExportSlot,
  type MonthWeekScheduleParseIssue,
  type MonthWeekScheduleSlot,
} from '@/modules/admin/utils/month-week-schedule-import'
import type { AttendanceExcelPatchRow } from '@/modules/staff/session-attendance-excel'
import { downloadSessionCommentsPng, toSessionCommentsImageRows } from '../utils/session-comments-image'

type ViewMode = 'month' | 'week' | 'list'
type EventFilter = 'all' | 'sessions' | 'rentals'
type CalendarEvent =
  | { kind: 'session'; id: string; startsAt: string; endsAt: string; session: SessionRow }
  | { kind: 'rental'; id: string; startsAt: string; endsAt: string; rental: RoomRental }
type WeeklyTemplateSlotDraft = MonthWeekTemplateSlot & { client_id: string }
type WeeklyTemplateDayDraft = { day_of_week: number; slots: WeeklyTemplateSlotDraft[] }

const weekdayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const sessions = ref<SessionRow[]>([])
const roomRentals = ref<RoomRental[]>([])
const classes = ref<ClassDetailRow[]>([])
const teachersList = ref<any[]>([])
const schedules = ref<ClassScheduleRow[]>([])
const schedulesByClass = ref<Record<string, ClassScheduleRow[]>>({})
const students = ref<SessionStudentQueryRow[]>([])
const learningRows = ref<AttendanceStudentRow[]>([])
const learningEditorOpen = ref(false)
const excelAttendanceOpen = ref(false)
const openExcelAfterDetailHidden = ref(false)
const returnToDetailAfterExcel = ref(false)
const learningBusy = ref(false)
const learningValidationErrors = ref<Record<string, string>>({})
const learningTeacherValidationError = ref('')
const teacherEligibilityDraft = ref<Record<string, boolean | null>>({})
const sessionNoteInput = ref('')
const lessonYoutubeInput = ref('')
const sessionRosterCandidates = ref<any[]>([])
const sessionRosterCandidateSessionId = ref('')
const selectedRosterStudentIds = ref<string[]>([])
const rosterEditorOpen = ref(false)
const rosterEditorLoading = ref(false)
const rosterEditorBusy = ref(false)
const rosterEditorError = ref('')
const selected = ref<SessionRow | null>(null)
const selectedDetailOpen = ref(false)
const attendedSessionPageOpen = ref(false)
const attendedSessionDetailLoading = ref(false)
const commentsExportBusy = ref(false)
const commentsExportError = ref('')
const selectedTeacherIds = ref<string[]>([])
const teacherSaveBusy = ref(false)
const scheduleSaveBusy = ref(false)
const selectedClassId = ref(typeof route.query.class_id === 'string' ? route.query.class_id : '')
const loading = ref(false)
const scheduleLoading = ref(false)
const sessionsLoaded = ref(false)
const roomRentalsLoaded = ref(false)
const scheduleLoadErrors = ref<Record<string, boolean>>({})
const errorMessage = ref('')
const attendanceSummaryError = ref('')
const attendanceSaveVerification = ref<{ kind: 'success' | 'warning' | 'error'; message: string } | null>(null)
const completedSessionCorrectionBusy = ref(false)
const completedSessionCorrectionError = ref('')
const completedSessionEditOpen = ref(false)
const completedSessionDetailMode = ref(false)
const completedTimesheetBusy = ref(false)
const completedTimesheetError = ref('')
const deleteSessionPreview = ref<DeleteSessionPreview | null>(null)
const startInput = ref('')
const endInput = ref('')
const sessionRoomInput = ref('')
const viewMode = ref<ViewMode>('week')
const eventFilter = ref<EventFilter>('all')
const calendarAnchorDate = ref(getBusinessDateKey(new Date()))
const todayDateKey = ref(getBusinessDateKey(new Date()))
const roomRentalModalOpen = ref(false)
const roomRentalBusy = ref(false)
const roomRentalError = ref('')
const roomRentalLoadError = ref('')
const roomRentalConflicts = ref<RoomRentalConflictDetail[]>([])
const roomRentalEditing = ref<RoomRental | null>(null)
const roomRentalDefaultDate = ref(getBusinessDateKey(new Date()))
const roomRentalRequestVersion = ref(0)
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
const deleteSessionPreviewBusy = ref(false)
const templateEditorOpen = ref(false)
const templatePreviewBusy = ref(false)
const templateAdditionBusy = ref(false)
const templateError = ref('')
const templateOperation = ref<'replace' | 'add'>('replace')
const templateAdditionRange = ref<MonthWeekTemplateAdditionRange>('FULL_MONTH')
const templateAdditionDuplicateAction = ref<MonthWeekTemplateDuplicateAction>('SKIP')
const templateAdditionPreview = ref<MonthWeekTemplateAdditionPreview | null>(null)
const excelScheduleOpen = ref(false)
const excelScheduleBusy = ref(false)
const excelScheduleError = ref('')
const excelScheduleFileName = ref('')
const excelScheduleFileInput = ref<HTMLInputElement | null>(null)
const excelScheduleIssues = ref<MonthWeekScheduleParseIssue[]>([])
const excelScheduleSlots = ref<Array<MonthWeekScheduleSlot & { slot_id: string }>>([])
const excelSchedulePreview = ref<MonthWeekScheduleImportPreview | null>(null)
const excelSchedulePreviewBusy = ref(false)
const weeklyTemplateDays = ref<WeeklyTemplateDayDraft[]>([])
const pendingTemplateMonthStart = ref('')
const pendingTemplateSlots = ref<MonthWeekTemplateSlot[]>([])
let weeklyTemplateSlotSequence = 0
const pendingDeleteMonthStart = ref('')
const showHistory = ref(false)
const showAttendedSessions = ref(false)
const confirmDetails = ref({ title: '', message: '', itemName: '', warning: '', confirmLabel: 'Xác nhận', destructive: false })
const confirmActionType = ref<'archive-schedule' | 'cancel-session' | 'delete-session' | 'sync-session-roster' | 'delete-month-sessions' | 'replace-month-template' | ''>('')
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
const canEditSelectedSession = computed(() => !!selected.value && selected.value.status !== 'CANCELLED')
const canEditSelectedLearning = computed(() => !!selected.value
  && selected.value.status !== 'CANCELLED'
  && (selected.value.status !== 'SCHEDULED' || Date.parse(selected.value.scheduled_start_at) <= Date.now()))
const canAdminFinalizeAttendance = computed(() => !!selected.value
  && selected.value.status !== 'CANCELLED'
  && (selected.value.status === 'IN_PROGRESS'
    || selected.value.status === 'COMPLETED'
    || Date.parse(selected.value.scheduled_end_at) <= Date.now()))
const assignedTeachers = computed(() => (selected.value?.session_staff || [])
  .filter((item) => !item.assignment_role || item.assignment_role === 'TEACHER'))
const adminAttendanceTakenOver = computed(() => assignedTeachers.value.some((item) => item.timesheet_eligible !== null && item.timesheet_eligible !== undefined))
const canCancelOrDeleteSelectedSession = computed(() => !!selected.value
  && selected.value.status === 'SCHEDULED'
  && Date.parse(selected.value.scheduled_start_at) > Date.now())
const canDeleteSelectedSession = computed(() => !!selected.value && selected.value.status !== 'CANCELLED')
const completedTimesheetOnlyChange = computed(() => !!selected.value
  && selected.value.status === 'COMPLETED'
  && teacherEligibilityDirty.value
  && dirtyLearningRows.value.length === 0
  && sessionNoteInput.value.trim() === (selected.value.session_note || '').trim()
  && lessonYoutubeInput.value.trim() === (selected.value.lesson_youtube_url || '').trim())
const isCompletedAttendanceDetail = computed(() => completedSessionDetailMode.value
  && selected.value?.status === 'COMPLETED')
const isAttendedSessionDetailPage = computed(() => attendedSessionPageOpen.value
  && !!selected.value
  && isCompletedAttendanceDetail.value)
const commentsExportDisabled = computed(() => !learningRows.value.length
  || completedSessionEditsDirty.value
  || teacherEligibilityDirty.value
  || learningBusy.value
  || completedSessionCorrectionBusy.value
  || completedTimesheetBusy.value
  || scheduleSaveBusy.value
  || commentsExportBusy.value)
const dirtyLearningRows = computed(() => learningRows.value.filter(attendanceIsDirty))
const attendanceDiagnostics = computed(() => {
  const records = students.value.map(attendanceRecordForStudent).filter((row): row is Record<string, unknown> => Boolean(row))
  const hasValue = (value: unknown) => value !== null && value !== undefined && value !== ''
  return {
    rosterCount: students.value.length,
    attendanceCount: records.length,
    statusCount: records.filter((row) => hasValue(row.status)).length,
    homeworkCount: records.filter((row) => hasValue(row.homework_score)).length,
    understandingCount: records.filter((row) => hasValue(row.understanding_score)).length,
    attitudeCount: records.filter((row) => hasValue(row.attitude_score)).length,
    objectRelationDetected: students.value.some((row) => row.attendance_relation_shape === 'object'),
  }
})
const teacherEligibilityDirty = computed(() => assignedTeachers.value.some((item) =>
  teacherEligibilityDraft.value[item.staff_id] !== (item.timesheet_eligible ?? null)))
const adminAttendanceDirty = computed(() => dirtyLearningRows.value.length > 0 || teacherEligibilityDirty.value)
const learningDirty = computed(() => !!selected.value && (
  sessionNoteInput.value.trim() !== (selected.value.session_note || '').trim()
  || lessonYoutubeInput.value.trim() !== (selected.value.lesson_youtube_url || '').trim()
  || adminAttendanceDirty.value
))
const selectedSessionDate = computed(() => selected.value ? getBusinessDateKey(selected.value.scheduled_start_at) : '')
const completedSessionEditsDirty = computed(() => !!selected.value && isCompletedAttendanceDetail.value && (
  startInput.value !== toLocalInput(selected.value.scheduled_start_at)
  || endInput.value !== toLocalInput(selected.value.scheduled_end_at)
  || sessionRoomInput.value.trim() !== (selected.value.room || selected.value.class_schedules?.room || '').trim()
  || sessionNoteInput.value.trim() !== (selected.value.session_note || '').trim()
  || lessonYoutubeInput.value.trim() !== (selected.value.lesson_youtube_url || '').trim()
  || dirtyLearningRows.value.length > 0
))
const rosterSyncDelta = computed(() => {
  const currentIds = new Set(students.value.map((row) => row.student_id))
  const targetIds = new Set(sessionRosterCandidates.value.map((row) => row.student_id))
  const additions = [...targetIds].filter((studentId) => !currentIds.has(studentId)).length
  const staleRows = students.value.filter((row) => !targetIds.has(row.student_id))
  const retained = staleRows.filter(sessionStudentHasHistory).length
  return { additions, removals: staleRows.length - retained, retained }
})

function sessionStudentHasHistory(row: any) {
  const snapshot = row.assessment_snapshot
  const hasAssessment = snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0
  return Boolean(attendanceRecordForStudent(row) || hasAssessment)
}

function attendanceRecordForStudent(row: { student_attendances?: unknown } | null | undefined): Record<string, unknown> | null {
  if (!row) return null
  const relation = row.student_attendances
  if (Array.isArray(relation)) return (relation[0] as Record<string, unknown> | undefined) || null
  return relation && typeof relation === 'object' ? relation as Record<string, unknown> : null
}

function attendanceRowFromSource(row: any): AttendanceStudentRow {
  const saved = attendanceRecordForStudent(row)
  const snapshot = row.assessment_snapshot || {}
  const value = createAttendanceValue(saved || {
    status: null,
    late_minutes: null,
    absence_reason: null,
    homework_score: null,
    homework_note: snapshot.homework_note,
    understanding_score: snapshot.understanding_raw,
    attitude_score: snapshot.attitude_raw,
    positive_feedback_count: null,
    positive_feedback_raw: snapshot.positive_feedback_raw,
    comment: snapshot.comment_raw,
  })
  return { student_id: row.student_id, students: row.students, attendance: value, initialAttendance: { ...value } }
}

const attendanceVerificationFields: Array<keyof Omit<AttendanceSaveInput, 'student_id'>> = [
  'status', 'late_minutes', 'absence_reason', 'homework_score', 'homework_note',
  'understanding_score', 'attitude_score', 'positive_feedback_count', 'positive_feedback_raw', 'comment',
]

function attendanceRecordMatchesInput(expected: AttendanceSaveInput, actual: Record<string, unknown>) {
  return attendanceVerificationFields.every((field) => {
    const expectedValue = expected[field]
    const actualValue = actual[field]
    if (expectedValue === null) return actualValue === null || actualValue === undefined || actualValue === ''
    if (typeof expectedValue === 'number') return Number.isFinite(Number(actualValue)) && Number(actualValue) === expectedValue
    return actualValue === expectedValue
  })
}

function verifySavedAttendance(expectedRows: AttendanceSaveInput[], processedCount: number, refreshedRows: SessionStudentQueryRow[]) {
  const recordByStudentId = new Map(refreshedRows.map((row) => [row.student_id, attendanceRecordForStudent(row)]))
  const persistedCount = [...recordByStudentId.values()].filter(Boolean).length
  const mismatchedCount = expectedRows.filter((expected) => {
    const actual = recordByStudentId.get(expected.student_id)
    return !actual || !attendanceRecordMatchesInput(expected, actual)
  }).length
  const expectedCount = expectedRows.length

  if (processedCount === expectedCount && persistedCount === expectedCount && mismatchedCount === 0) {
    return {
      kind: 'success' as const,
      message: `Đã xác minh CSDL: máy chủ xử lý ${processedCount}/${expectedCount} học sinh; đọc lại đủ bản ghi và kết quả khớp dữ liệu đã gửi.`,
    }
  }

  return {
    kind: 'warning' as const,
    message: `Cần kiểm tra dữ liệu: máy chủ báo ${processedCount}/${expectedCount}; đọc lại thấy ${persistedCount}/${expectedCount} bản ghi điểm danh, ${mismatchedCount} dòng chưa khớp dữ liệu đã gửi. Hãy tải lại buổi trước khi nhập lại.`,
  }
}

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
const isFullyAttendedSession = (session: SessionRow) => session.status === 'COMPLETED'
  && (session.attendance_summary?.roster_count || 0) > 0
  && session.attendance_summary?.attendance_count === session.attendance_summary?.roster_count
const attendedSessions = computed(() => classSessions.value.filter(isFullyAttendedSession))
const hiddenHistorySessions = computed(() => classSessions.value.filter(isHiddenByHistoryFilter))
const hiddenHistoryRentals = computed(() => roomRentals.value.filter((rental) => rental.status === 'CANCELLED' || getBusinessDateKey(rental.starts_at) < todayDateKey.value))
const visibleSessions = computed(() => showAttendedSessions.value
  ? attendedSessions.value
  : showHistory.value
    ? classSessions.value
    : classSessions.value.filter((session) => !isHiddenByHistoryFilter(session)))
const visibleRentals = computed(() => {
  if (eventFilter.value === 'sessions' || showAttendedSessions.value) return []
  return roomRentals.value.filter((rental) => showHistory.value || (
    rental.status !== 'CANCELLED' && getBusinessDateKey(rental.starts_at) >= todayDateKey.value
  ))
})
const visibleEvents = computed<CalendarEvent[]>(() => {
  const events: CalendarEvent[] = []
  if (eventFilter.value !== 'rentals') {
    events.push(...visibleSessions.value.map((session) => ({
      kind: 'session' as const,
      id: session.id,
      startsAt: session.scheduled_start_at,
      endsAt: session.scheduled_end_at,
      session,
    })))
  }
  if (!showAttendedSessions.value) {
    events.push(...visibleRentals.value.map((rental) => ({
      kind: 'rental' as const,
      id: rental.id,
      startsAt: rental.starts_at,
      endsAt: rental.ends_at,
      rental,
    })))
  }
  return events.sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id))
})
const monthDateKeys = computed(() => getMonthGridDateKeys(calendarAnchorDate.value))
const weekDateKeys = computed(() => getWeekDateKeys(calendarAnchorDate.value))
const visibleDateKeys = computed(() => viewMode.value === 'week' ? weekDateKeys.value : monthDateKeys.value)
const roomRentalQueryRange = computed(() => {
  if (viewMode.value === 'list') return { from: undefined, to: undefined }
  const first = visibleDateKeys.value[0]
  const last = visibleDateKeys.value[visibleDateKeys.value.length - 1]
  return {
    from: localDateTime(first, '00:00'),
    to: localDateTime(addCalendarDays(last, 1), '00:00'),
  }
})
const sessionDateKeysInView = computed(() => new Set(visibleDateKeys.value))
const sessionsInView = computed(() => classSessions.value.filter((session) => sessionDateKeysInView.value.has(getBusinessDateKey(session.scheduled_start_at))))
const visibleSessionsInView = computed(() => visibleSessions.value.filter((session) => sessionDateKeysInView.value.has(getBusinessDateKey(session.scheduled_start_at))))
const hiddenHistorySessionsInView = computed(() => sessionsInView.value.filter(isHiddenByHistoryFilter))
const sessionsHiddenByClassFilterInView = computed(() => sessionsHiddenByClassFilter.value.filter((session) => sessionDateKeysInView.value.has(getBusinessDateKey(session.scheduled_start_at))))
const visibleEventsByDate = computed<Record<string, CalendarEvent[]>>(() => {
  const grouped: Record<string, CalendarEvent[]> = {}
  for (const event of visibleEvents.value) {
    const key = getBusinessDateKey(event.startsAt)
    if (!sessionDateKeysInView.value.has(key)) continue
    grouped[key] = [...(grouped[key] || []), event]
  }
  return grouped
})
const weekEvents = computed(() => weekDateKeys.value.flatMap((dateKey) => visibleEventsByDate.value[dateKey] || []))
const timetableRange = computed(() => getTimetableTimeRange(weekEvents.value))
const timetableHeightPx = computed(() => timetableRange.value.endMinute - timetableRange.value.startMinute)
const timetableTicks = computed(() => {
  const ticks: Array<{ minute: number; label: string; hour: boolean }> = []
  for (let minute = timetableRange.value.startMinute; minute <= timetableRange.value.endMinute; minute += 30) {
    const dayOffset = Math.floor(minute / (24 * 60))
    const dayMinute = ((minute % (24 * 60)) + (24 * 60)) % (24 * 60)
    const time = `${String(Math.floor(dayMinute / 60)).padStart(2, '0')}:${String(dayMinute % 60).padStart(2, '0')}`
    ticks.push({ minute, label: dayOffset ? `${time} +${dayOffset}` : time, hour: minute % 60 === 0 })
  }
  return ticks
})
const timetableEventsByDate = computed(() => Object.fromEntries(weekDateKeys.value.map((dateKey) => [
  dateKey,
  layoutTimedEvents(visibleEventsByDate.value[dateKey] || []).map((placement) => ({
    ...placement,
    topPx: placement.startMinute - timetableRange.value.startMinute,
    heightPx: placement.endMinute - placement.startMinute,
  })),
])))
const agendaEvents = computed(() => visibleEvents.value.filter((event) => sessionDateKeysInView.value.has(getBusinessDateKey(event.startsAt))))
const listEmptyMessage = computed(() => {
  if (eventFilter.value === 'rentals') {
    return hiddenHistoryRentals.value.length && !showHistory.value
      ? `Chưa có lượt thuê sắp tới. ${hiddenHistoryRentals.value.length} lượt cũ hoặc đã hủy đang ẩn.`
      : 'Chưa có lượt thuê phòng trong danh sách.'
  }
  if (showAttendedSessions.value) {
    return attendanceSummaryError.value || 'Không có buổi đã hoàn tất với đủ điểm danh trong lịch.'
  }
  if (classSessions.value.length) {
    const hiddenCount = hiddenHistorySessions.value.length + (eventFilter.value === 'all' ? hiddenHistoryRentals.value.length : 0)
    return hiddenCount
      ? eventFilter.value === 'all' && hiddenHistoryRentals.value.length
        ? `Không có lịch sắp tới. ${hiddenCount} buổi hoặc lượt thuê cũ/đã hủy đang ẩn.`
        : `Không có buổi sắp tới. ${hiddenHistorySessions.value.length} buổi cũ hoặc đã hủy đang ẩn.`
      : eventFilter.value === 'all' && roomRentals.value.length === 0 ? 'Chưa có buổi học trong danh sách.' : eventFilter.value === 'all' ? 'Chưa có buổi học hoặc lượt thuê phòng.' : 'Chưa có buổi học trong danh sách.'
  }
  if (selectedClassId.value && sessionsHiddenByClassFilter.value.length) {
    return `Lớp đang chọn chưa có buổi học. ${sessionsHiddenByClassFilter.value.length} buổi ở lớp khác đang bị bộ lọc lớp ẩn.`
  }
  if (eventFilter.value === 'all' && roomRentals.value.length) return 'Không có buổi học hiển thị theo bộ lọc hiện tại.'
  return selectedClassId.value ? 'Lớp đang chọn chưa có buổi học.' : eventFilter.value === 'all' && !roomRentals.value.length ? 'Chưa có buổi học nào.' : eventFilter.value === 'all' ? 'Chưa có buổi học hoặc lượt thuê phòng.' : 'Chưa có buổi học nào.'
})
const calendarEmptyMessage = computed(() => {
  if (eventFilter.value === 'rentals') {
    return hiddenHistoryRentals.value.length && !showHistory.value
      ? `Không có lượt thuê sắp tới trong kỳ này. ${hiddenHistoryRentals.value.length} lượt cũ hoặc đã hủy đang ẩn.`
      : 'Không có lượt thuê phòng trong khoảng thời gian này.'
  }
  if (showAttendedSessions.value) {
    return attendanceSummaryError.value || 'Không có buổi đã hoàn tất với đủ điểm danh trong kỳ này.'
  }
  const hiddenReasons = [
    hiddenHistorySessionsInView.value.length
      ? `${hiddenHistorySessionsInView.value.length} buổi cũ hoặc đã hủy đang ẩn`
      : '',
    eventFilter.value === 'all' && hiddenHistoryRentals.value.length
      ? `${hiddenHistoryRentals.value.length} lượt thuê cũ hoặc đã hủy đang ẩn`
      : '',
    sessionsHiddenByClassFilterInView.value.length
      ? `${sessionsHiddenByClassFilterInView.value.length} buổi ở lớp khác đang bị bộ lọc lớp ẩn`
      : '',
  ].filter(Boolean)
  if (hiddenReasons.length) {
    return eventFilter.value === 'all' && !hiddenHistoryRentals.value.length
      ? `Không có buổi học nào hiển thị trong kỳ này. ${hiddenReasons.join('; ')}.`
      : `Không có lịch nào hiển thị trong kỳ này. ${hiddenReasons.join('; ')}.`
  }
  if (visibleEvents.value.length) return eventFilter.value === 'all' && !roomRentals.value.length ? 'Không có buổi học trong khoảng thời gian này.' : 'Không có lịch trong khoảng thời gian này.'
  if (hiddenHistorySessions.value.length) {
    return `Không có buổi sắp tới trong kỳ này. ${hiddenHistorySessions.value.length} buổi cũ hoặc đã hủy đang ẩn.`
  }
  return listEmptyMessage.value
})
const periodTitle = computed(() => viewMode.value === 'month'
  ? formatBusinessMonth(calendarAnchorDate.value)
  : `${formatBusinessDate(weekDateKeys.value[0])} – ${formatBusinessDate(weekDateKeys.value[6])}`)
const visibleCalendarEventCount = computed(() => visibleDateKeys.value.reduce((total, dateKey) => total + (visibleEventsByDate.value[dateKey]?.length || 0), 0))
const displayedMonthStart = computed(() => `${calendarAnchorDate.value.slice(0, 7)}-01`)
const excelScheduleCanApply = computed(() => !!excelSchedulePreview.value
  && !excelScheduleIssues.value.length
  && !excelSchedulePreview.value.blockers.length
  && !excelScheduleBusy.value
  && !excelSchedulePreviewBusy.value)

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

function rentalTeacherName(rental: RoomRental) {
  return rental.staff?.full_name || teachersList.value.find((teacher) => teacher.id === rental.staff_id)?.full_name || 'Chưa có tên giáo viên'
}

function eventTypeLabel(event: CalendarEvent) {
  return event.kind === 'rental' ? 'Thuê phòng' : 'Buổi học'
}

function eventPrimaryLabel(event: CalendarEvent) {
  return event.kind === 'rental' ? rentalTeacherName(event.rental) : className(event.session)
}

function eventRoom(event: CalendarEvent) {
  return event.kind === 'rental'
    ? event.rental.room
    : event.session.room || event.session.class_schedules?.room || 'Chưa xếp phòng'
}

function eventStatusLabel(event: CalendarEvent) {
  return event.kind === 'rental' ? (event.rental.status === 'CANCELLED' ? 'Đã hủy' : 'Đã đặt') : event.session.status
}

function eventStatusClass(event: CalendarEvent) {
  return event.kind === 'rental'
    ? event.rental.status === 'CANCELLED' ? 'text-bg-danger' : 'text-bg-info'
    : sessionStatusClass(event.session.status)
}

function eventAriaLabel(event: CalendarEvent) {
  const detail = event.kind === 'rental' ? `Thuê phòng ${event.rental.room}, ${rentalTeacherName(event.rental)}` : className(event.session)
  return `${formatBusinessTime(event.startsAt)} ${detail}, ${eventStatusLabel(event)}`
}

function eventCanOpen(event: CalendarEvent) {
  return event.kind === 'session' || event.kind === 'rental'
}

function openCreateRoomRental() {
  roomRentalEditing.value = null
  roomRentalDefaultDate.value = refreshTodayDateKey()
  roomRentalError.value = ''
  roomRentalConflicts.value = []
  roomRentalModalOpen.value = true
}

function openRoomRental(event: CalendarEvent) {
  if (event.kind !== 'rental') return
  roomRentalEditing.value = event.rental
  roomRentalDefaultDate.value = refreshTodayDateKey()
  roomRentalError.value = ''
  roomRentalConflicts.value = []
  roomRentalModalOpen.value = true
}

function selectCalendarEvent(event: CalendarEvent) {
  if (event.kind === 'session') void selectSession(event.session)
  else openRoomRental(event)
}

function setEventFilter(value: EventFilter) {
  eventFilter.value = value
  if (value === 'rentals') showAttendedSessions.value = false
}

function errorDetails(error: unknown): RoomRentalConflictDetail[] {
  if (!error || typeof error !== 'object') return []
  const details = (error as { details?: unknown }).details
  if (!Array.isArray(details)) return []
  return details.filter((row): row is RoomRentalConflictDetail =>
    !!row && typeof row === 'object'
      && typeof row.key === 'string'
      && typeof row.type === 'string'
      && typeof row.date === 'string'
      && typeof row.start_time === 'string'
      && typeof row.end_time === 'string'
      && typeof row.starts_at === 'string'
      && typeof row.ends_at === 'string'
      && typeof row.room === 'string'
      && typeof row.reason === 'string'
      && typeof row.can_override === 'boolean')
}

function clearRoomRentalConflicts() {
  roomRentalError.value = ''
  roomRentalConflicts.value = []
}

async function saveRoomRental(input: Parameters<typeof createRoomRental>[0]) {
  roomRentalBusy.value = true
  roomRentalError.value = ''
  roomRentalConflicts.value = []
  try {
    await createRoomRental(input)
    roomRentalModalOpen.value = false
    calendarAnchorDate.value = input.date
    toast.success('Đã tạo lượt thuê phòng.')
    await load()
  } catch (error) {
    roomRentalError.value = userErrorMessage(error, 'Không thể tạo lượt thuê phòng.')
    roomRentalConflicts.value = errorDetails(error)
  } finally {
    roomRentalBusy.value = false
  }
}

async function saveRoomRentalMonth(input: Parameters<typeof createRoomRentalMonth>[0]) {
  roomRentalBusy.value = true
  roomRentalError.value = ''
  roomRentalConflicts.value = []
  try {
    const result = await createRoomRentalMonth(input)
    roomRentalModalOpen.value = false
    calendarAnchorDate.value = input.month_start
    const createdCount = result.created_count || 0
    const overwrittenCount = result.overwritten_count || 0
    toast.success(`Đã tạo ${createdCount} lượt mới và ghi đè ${overwrittenCount} lượt thuê trùng.`)
    await load()
  } catch (error) {
    roomRentalError.value = userErrorMessage(error, 'Không thể tạo lịch thuê phòng trong tháng.')
    roomRentalConflicts.value = errorDetails(error)
  } finally {
    roomRentalBusy.value = false
  }
}

async function changeRoomRentalSchedule(input: Parameters<typeof rescheduleRoomRental>[0]) {
  roomRentalBusy.value = true
  roomRentalError.value = ''
  roomRentalConflicts.value = []
  try {
    await rescheduleRoomRental(input)
    roomRentalModalOpen.value = false
    calendarAnchorDate.value = input.date
    toast.success('Đã đổi lịch thuê phòng.')
    await load()
  } catch (error) {
    roomRentalError.value = userErrorMessage(error, 'Không thể đổi lịch thuê phòng.')
    roomRentalConflicts.value = errorDetails(error)
  } finally {
    roomRentalBusy.value = false
  }
}

async function cancelRoomRentalOccurrence(id: string) {
  roomRentalBusy.value = true
  roomRentalError.value = ''
  try {
    await cancelRoomRental(id)
    roomRentalModalOpen.value = false
    toast.success('Đã hủy lượt thuê phòng. Lịch sử được giữ lại.')
    await load()
  } catch (error) {
    roomRentalError.value = userErrorMessage(error, 'Không thể hủy lượt thuê phòng.')
  } finally {
    roomRentalBusy.value = false
  }
}

async function deleteRoomRentalOccurrence(id: string) {
  if (!roomRentalEditing.value || roomRentalEditing.value.id !== id) return
  roomRentalBusy.value = true
  roomRentalError.value = ''
  try {
    await deleteRoomRental(id)
    roomRentalModalOpen.value = false
    roomRentalEditing.value = null
    toast.success('Đã xóa vĩnh viễn lượt thuê phòng. Nhật ký audit được giữ lại.')
    await load()
  } catch (error) {
    roomRentalError.value = userErrorMessage(error, 'Không thể xóa vĩnh viễn lượt thuê phòng. Dữ liệu vẫn được giữ nguyên.')
  } finally {
    roomRentalBusy.value = false
  }
}

async function reloadRoomRentalsForCurrentRange() {
  const requestVersion = ++roomRentalRequestVersion.value
  const range = roomRentalQueryRange.value
  try {
    const rentals = await getRoomRentals(range.from, range.to)
    if (requestVersion !== roomRentalRequestVersion.value) return
    roomRentals.value = rentals
    roomRentalsLoaded.value = true
    roomRentalLoadError.value = ''
  } catch (error) {
    if (requestVersion !== roomRentalRequestVersion.value) return
    roomRentalLoadError.value = userErrorMessage(error, 'Không thể tải lịch thuê phòng cho khoảng thời gian này.')
  }
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
  showAttendedSessions.value = false
  showHistory.value = true
  if (!visibleSessionsInView.value.length && hiddenHistorySessions.value.length) viewMode.value = 'list'
}

function toggleHistory() {
  showAttendedSessions.value = false
  showHistory.value = !showHistory.value
}

function toggleAttendedSessions() {
  if (attendanceSummaryError.value) return
  showAttendedSessions.value = !showAttendedSessions.value
  if (showAttendedSessions.value) {
    eventFilter.value = 'sessions'
    showHistory.value = false
    if (selected.value && isFullyAttendedSession(selected.value)) completedSessionDetailMode.value = true
  }
}

async function load(): Promise<boolean> {
  loading.value = true
  let sessionsRequestSucceeded = false
  refreshTodayDateKey()
  errorMessage.value = ''
  attendanceSummaryError.value = ''
  roomRentalLoadError.value = ''
  const rentalRequestVersion = ++roomRentalRequestVersion.value
  const rentalRange = roomRentalQueryRange.value
  try {
    const [sessionResult, classResult, staffResult, rentalResult] = await Promise.allSettled([
      getMySessions(),
      getClasses(),
      getStaff(),
      getRoomRentals(rentalRange.from, rentalRange.to),
    ])
    const loadErrors: string[] = []

    if (sessionResult.status === 'fulfilled') {
      try {
        const summarySessionIds = sessionResult.value
          .filter((session) => session.status === 'COMPLETED')
          .map((session) => session.id)
        const summaries = await getSessionAttendanceSummaries(summarySessionIds)
        sessions.value = sessionResult.value.map((session) => ({
          ...session,
          attendance_summary: summaries[session.id] || { roster_count: 0, attendance_count: 0 },
        }))
      } catch (error) {
        sessions.value = sessionResult.value
        attendanceSummaryError.value = userErrorMessage(error, 'Không thể kiểm tra số bản ghi điểm danh trong CSDL.')
      }
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

    if (rentalResult.status === 'fulfilled') {
      if (rentalRequestVersion === roomRentalRequestVersion.value) {
        roomRentals.value = rentalResult.value
        roomRentalsLoaded.value = true
      }
    } else {
      const message = rentalResult.reason instanceof Error ? rentalResult.reason.message : 'Không thể tải lịch thuê phòng.'
      roomRentalLoadError.value = message
      loadErrors.push(message)
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

function monthScheduleExcelErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST202') {
    return 'Máy chủ chưa cập nhật chức năng Excel lịch tháng (migration 0058). Hãy cập nhật backend trước khi nhập biểu mẫu.'
  }
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
  if (!attendedSessionPageOpen.value && selected.value && !rows.some((session) => session.id === selected.value?.id)) {
    selected.value = null
    selectedDetailOpen.value = false
    completedSessionDetailMode.value = false
    completedSessionEditOpen.value = false
    students.value = []
    selectedTeacherIds.value = []
    teacherEligibilityDraft.value = {}
  }
})

async function selectSession(session: SessionRow, attendedDetail = showAttendedSessions.value) {
  const openAttendedPage = attendedDetail && isFullyAttendedSession(session)
  selected.value = session
  deleteSessionPreview.value = null
  completedSessionDetailMode.value = openAttendedPage
  attendedSessionPageOpen.value = openAttendedPage
  selectedDetailOpen.value = !openAttendedPage
  attendedSessionDetailLoading.value = true
  commentsExportError.value = ''
  students.value = []
  learningRows.value = []
  completedSessionEditOpen.value = false
  completedSessionCorrectionError.value = ''
  completedTimesheetError.value = ''
  rosterEditorOpen.value = false
  learningEditorOpen.value = false
  rosterEditorError.value = ''
  learningValidationErrors.value = {}
  learningTeacherValidationError.value = ''
  sessionRosterCandidates.value = []
  sessionRosterCandidateSessionId.value = ''
  selectedTeacherIds.value = (session.session_staff || []).map((item) => item.staff_id)
  teacherEligibilityDraft.value = Object.fromEntries((session.session_staff || [])
    .filter((item) => !item.assignment_role || item.assignment_role === 'TEACHER')
    .map((item) => [item.staff_id, item.timesheet_eligible ?? null]))
  startInput.value = toLocalInput(session.scheduled_start_at)
  endInput.value = toLocalInput(session.scheduled_end_at)
  sessionRoomInput.value = session.room ?? session.class_schedules?.room ?? ''
  sessionNoteInput.value = session.session_note || ''
  lessonYoutubeInput.value = session.lesson_youtube_url || ''
  errorMessage.value = ''
  attendanceSaveVerification.value = null
  try {
    const [studentsResult, schedulesResult] = await Promise.allSettled([
      getSessionStudents(session.id),
      loadClassSchedules(session.class_id),
    ])
    if (studentsResult.status === 'fulfilled') {
      students.value = studentsResult.value as any[]
      learningRows.value = students.value.map(attendanceRowFromSource)
    } else {
      errorMessage.value = studentsResult.reason instanceof Error ? studentsResult.reason.message : 'Không thể tải chi tiết buổi học.'
    }
    if (schedulesResult.status === 'rejected') {
      scheduleLoadErrors.value = { ...scheduleLoadErrors.value, [session.class_id]: true }
      if (!errorMessage.value) errorMessage.value = schedulesResult.reason instanceof Error ? schedulesResult.reason.message : 'Không thể tải phân công giáo viên của lớp.'
    }
  } finally {
    attendedSessionDetailLoading.value = false
  }

  if (openAttendedPage && route.query.session_id !== session.id) {
    await router.push({ path: '/admin/sessions', query: { ...route.query, session_id: session.id } })
  }
}

function queryWithoutSessionId() {
  const query = { ...route.query }
  delete query.session_id
  return query
}

async function openAttendedSessionFromRoute() {
  const sessionId = typeof route.query.session_id === 'string' ? route.query.session_id : ''
  if (!sessionId || !sessionsLoaded.value) return

  const session = sessions.value.find((row) => row.id === sessionId)
  if (!session || !isFullyAttendedSession(session)) {
    errorMessage.value = 'Không tìm thấy buổi đã điểm danh đầy đủ.'
    await router.replace({ path: '/admin/sessions', query: queryWithoutSessionId() })
    return
  }

  showAttendedSessions.value = true
  showHistory.value = false
  eventFilter.value = 'sessions'
  if (selected.value?.id === sessionId && isCompletedAttendanceDetail.value) {
    attendedSessionPageOpen.value = true
    selectedDetailOpen.value = false
    return
  }

  await selectSession(session, true)
}

function returnToSessionsCalendar() {
  const back = window.history.state?.back
  if (typeof back === 'string' && back.startsWith('/admin/sessions') && !back.includes('session_id=')) {
    void router.back()
    return
  }
  void router.replace({ path: '/admin/sessions', query: queryWithoutSessionId() })
}

async function exportSessionComments() {
  if (!selected.value || commentsExportDisabled.value) return
  commentsExportBusy.value = true
  commentsExportError.value = ''
  try {
    await downloadSessionCommentsPng({
      className: className(selected.value),
      dateLabel: formatBusinessDate(selectedSessionDate.value),
      rows: toSessionCommentsImageRows(learningRows.value),
    })
  } catch (error) {
    commentsExportError.value = userErrorMessage(error, 'Không thể xuất ảnh nhận xét.')
  } finally {
    commentsExportBusy.value = false
  }
}

function clearAttendedSessionPage() {
  attendedSessionPageOpen.value = false
  completedSessionDetailMode.value = false
  selectedDetailOpen.value = false
  selected.value = null
  students.value = []
  learningRows.value = []
  selectedTeacherIds.value = []
  teacherEligibilityDraft.value = {}
}

function openExcelAttendance() {
  if (!selected.value || !canAdminFinalizeAttendance.value || learningBusy.value || rosterEditorBusy.value || !learningRows.value.length) return
  if (isAttendedSessionDetailPage.value) {
    excelAttendanceOpen.value = true
    return
  }
  openExcelAfterDetailHidden.value = true
  returnToDetailAfterExcel.value = true
  selectedDetailOpen.value = false
}

function handleSelectedDetailHidden() {
  if (!openExcelAfterDetailHidden.value) return
  openExcelAfterDetailHidden.value = false
  excelAttendanceOpen.value = true
}

function handleExcelAttendanceHidden() {
  if (!returnToDetailAfterExcel.value) return
  returnToDetailAfterExcel.value = false
  selectedDetailOpen.value = !isAttendedSessionDetailPage.value && Boolean(selected.value)
}

function applyExcelAttendance(patches: AttendanceExcelPatchRow[]) {
  const patchByStudentId = new Map(patches.map((row) => [row.student_id, row.patch]))
  for (const row of learningRows.value) {
    const patch = patchByStudentId.get(row.student_id)
    if (patch) Object.assign(row.attendance, patch)
  }
  learningValidationErrors.value = {}
  learningTeacherValidationError.value = ''
  learningEditorOpen.value = true
  toast.success(`Đã nạp dữ liệu Excel cho ${patches.length} học sinh. Rà lại quyết định chấm công rồi xác nhận lưu.`)
}

async function loadSessionRosterCandidates(session: SessionRow, force = false) {
  if (!force && sessionRosterCandidateSessionId.value === session.id) return
  sessionRosterCandidates.value = await getClassMembershipsForSessionDate(
    session.class_id,
    getBusinessDateKey(session.scheduled_start_at),
  )
  sessionRosterCandidateSessionId.value = session.id
}

async function openRosterEditor() {
  if (!selected.value || !canEditSelectedSession.value) return
  const session = selected.value
  rosterEditorLoading.value = true
  rosterEditorError.value = ''
  try {
    await loadSessionRosterCandidates(session, true)
    const eligibleIds = new Set(sessionRosterCandidates.value.map((row) => row.student_id))
    selectedRosterStudentIds.value = students.value
      .map((row) => row.student_id)
      .filter((studentId) => eligibleIds.has(studentId))
    rosterEditorOpen.value = true
  } catch (error) {
    rosterEditorError.value = userErrorMessage(error, 'Không thể tải thành viên có hiệu lực của lớp trong ngày này.')
  } finally {
    rosterEditorLoading.value = false
  }
}

async function refreshSelectedRoster(sessionId: string) {
  const refreshed = await getSessionStudents(sessionId)
  if (selected.value?.id === sessionId) {
    students.value = refreshed as any[]
    learningRows.value = students.value.map(attendanceRowFromSource)
  }
}

function blockRosterSaveWithPendingLearningEdits() {
  if (!learningDirty.value) return false
  rosterEditorError.value = 'Hãy lưu nội dung, điểm danh và đánh giá đang sửa trước khi thay đổi danh sách học sinh.'
  return true
}

async function saveSelectedRoster() {
  if (!selected.value || rosterEditorBusy.value || !canEditSelectedSession.value) return
  if (blockRosterSaveWithPendingLearningEdits()) return
  rosterEditorBusy.value = true
  rosterEditorError.value = ''
  try {
    const result = await updateSessionStudentRoster({
      session_id: selected.value.id,
      student_ids: selectedRosterStudentIds.value,
    })
    rosterEditorOpen.value = false
    await refreshSelectedRoster(selected.value.id)
    toast.success(`Đã lưu danh sách: thêm ${result.added}, gỡ ${result.removed}, giữ ${result.retained_with_history} dòng có lịch sử.`)
  } catch (error) {
    rosterEditorError.value = userErrorMessage(error, 'Không thể lưu danh sách học sinh. Dữ liệu đang chọn vẫn được giữ.')
  } finally {
    rosterEditorBusy.value = false
  }
}

async function prepareSessionRosterSync() {
  if (!selected.value || !canEditSelectedSession.value) return
  if (blockRosterSaveWithPendingLearningEdits()) return
  rosterEditorError.value = ''
  try {
    await loadSessionRosterCandidates(selected.value, true)
    confirmActionType.value = 'sync-session-roster'
    confirmDetails.value = {
      title: 'Đồng bộ học sinh của buổi học?',
      message: `Danh sách sẽ khớp với thành viên ACTIVE có membership hiệu lực trong lớp vào ngày ${formatBusinessDate(selectedSessionDate.value)}.`,
      itemName: `${className(selected.value)} · ${formatDateTime(selected.value.scheduled_start_at)}`,
      warning: `Ước tính thêm ${rosterSyncDelta.value.additions}, gỡ ${rosterSyncDelta.value.removals}. Buổi học sẽ giữ nguyên mọi dòng đã có điểm danh, đánh giá hoặc dữ liệu được bảo vệ.`,
      confirmLabel: 'Đồng bộ danh sách',
      destructive: rosterSyncDelta.value.removals > 0,
    }
    deleteError.value = ''
    confirmOpen.value = true
  } catch (error) {
    errorMessage.value = userErrorMessage(error, 'Không thể tải thành viên có hiệu lực của lớp trong ngày này.')
  }
}

async function syncSelectedSessionRoster() {
  if (!selected.value) return
  if (blockRosterSaveWithPendingLearningEdits()) {
    deleteError.value = rosterEditorError.value
    return
  }
  const sessionId = selected.value.id
  try {
    const result = await syncSessionStudentRoster(sessionId)
    confirmBusy.value = false
    confirmOpen.value = false
    rosterEditorOpen.value = false
    selectedRosterStudentIds.value = []
    toast.success(`Đã đồng bộ: thêm ${result.added}, gỡ ${result.removed}, giữ ${result.retained_with_history} dòng có lịch sử.`)
    await refreshSelectedRoster(sessionId)
    sessionRosterCandidates.value = []
    sessionRosterCandidateSessionId.value = ''
  } catch (error) {
    deleteError.value = userErrorMessage(error, 'Không thể đồng bộ danh sách học sinh. Danh sách buổi học chưa được thay đổi.')
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

function openWeeklyTemplate(operation: 'replace' | 'add' = 'replace') {
  initializeWeeklyTemplate()
  templateOperation.value = operation
  templateAdditionRange.value = 'FULL_MONTH'
  templateAdditionDuplicateAction.value = 'SKIP'
  templateAdditionPreview.value = null
  templateError.value = ''
  templateEditorOpen.value = true
}

async function downloadMonthScheduleWorkbook() {
  try {
    let slots: MonthWeekScheduleSlot[] = []
    let savedTemplate: Awaited<ReturnType<typeof getMonthWeekScheduleTemplate>> = null
    let templateStorageUnavailable = false
    try {
      savedTemplate = await getMonthWeekScheduleTemplate(displayedMonthStart.value)
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'PGRST202')) throw error
      // Before migration 0058, create the first workbook from the active weekly schedules.
      templateStorageUnavailable = true
    }
    if (savedTemplate) {
      slots = savedTemplate.slots.map((slot) => ({
        ...slot,
        slot_id: slot.slot_id || '',
        room: slot.room || '',
      }))
    } else {
      const activeClasses = activeTemplateClasses.value
      const scheduleRows = await getClassSchedulesForClasses(activeClasses.map((row) => row.id))
      slots = scheduleRows.map((schedule) => {
        const assignments = schedule.class_schedule_staff || []
        const unavailableAssignment = assignments.find((assignment) => !teachersList.value.some((teacher) =>
          teacher.id === assignment.staff_id && teacher.status === 'ACTIVE' && (!teacher.staff_type || teacher.staff_type === 'TEACHER')))
        const classRow = activeClasses.find((row) => row.id === schedule.class_id)
        if (unavailableAssignment) {
          throw new Error(`Lịch ${classRow?.code || schedule.id} có giáo viên đã ngừng hoạt động hoặc không còn quyền dạy. Hãy cập nhật lịch lặp trước khi xuất mẫu.`)
        }
        const staffIds = assignments.map((assignment) => assignment.staff_id)
        if (!staffIds.length) {
          throw new Error(`Lịch ${classRow?.code || schedule.id} chưa có giáo viên hoạt động. Hãy cập nhật lịch lặp trước khi xuất mẫu.`)
        }
        return {
          slot_id: schedule.id,
          source_schedule_id: schedule.id,
          day_of_week: schedule.day_of_week,
          class_id: schedule.class_id,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          room: schedule.room || '',
          staff_ids: staffIds,
        }
      })
    }

    if (slots.length > MAX_MONTH_WEEK_SCHEDULE_SLOTS) {
      throw new Error(`Có ${slots.length} lịch tuần đang bật; biểu mẫu chỉ hỗ trợ tối đa ${MAX_MONTH_WEEK_SCHEDULE_SLOTS} dòng.`)
    }

    const classById = new Map(classes.value.map((row) => [row.id, row]))
    const teacherById = new Map(teachersList.value.map((row) => [row.id, row]))
    const exportSlots: MonthWeekScheduleExportSlot[] = slots.map((slot) => {
      const classRow = classById.get(slot.class_id)
      const teacherRows = slot.staff_ids.map((id) => teacherById.get(id))
      if (!classRow?.code) throw new Error('Không thể xuất mẫu vì có lớp không còn trong danh sách. Hãy làm mới trang.')
      if (!teacherRows.length || teacherRows.some((teacher) => !teacher?.staff_code)) {
        throw new Error(`Không thể xuất mẫu cho lớp ${classRow.code}: một giáo viên đang hoạt động chưa có mã.`)
      }
      return {
        ...slot,
        slot_id: slot.slot_id || slot.source_schedule_id || '',
        class_code: classRow.code,
        teacher_codes: teacherRows.map((teacher) => teacher!.staff_code as string),
      }
    })
    await downloadMonthWeekScheduleTemplate(displayedMonthStart.value, exportSlots)
    toast.success(`Đã tải biểu mẫu lịch tuần cho ${formatBusinessMonth(displayedMonthStart.value)}.`)
    if (templateStorageUnavailable) {
      toast.info('Biểu mẫu được tạo từ lịch tuần đang bật. Máy chủ cần migration 0058 trước khi có thể nhập lịch Excel.')
    }
  } catch (error) {
    excelScheduleError.value = monthScheduleExcelErrorMessage(error, 'Không thể tải biểu mẫu Excel lịch tháng.')
    toast.error(excelScheduleError.value)
  }
}

function openExcelScheduleImport() {
  excelScheduleError.value = ''
  excelScheduleFileName.value = ''
  excelScheduleIssues.value = []
  excelScheduleSlots.value = []
  excelSchedulePreview.value = null
  excelScheduleOpen.value = true
}

function resetExcelScheduleFile() {
  if (excelScheduleFileInput.value) excelScheduleFileInput.value.value = ''
  excelScheduleError.value = ''
  excelScheduleFileName.value = ''
  excelScheduleIssues.value = []
  excelScheduleSlots.value = []
  excelSchedulePreview.value = null
}

async function readExcelScheduleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  excelScheduleError.value = ''
  excelScheduleFileName.value = file?.name || ''
  excelScheduleIssues.value = []
  excelScheduleSlots.value = []
  excelSchedulePreview.value = null
  if (!file) return

  const currentMonthStart = `${getBusinessDateKey(new Date()).slice(0, 7)}-01`
  if (displayedMonthStart.value < currentMonthStart) {
    excelScheduleError.value = 'Chỉ nhập lịch cho tháng hiện tại hoặc tháng tương lai.'
    return
  }

  excelSchedulePreviewBusy.value = true
  try {
    const parsed = await parseMonthWeekScheduleWorkbook(file, displayedMonthStart.value, {
      classes: classes.value.map(({ id, code, status }) => ({ id, code, status })),
      teachers: teachersList.value.map(({ id, staff_code, status, staff_type }) => ({ id, staff_code, status, staff_type })),
    })
    excelScheduleIssues.value = parsed.issues
    excelScheduleSlots.value = parsed.slots
    if (parsed.issues.length) return
    excelSchedulePreview.value = await previewMonthWeekScheduleImport(parsed.month_start, parsed.slots.map(({ source_row_number: _sourceRowNumber, ...slot }) => slot))
  } catch (error) {
    excelScheduleError.value = monthScheduleExcelErrorMessage(error, 'Không thể đọc hoặc kiểm tra biểu mẫu Excel.')
  } finally {
    excelSchedulePreviewBusy.value = false
  }
}

async function applyExcelScheduleImport() {
  if (!excelScheduleCanApply.value || excelScheduleBusy.value) return
  excelScheduleBusy.value = true
  excelScheduleError.value = ''
  try {
    const monthStart = displayedMonthStart.value
    const result = await importMonthWeekSchedule(monthStart, excelScheduleSlots.value.map(({ source_row_number: _sourceRowNumber, ...slot }) => slot))
    excelScheduleOpen.value = false
    excelSchedulePreview.value = null
    excelScheduleSlots.value = []
    const refreshed = await load()
    const summary = `Đã tạo ${result.created_sessions}, cập nhật ${result.updated_sessions}, hủy ${result.cancelled_sessions} buổi; giữ nguyên ${result.preserved_sessions} buổi có lịch sử cho ${formatBusinessMonth(monthStart)}.`
    if (!refreshed) {
      errorMessage.value = `${summary} Chưa tải lại được lịch; hãy nhấn “Làm mới”.`
      toast.info(summary)
    } else {
      toast.success(summary)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('IMPORT_BLOCKED')) {
      try {
        excelSchedulePreview.value = await previewMonthWeekScheduleImport(
          displayedMonthStart.value,
          excelScheduleSlots.value.map(({ source_row_number: _sourceRowNumber, ...slot }) => slot),
        )
      } catch {
        // Keep the last preview and the original apply error visible if refresh also fails.
      }
    }
    excelScheduleError.value = monthScheduleExcelErrorMessage(error, 'Không thể áp dụng biểu mẫu lịch tháng. Hãy xem lại preview và thử lại.')
  } finally {
    excelScheduleBusy.value = false
  }
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
  templateAdditionPreview.value = null
}

function removeWeeklyTemplateSlot(day: WeeklyTemplateDayDraft, slotId: string) {
  day.slots = day.slots.filter((slot) => slot.client_id !== slotId)
  templateError.value = ''
  templateAdditionPreview.value = null
}

function invalidateTemplateAdditionPreview() {
  templateError.value = ''
  templateAdditionPreview.value = null
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

async function requestMonthTemplateAdditionPreview() {
  if (templatePreviewBusy.value) return
  templateError.value = weeklyTemplateValidationError.value
  if (templateError.value) return

  templatePreviewBusy.value = true
  try {
    templateAdditionPreview.value = await previewMonthWeekTemplateAddition(
      displayedMonthStart.value,
      templatePayload(),
      templateAdditionRange.value,
      templateAdditionDuplicateAction.value,
    )
    pendingTemplateMonthStart.value = displayedMonthStart.value
    pendingTemplateSlots.value = templatePayload()
  } catch (error) {
    templateError.value = userErrorMessage(error, 'Không thể xem trước phạm vi thêm lịch mẫu.')
    templateAdditionPreview.value = null
  } finally {
    templatePreviewBusy.value = false
  }
}

async function refreshMonthTemplateAdditionPreview() {
  if (!templateAdditionPreview.value) return
  await requestMonthTemplateAdditionPreview()
}

async function addMonthTemplateNow() {
  const preview = templateAdditionPreview.value
  const monthStart = pendingTemplateMonthStart.value
  if (!preview || !monthStart || !pendingTemplateSlots.value.length || preview.blockers.length) return
  if (templateAdditionBusy.value) return

  templateError.value = ''
  templateAdditionBusy.value = true
  try {
    const result = await addMonthWithWeekTemplate(
      monthStart,
      pendingTemplateSlots.value,
      templateAdditionRange.value,
      templateAdditionDuplicateAction.value,
    )
    templateEditorOpen.value = false
    templateAdditionPreview.value = null
    pendingTemplateSlots.value = []
    weeklyTemplateDays.value = []
    const refreshed = await load()
    const summary = `Đã thêm ${result.created_sessions} buổi mới, cập nhật ${result.updated_sessions} buổi trùng, bỏ qua ${result.skipped_duplicates} buổi trùng và giữ nguyên ${result.protected_duplicates} buổi có dữ liệu.`
    if (!refreshed) {
      errorMessage.value = `${summary} Chưa tải lại được lịch; hãy nhấn “Làm mới”.`
      toast.info(summary)
    } else {
      toast.success(summary)
    }
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    templateAdditionPreview.value = null
    if (code === 'TEMPLATE_ADDITION_BLOCKED' || message.includes('TEMPLATE_ADDITION_BLOCKED')) {
      await requestMonthTemplateAdditionPreview()
      if (templateAdditionPreview.value && !templateAdditionPreview.value.blockers.length) {
        templateError.value = 'Dữ liệu lịch vừa thay đổi. Preview đã được cập nhật; hãy kiểm tra lại trước khi thêm.'
      }
    } else {
      templateError.value = userErrorMessage(error, 'Không thể thêm lịch mẫu. Các buổi hiện có vẫn được giữ nguyên.')
    }
    if (templateError.value) toast.error(templateError.value)
  } finally {
    templateAdditionBusy.value = false
  }
}

async function submitWeeklyTemplate() {
  if (templateOperation.value === 'replace') {
    await previewAndConfirmMonthTemplate()
  } else if (templateAdditionPreview.value) {
    await addMonthTemplateNow()
  } else {
    await requestMonthTemplateAdditionPreview()
  }
}

function templateAdditionClassName(classId: string): string {
  return classes.value.find((row) => row.id === classId)?.name || 'Lớp đã chọn'
}

function templateAdditionMatchDescription(match: MonthWeekTemplateAdditionMatch): string {
  if (match.action === 'UPDATE') return 'Trùng chính xác · có thể cập nhật buổi an toàn.'
  if (match.action === 'SKIP' && match.reason === 'RECURRING_PATTERN_EXISTS') {
    return 'Đã có lịch lặp · bỏ qua và để lịch lặp tiếp tục sinh buổi.'
  }
  if (match.action === 'SKIP') return 'Trùng chính xác · giữ nguyên theo lựa chọn bỏ qua.'
  if (match.action === 'PRESERVE') return match.reason || 'Buổi trùng có dữ liệu cần bảo toàn.'
  if (match.action === 'BLOCKED') {
    return match.reason === 'MULTIPLE_EXACT_MATCHES'
      ? 'Có nhiều buổi trùng chính xác; cần xử lý dữ liệu trùng trước.'
      : 'Có nhiều lịch lặp giống nhau; cần xử lý trước khi thêm.'
  }
  if (match.action === 'CREATE' && match.reason === 'RECURRING_PATTERN_EXISTS') {
    return 'Trùng khung lịch lặp · sẽ tạo riêng buổi tháng này, không sửa lịch lặp gốc.'
  }
  return 'Buổi trong mẫu sẽ được thêm.'
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
  if (teacherSaveBusy.value) return
  if (!selected.value || !canEditSelectedSession.value || !selectedTeacherIds.value.length) {
    errorMessage.value = 'Mỗi buổi cần có ít nhất một giáo viên được phân công.'
    return
  }
  if (selected.value && teacherCountKnown(selected.value.class_id) && selectedSessionTeacherCount.value > MAX_CLASS_TEACHERS) {
    errorMessage.value = `Mỗi lớp được phân công tối đa ${MAX_CLASS_TEACHERS} giáo viên hiện hành.`
    return
  }
  errorMessage.value = ''
  const sessionId = selected.value.id
  teacherSaveBusy.value = true
  try {
    await updateSessionTeachers({ session_id: sessionId, staff_ids: selectedTeacherIds.value })
    toast.success('Đã cập nhật giáo viên cho buổi học.')
    await load()
    const refreshed = sessions.value.find((row) => row.id === sessionId)
    if (refreshed && selected.value?.id === sessionId) {
      selected.value = refreshed
      selectedTeacherIds.value = (refreshed.session_staff || []).map((item) => item.staff_id)
    }
  } catch (error) { errorMessage.value = teacherLimitMessage(error, 'Không thể cập nhật giáo viên.') }
  finally { teacherSaveBusy.value = false }
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
  if (!selected.value || !canEditSelectedSession.value || scheduleSaveBusy.value || !startInput.value || !endInput.value) return
  const start = fromLocalInput(startInput.value)
  const end = fromLocalInput(endInput.value)
  const startAt = Date.parse(start)
  const endAt = Date.parse(end)
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt
      || getBusinessDateKey(new Date(startAt)) !== getBusinessDateKey(new Date(endAt))) {
    errorMessage.value = 'Giờ kết thúc phải sau giờ bắt đầu và cùng ngày với giờ bắt đầu.'
    return
  }
  if (selected.value.status !== 'SCHEDULED' && endAt > Date.now()) {
    errorMessage.value = 'Buổi đang diễn ra hoặc đã hoàn tất chỉ được hiệu chỉnh về thời điểm đã qua.'
    return
  }
  const sessionId = selected.value.id
  scheduleSaveBusy.value = true
  try {
    await correctSessionSchedule({ session_id: sessionId, start, end, room: sessionRoomInput.value.trim() || null })
    toast.success('Đã đổi lịch buổi học.')
    await load()
    const refreshed = sessions.value.find((item) => item.id === sessionId)
    if (refreshed && selected.value?.id === sessionId) {
      selected.value = refreshed
      startInput.value = toLocalInput(refreshed.scheduled_start_at)
      endInput.value = toLocalInput(refreshed.scheduled_end_at)
      sessionRoomInput.value = refreshed.room ?? refreshed.class_schedules?.room ?? ''
    }
  } catch (error) { errorMessage.value = userErrorMessage(error, 'Không thể đổi lịch buổi học.') }
  finally { scheduleSaveBusy.value = false }
}

function cancelCompletedSessionEdit() {
  if (!selected.value) return
  startInput.value = toLocalInput(selected.value.scheduled_start_at)
  endInput.value = toLocalInput(selected.value.scheduled_end_at)
  sessionRoomInput.value = selected.value.room ?? selected.value.class_schedules?.room ?? ''
  sessionNoteInput.value = selected.value.session_note || ''
  lessonYoutubeInput.value = selected.value.lesson_youtube_url || ''
  learningRows.value = students.value.map(attendanceRowFromSource)
  completedSessionCorrectionError.value = ''
  completedSessionEditOpen.value = false
}

async function saveCompletedSessionCorrection() {
  const session = selected.value
  if (!session || !isCompletedAttendanceDetail.value || !completedSessionEditOpen.value
      || !completedSessionEditsDirty.value || completedSessionCorrectionBusy.value) return

  completedSessionCorrectionError.value = ''
  attendanceSaveVerification.value = null
  if (!startInput.value || !endInput.value) {
    completedSessionCorrectionError.value = 'Hãy nhập đầy đủ ngày giờ bắt đầu và kết thúc.'
    return
  }
  const start = fromLocalInput(startInput.value)
  const end = fromLocalInput(endInput.value)
  const startAt = Date.parse(start)
  const endAt = Date.parse(end)
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt
      || getBusinessDateKey(new Date(startAt)) !== getBusinessDateKey(new Date(endAt))) {
    completedSessionCorrectionError.value = 'Giờ kết thúc phải sau giờ bắt đầu và cùng ngày với giờ bắt đầu.'
    return
  }
  if (endAt > Date.now()) {
    completedSessionCorrectionError.value = 'Buổi đã hoàn tất chỉ được hiệu chỉnh về thời điểm đã qua.'
    return
  }
  if (!isYoutubeLessonLink(lessonYoutubeInput.value)) {
    completedSessionCorrectionError.value = 'Chỉ chấp nhận link video YouTube hợp lệ.'
    return
  }
  const invalidRow = learningRows.value.find((row) => attendanceValidationError(row.attendance))
  if (invalidRow) {
    completedSessionCorrectionError.value = `Dữ liệu điểm danh không hợp lệ. ${attendanceValidationError(invalidRow.attendance)}`
    return
  }

  const submittedAttendance = learningRows.value.map(toAttendanceSaveInput)
  completedSessionCorrectionBusy.value = true
  try {
    const rpcResult = await correctCompletedSession({
      session_id: session.id,
      scheduled_start_at: start,
      scheduled_end_at: end,
      room: sessionRoomInput.value.trim() || null,
      session_note: sessionNoteInput.value.trim() || null,
      lesson_youtube_url: lessonYoutubeInput.value.trim() || null,
      students: submittedAttendance,
    })

    let refreshedRows: SessionStudentQueryRow[]
    try {
      refreshedRows = await getSessionStudents(session.id)
      await load()
    } catch (readError) {
      const safeMessage = userErrorMessage(readError, 'Không thể đọc lại dữ liệu sau khi lưu.')
      attendanceSaveVerification.value = {
        kind: 'warning',
        message: `RPC đã xử lý ${rpcResult.students_updated}/${submittedAttendance.length} học sinh nhưng chưa xác minh được dữ liệu đọc lại. ${safeMessage}`,
      }
      completedSessionCorrectionError.value = attendanceSaveVerification.value.message
      return
    }

    const refreshedSession = sessions.value.find((item) => item.id === session.id)
    const attendanceCheck = verifySavedAttendance(submittedAttendance, rpcResult.students_updated, refreshedRows)
    const sessionCheck = Boolean(refreshedSession
      && refreshedSession.status === 'COMPLETED'
      && Date.parse(refreshedSession.scheduled_start_at) === startAt
      && Date.parse(refreshedSession.scheduled_end_at) === endAt
      && (refreshedSession.room || null) === (sessionRoomInput.value.trim() || null)
      && (refreshedSession.session_note || null) === (sessionNoteInput.value.trim() || null)
      && (refreshedSession.lesson_youtube_url || null) === (lessonYoutubeInput.value.trim() || null))
    const verification = attendanceCheck.kind === 'success' && !sessionCheck
      ? { kind: 'warning' as const, message: 'Điểm danh đã được đọc lại, nhưng thông tin buổi học chưa khớp dữ liệu vừa gửi. Hãy tải lại trước khi sửa tiếp.' }
      : attendanceCheck
    attendanceSaveVerification.value = verification

    if (verification.kind !== 'success' || !refreshedSession) {
      completedSessionCorrectionError.value = verification.message
      return
    }

    selected.value = refreshedSession
    students.value = refreshedRows
    learningRows.value = refreshedRows.map(attendanceRowFromSource)
    startInput.value = toLocalInput(refreshedSession.scheduled_start_at)
    endInput.value = toLocalInput(refreshedSession.scheduled_end_at)
    sessionRoomInput.value = refreshedSession.room ?? refreshedSession.class_schedules?.room ?? ''
    sessionNoteInput.value = refreshedSession.session_note || ''
    lessonYoutubeInput.value = refreshedSession.lesson_youtube_url || ''
    completedSessionEditOpen.value = false
    toast.success('Đã lưu và xác minh thông tin buổi học trong CSDL.')
  } catch (error) {
    completedSessionCorrectionError.value = userErrorMessage(error, 'Không thể lưu thông tin buổi học đã điểm danh. Dữ liệu đang nhập vẫn được giữ.')
    attendanceSaveVerification.value = { kind: 'error', message: completedSessionCorrectionError.value }
  } finally {
    completedSessionCorrectionBusy.value = false
  }
}

async function saveCompletedSessionTimesheets() {
  const session = selected.value
  if (!session || session.status !== 'COMPLETED' || completedTimesheetBusy.value || !teacherEligibilityDirty.value) return
  completedTimesheetError.value = ''
  if (!assignedTeachers.value.length) {
    completedTimesheetError.value = 'Buổi học cần có ít nhất một giáo viên được phân công.'
    return
  }
  if (assignedTeachers.value.some((teacher) => teacherEligibilityDraft.value[teacher.staff_id] === null
      || teacherEligibilityDraft.value[teacher.staff_id] === undefined)) {
    completedTimesheetError.value = 'Hãy chọn Tính công hoặc Không tính công cho từng giáo viên được phân công.'
    return
  }

  completedTimesheetBusy.value = true
  try {
    const decisions = assignedTeachers.value.map((teacher) => ({
      staff_id: teacher.staff_id,
      eligible: teacherEligibilityDraft.value[teacher.staff_id] as boolean,
    }))
    const result = await setCompletedSessionTimesheets({ session_id: session.id, teacher_decisions: decisions })
    const loaded = await load()
    const refreshed = sessions.value.find((row) => row.id === session.id)
    const refreshedDecisions = new Map((refreshed?.session_staff || []).map((teacher) => [teacher.staff_id, teacher.timesheet_eligible ?? null]))
    const matches = decisions.every((decision) => refreshedDecisions.get(decision.staff_id) === decision.eligible)
    if (!loaded || !refreshed || !matches) {
      completedTimesheetError.value = 'RPC đã xử lý quyết định chấm công nhưng dữ liệu đọc lại chưa khớp. Hãy tải lại buổi trước khi nhập tiếp.'
      return
    }
    selected.value = refreshed
    teacherEligibilityDraft.value = Object.fromEntries(assignedTeachers.value.map((teacher) => [
      teacher.staff_id,
      teacher.timesheet_eligible ?? null,
    ]))
    learningEditorOpen.value = false
    toast.success(`Đã lưu và xác minh quyết định chấm công. ${result.timesheets_approved} giáo viên được tính công.`)
  } catch (error) {
    completedTimesheetError.value = userErrorMessage(error, 'Không thể cập nhật chấm công cho buổi đã hoàn tất.')
  } finally {
    completedTimesheetBusy.value = false
  }
}

function isYoutubeLessonLink(value: string) {
  if (!value.trim()) return true
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return false
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const path = url.pathname
    let videoId = ''
    if (host === 'youtu.be') videoId = path.split('/').filter(Boolean)[0] || ''
    else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      if (path === '/watch') videoId = url.searchParams.get('v') || ''
      else videoId = path.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || ''
    }
    return /^[A-Za-z0-9_-]{11}$/.test(videoId)
  } catch {
    return false
  }
}

async function saveSelectedLearning() {
  if (!selected.value || !canEditSelectedLearning.value || learningBusy.value || !learningDirty.value) return
  errorMessage.value = ''
  attendanceSaveVerification.value = null
  learningValidationErrors.value = {}
  learningTeacherValidationError.value = ''
  if (!isYoutubeLessonLink(lessonYoutubeInput.value)) {
    errorMessage.value = 'Chỉ chấp nhận link video YouTube hợp lệ.'
    return
  }

  const session = selected.value
  if (completedTimesheetOnlyChange.value) {
    await saveCompletedSessionTimesheets()
    return
  }

  const rowErrors: Record<string, string> = {}
  if (adminAttendanceDirty.value) {
    if (!canAdminFinalizeAttendance.value) {
      errorMessage.value = 'Chỉ có thể chốt điểm danh và chấm công sau giờ kết thúc theo lịch.'
      return
    }
    for (const row of learningRows.value) {
      const error = attendanceValidationError(row.attendance)
      if (error) rowErrors[row.student_id] = error
    }
    if (!assignedTeachers.value.length || assignedTeachers.value.some((item) => teacherEligibilityDraft.value[item.staff_id] === null || teacherEligibilityDraft.value[item.staff_id] === undefined)) {
      learningTeacherValidationError.value = assignedTeachers.value.length
        ? 'Hãy chọn Tính công hoặc Không tính công cho từng giáo viên được phân công.'
        : 'Buổi học cần có ít nhất một giáo viên được phân công.'
    }
  }
  if (Object.keys(rowErrors).length) {
    learningValidationErrors.value = rowErrors
  }
  if (Object.keys(rowErrors).length || learningTeacherValidationError.value) return

  const sessionNote = sessionNoteInput.value.trim() || null
  const lessonYoutubeUrl = lessonYoutubeInput.value.trim() || null
  const finalizingAttendance = adminAttendanceDirty.value
  let submittedAttendance: AttendanceSaveInput[] = []
  let attendanceFinalizeResult: Awaited<ReturnType<typeof recordAdminSessionAttendance>> | null = null
  learningBusy.value = true
  try {
    if (finalizingAttendance) {
      submittedAttendance = learningRows.value.map(toAttendanceSaveInput)
      attendanceFinalizeResult = await recordAdminSessionAttendance({
        session_id: session.id,
        session_note: sessionNote,
        lesson_youtube_url: lessonYoutubeUrl,
        students: submittedAttendance,
        teacher_decisions: assignedTeachers.value.map((item) => ({
          staff_id: item.staff_id,
          eligible: teacherEligibilityDraft.value[item.staff_id] as boolean,
        })),
      })
    } else {
      await correctSessionLearning({
        session_id: session.id,
        session_note: sessionNote,
        lesson_youtube_url: lessonYoutubeUrl,
        students: [],
      })
    }
    const updatedSession = {
      ...session,
      status: finalizingAttendance ? 'COMPLETED' as const : session.status,
      ended_at: finalizingAttendance ? attendanceFinalizeResult?.ended_at || session.ended_at : session.ended_at,
      ended_by: finalizingAttendance ? attendanceFinalizeResult?.ended_by ?? session.ended_by : session.ended_by,
      session_note: sessionNote,
      lesson_youtube_url: lessonYoutubeUrl,
      session_staff: (session.session_staff || []).map((item) => ({
        ...item,
        timesheet_eligible: teacherEligibilityDraft.value[item.staff_id] ?? item.timesheet_eligible ?? null,
      })),
    }
    selected.value = updatedSession
    sessions.value = sessions.value.map((row) => row.id === session.id ? updatedSession : row)
    sessionNoteInput.value = sessionNote || ''
    lessonYoutubeInput.value = lessonYoutubeUrl || ''
    learningEditorOpen.value = false
    try {
      const refreshedRows = await getSessionStudents(session.id)
      students.value = refreshedRows
      learningRows.value = students.value.map(attendanceRowFromSource)
      if (finalizingAttendance && attendanceFinalizeResult) {
        attendanceSaveVerification.value = verifySavedAttendance(
          submittedAttendance,
          attendanceFinalizeResult.students_updated,
          refreshedRows,
        )
        if (attendanceSaveVerification.value.kind === 'success') {
          toast.success(session.status === 'IN_PROGRESS'
            ? 'Đã kết thúc buổi học và xác minh điểm danh, chấm công trong CSDL.'
            : 'Đã lưu và xác minh điểm danh, đánh giá trong CSDL.')
        } else {
          errorMessage.value = attendanceSaveVerification.value.message
          toast.error(attendanceSaveVerification.value.message)
        }
      } else {
        toast.success('Đã lưu nội dung buổi học.')
      }
    } catch (readError) {
      learningRows.value = learningRows.value.map((row) => ({
        ...row,
        attendance: createAttendanceValue(row.attendance as unknown as Record<string, unknown>),
        initialAttendance: createAttendanceValue(row.attendance as unknown as Record<string, unknown>),
      }))
      if (finalizingAttendance) {
        const readMessage = userErrorMessage(readError, 'Không đọc lại được dữ liệu điểm danh từ CSDL.')
        attendanceSaveVerification.value = {
          kind: 'warning',
          message: `Máy chủ đã báo xử lý ${attendanceFinalizeResult?.students_updated ?? 'không rõ số lượng'}/${submittedAttendance.length} học sinh, nhưng chưa xác minh được dữ liệu đọc lại. ${readMessage}`,
        }
        errorMessage.value = attendanceSaveVerification.value.message
        toast.error(attendanceSaveVerification.value.message)
      } else {
        errorMessage.value = 'Đã lưu thay đổi nhưng không tải lại được kết quả. Hãy nhấn “Làm mới” để kiểm tra dữ liệu.'
      }
    }
  } catch (error) {
    errorMessage.value = userErrorMessage(error, 'Không thể lưu nội dung buổi học, điểm danh và đánh giá. Dữ liệu đang nhập vẫn được giữ.')
    if (finalizingAttendance) {
      attendanceSaveVerification.value = {
        kind: 'error',
        message: `Chưa nhận được xác nhận lưu điểm danh. Hãy tải lại buổi để kiểm tra trước khi nhập lại. ${errorMessage.value}`,
      }
    }
  } finally {
    learningBusy.value = false
  }
}

async function cancel() {
  if (!selected.value || !canCancelOrDeleteSelectedSession.value) return
  confirmActionType.value = 'cancel-session'
  confirmDetails.value = { title: 'Hủy buổi học?', message: 'Buổi học sẽ được đánh dấu đã hủy. Thông tin và kết quả đã lưu vẫn được giữ.', itemName: `${className(selected.value)} · ${formatDateTime(selected.value.scheduled_start_at)}`, warning: 'Giáo viên và học sinh sẽ thấy trạng thái buổi học đã hủy.', confirmLabel: 'Hủy buổi học', destructive: true }
  confirmOpen.value = true
}

async function confirmDeleteSession() {
  const session = selected.value
  if (!session || !canDeleteSelectedSession.value || deleteSessionPreviewBusy.value) return
  deleteSessionPreviewBusy.value = true
  deleteError.value = ''
  try {
    const preview = await previewDeleteSession(session.id)
    if (selected.value?.id !== session.id) return
    deleteSessionPreview.value = preview
    if (!preview.can_delete) {
      toast.error(userErrorMessage(
        new Error(preview.blocked_reason || 'SESSION_DELETE_NOT_ALLOWED'),
        'Buổi học hiện không thể xóa. Hãy tải lại và kiểm tra trạng thái.',
      ))
      return
    }
    const dependentCounts = [
      `${preview.session_students} học sinh trong roster`,
      `${preview.session_staff} phân công giáo viên`,
      `${preview.staff_replacements} lượt thay giáo viên`,
      `${preview.attendances} bản ghi điểm danh`,
      `${preview.timesheets} bản ghi chấm công`,
      `${preview.payroll_items} dòng payroll`,
      `${preview.financial_snapshot_rows} dòng snapshot tài chính`,
      `${preview.month_week_occurrences} liên kết lịch tháng`,
    ]
    if (preview.has_revenue_snapshot) dependentCounts.push('snapshot doanh thu của buổi')
    confirmActionType.value = 'delete-session'
    confirmDetails.value = {
      title: 'Xóa buổi học và dữ liệu liên quan?',
      message: 'Xác nhận xóa buổi cùng toàn bộ dữ liệu gắn với buổi. Nhật ký kiểm toán và kỳ payroll được giữ lại.',
      itemName: `${className(session)} · ${formatDateTime(session.scheduled_start_at)} · ${preview.status}`,
      warning: `Sẽ xóa: ${dependentCounts.join('; ')}.${preview.recurring ? ' Buổi thuộc lịch lặp; ngày này sẽ được ghi nhận để không sinh lại.' : ''} Thao tác không thể hoàn tác.`,
      confirmLabel: 'Xóa buổi học',
      destructive: true,
    }
    confirmOpen.value = true
  } catch (error) {
    toast.error(userErrorMessage(error, 'Không thể xem trước dữ liệu sẽ xóa. Buổi học chưa bị thay đổi.'))
  } finally {
    deleteSessionPreviewBusy.value = false
  }
}

async function deleteSelectedSession() {
  if (!selected.value) return
  const sessionId = selected.value.id
  try {
    if (!deleteSessionPreview.value || deleteSessionPreview.value.session_id !== sessionId) {
      deleteError.value = 'Hãy đóng xác nhận và xem lại dữ liệu sẽ xóa trước khi tiếp tục.'
      return
    }
    const result = await deleteSession(sessionId)
    confirmBusy.value = false
    confirmOpen.value = false
    selectedDetailOpen.value = false
    attendedSessionPageOpen.value = false
    selected.value = null
    deleteSessionPreview.value = null
    students.value = []
    sessionRosterCandidates.value = []
    if (typeof route.query.session_id === 'string') {
      await router.replace({ path: '/admin/sessions', query: queryWithoutSessionId() })
    }
    toast.success(`Đã xóa buổi học và dữ liệu liên quan: ${result.deleted_attendances} điểm danh, ${result.deleted_timesheets} chấm công, ${result.deleted_payroll_items} dòng payroll.`)
    await load()
  } catch (error) {
    deleteError.value = userErrorMessage(error, 'Không thể xóa buổi học. Dữ liệu vẫn được giữ nguyên.')
  }
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
  deleteError.value = ''
  try {
    if (confirmActionType.value === 'replace-month-template') await replaceMonthTemplateNow()
    else if (confirmActionType.value === 'archive-schedule') await archiveScheduleNow()
    else if (confirmActionType.value === 'cancel-session') await cancelSessionNow()
    else if (confirmActionType.value === 'delete-session') await deleteSelectedSession()
    else if (confirmActionType.value === 'sync-session-roster') await syncSelectedSessionRoster()
    else if (confirmActionType.value === 'delete-month-sessions') await deleteMonthSessionsNow()
  } finally { confirmBusy.value = false }
}

onMounted(async () => {
  await load()
  await openAttendedSessionFromRoute()
})
watch(() => [viewMode.value, calendarAnchorDate.value] as const, () => {
  if (sessionsLoaded.value) void reloadRoomRentalsForCurrentRange()
})
watch(() => route.query.class_id, (value) => {
  selectedClassId.value = typeof value === 'string' ? value : ''
  changeClassFilter()
})
watch(() => route.query.session_id, (value) => {
  if (typeof value === 'string' && value) {
    void openAttendedSessionFromRoute()
  } else if (attendedSessionPageOpen.value) {
    clearAttendedSessionPage()
  }
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
  <AppPageHeader v-if="!isAttendedSessionDetailPage" title="Buổi học" eyebrow="Lịch giảng dạy" description="Xem lịch tuần, tháng hoặc danh sách; quản lý buổi, khung lịch lặp và lượt thuê phòng.">
    <template #actions>
      <button class="btn btn-primary" @click="scheduleEditorOpen = !scheduleEditorOpen">Chỉnh sửa lịch</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="openWeeklyTemplate('replace')">Tạo lịch mẫu</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="openWeeklyTemplate('add')">Thêm lịch mẫu</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="downloadMonthScheduleWorkbook">Tải mẫu Excel</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="openExcelScheduleImport">Nhập lịch Excel</button>
      <button class="btn btn-outline-danger" :disabled="loading || deletePreviewBusy" :aria-busy="deletePreviewBusy || undefined" @click="previewAndConfirmDeleteMonthSessions">
        <span v-if="deletePreviewBusy" class="app-button__spinner" aria-hidden="true"></span>{{ deletePreviewBusy ? 'Đang kiểm tra…' : 'Xóa toàn bộ buổi trong tháng' }}
      </button>
      <button class="btn btn-outline-primary" @click="openSessionForm()">Thêm buổi</button>
      <button class="btn btn-outline-primary" :disabled="loading || !activeTeachers.length" @click="openCreateRoomRental">Thuê phòng</button>
      <button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button>
    </template>
  </AppPageHeader>
  <section v-if="isAttendedSessionDetailPage && selected" class="attended-session-page" aria-labelledby="attended-session-title">
    <header class="attended-session-page__header">
      <button class="btn btn-outline-secondary attended-session-page__back" type="button" @click="returnToSessionsCalendar">← Quay lại lịch</button>
      <div class="attended-session-page__heading">
        <span class="attended-session-page__eyebrow">BUỔI ĐÃ ĐIỂM DANH</span>
        <h1 id="attended-session-title">{{ className(selected) }}</h1>
        <p class="mb-0 text-secondary">
          {{ formatBusinessDate(selectedSessionDate) }} · {{ formatBusinessTime(selected.scheduled_start_at) }}–{{ formatBusinessTime(selected.scheduled_end_at) }}
          · Giáo viên: {{ teachers }} · {{ selected.status }}
        </p>
      </div>
      <button
        class="btn btn-primary attended-session-page__export"
        type="button"
        :disabled="commentsExportDisabled || attendedSessionDetailLoading"
        :aria-busy="commentsExportBusy || undefined"
        :title="commentsExportDisabled ? 'Lưu thay đổi trước khi xuất ảnh.' : 'Tải ảnh PNG nhận xét của cả lớp.'"
        @click="exportSessionComments"
      >
        {{ commentsExportBusy ? 'Đang tạo ảnh…' : 'Xuất nhận xét' }}
      </button>
    </header>

    <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
    <div v-if="commentsExportError" class="alert alert-danger" role="alert">{{ commentsExportError }}</div>
    <div class="attended-session-page__content">
      <div v-if="attendedSessionDetailLoading" class="text-center text-secondary py-5" role="status">
        <span class="app-button__spinner me-2" aria-hidden="true"></span>Đang tải kết quả học tập…
      </div>
      <CompletedSessionAttendanceEditor
        v-else
        v-model:rows="learningRows"
        v-model:start-input="startInput"
        v-model:end-input="endInput"
        v-model:room-input="sessionRoomInput"
        v-model:session-note-input="sessionNoteInput"
        v-model:lesson-youtube-input="lessonYoutubeInput"
        v-model:teacher-eligibility-draft="teacherEligibilityDraft"
        :session="selected"
        :editing="completedSessionEditOpen"
        :saving="completedSessionCorrectionBusy"
        :dirty="completedSessionEditsDirty"
        :error="completedSessionCorrectionError"
        :timesheet-saving="completedTimesheetBusy"
        :timesheet-dirty="teacherEligibilityDirty"
        :timesheet-error="completedTimesheetError"
        :deletable="canDeleteSelectedSession"
        :deleting="deleteSessionPreviewBusy"
        @edit="completedSessionEditOpen = true; completedSessionCorrectionError = ''"
        @cancel="cancelCompletedSessionEdit"
        @save="saveCompletedSessionCorrection"
        @save-timesheets="saveCompletedSessionTimesheets"
        @delete="confirmDeleteSession"
      />
    </div>
  </section>
  <template v-else>
  <div v-if="errorMessage && sessionsLoaded" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" :disabled="loading" @click="load">Thử lại</button></div>
  <div v-if="roomRentalLoadError && !errorMessage" class="alert alert-warning" role="alert">{{ roomRentalLoadError }} <button class="btn btn-sm btn-outline-warning ms-2" type="button" @click="reloadRoomRentalsForCurrentRange">Thử tải lại lịch thuê</button></div>

  <RoomRentalModal
    v-if="roomRentalModalOpen"
    v-model="roomRentalModalOpen"
    :mode="roomRentalEditing ? 'edit' : 'create'"
    :rental="roomRentalEditing"
    :teachers="activeTeachers"
    :default-date="roomRentalDefaultDate"
    :default-month="displayedMonthStart"
    :busy="roomRentalBusy"
    :error="roomRentalError"
    :conflicts="roomRentalConflicts"
    @clear-conflicts="clearRoomRentalConflicts"
    @create-single="saveRoomRental"
    @create-month="saveRoomRentalMonth"
    @reschedule="changeRoomRentalSchedule"
    @cancel="cancelRoomRentalOccurrence"
    @delete="deleteRoomRentalOccurrence"
  />

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
    :title="`${templateOperation === 'add' ? 'Thêm lịch mẫu' : 'Tạo lịch mẫu'} cho ${formatBusinessMonth(displayedMonthStart)}`"
    :description="templateOperation === 'add'
      ? 'Nhập các buổi theo thứ để bổ sung vào tháng đang xem. Buổi hiện có được giữ nguyên, trừ buổi trùng đủ điều kiện mà bạn chọn cập nhật.'
      : 'Nhập các buổi theo thứ. Khi lưu, toàn bộ buổi trong tháng của mọi lớp sẽ bị xóa và tạo lại theo mẫu này, kể cả ngày đã qua.'"
    size="xl"
    :busy="templatePreviewBusy || templateAdditionBusy"
    :submit-disabled="Boolean(weeklyTemplateValidationError) || !activeTemplateClasses.length || (templateOperation === 'add' && Boolean(templateAdditionPreview?.blockers.length))"
    :submit-label="templateOperation === 'add'
      ? (templateAdditionPreview ? 'Thêm lịch' : 'Xem trước lịch')
      : 'Xem phạm vi thay lịch'"
    :submitting-label="templateAdditionBusy ? 'Đang thêm…' : 'Đang kiểm tra…'"
    @submit="submitWeeklyTemplate"
    @cancel="templateEditorOpen = false"
  >
    <div v-if="templateOperation === 'replace'" class="alert alert-warning" role="note">
      Phạm vi áp dụng là toàn trung tâm, không phụ thuộc bộ lọc lớp. Mỗi buổi mới dùng danh sách thành viên có hiệu lực vào ngày học.
    </div>
    <template v-else>
      <fieldset class="mb-3">
        <legend class="form-label">Khoảng ngày áp dụng</legend>
        <div class="form-check">
          <input id="template-add-full-month" v-model="templateAdditionRange" class="form-check-input" type="radio" value="FULL_MONTH" @change="invalidateTemplateAdditionPreview" />
          <label class="form-check-label" for="template-add-full-month">Tạo cho cả tháng, gồm cả ngày đã qua</label>
        </div>
        <div class="form-check">
          <input id="template-add-remaining-days" v-model="templateAdditionRange" class="form-check-input" type="radio" value="REMAINING_DAYS" @change="invalidateTemplateAdditionPreview" />
          <label class="form-check-label" for="template-add-remaining-days">Chỉ tạo các buổi còn lại trong tháng</label>
        </div>
      </fieldset>
      <div class="alert alert-info" role="note">
        Mỗi dòng chọn lớp riêng; bộ lọc lớp không giới hạn phạm vi. Lịch cũ và lịch lặp của các tháng khác được giữ nguyên.
      </div>
    </template>
    <div v-if="!activeTemplateClasses.length" class="alert alert-danger" role="alert">
      Không có lớp đang hoạt động để đưa vào mẫu lịch.
    </div>
    <div class="weekly-template-days" @input="invalidateTemplateAdditionPreview" @change="invalidateTemplateAdditionPreview">
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
    <template v-if="templateOperation === 'add' && templateAdditionPreview">
      <div class="card mt-3" aria-live="polite" data-testid="month-template-addition-preview">
        <div class="card-body">
          <h3 class="h6">Phạm vi thêm lịch</h3>
          <p class="mb-2">
            Sẽ tạo {{ templateAdditionPreview.create_count }} buổi mới; cập nhật {{ templateAdditionPreview.update_count }} buổi; bỏ qua {{ templateAdditionPreview.skipped_duplicate_count }} buổi trùng; giữ nguyên {{ templateAdditionPreview.protected_duplicate_count }} buổi cần bảo toàn.
          </p>
          <p v-if="templateAdditionPreview.overwriteable_duplicate_count || templateAdditionPreview.protected_duplicate_count" class="small text-secondary mb-2">
            Có {{ templateAdditionPreview.overwriteable_duplicate_count }} buổi trùng chính xác đủ điều kiện cập nhật và {{ templateAdditionPreview.protected_duplicate_count }} buổi trùng cần giữ nguyên.
          </p>
          <p v-if="templateAdditionPreview.recurring_duplicate_count" class="small text-secondary mb-2">
            Có {{ templateAdditionPreview.recurring_duplicate_count }} ngày trùng lịch lặp đang bật. Ghi đè chỉ tạo/cập nhật buổi của tháng này; khung lịch lặp không thay đổi.
          </p>
          <div v-if="templateAdditionPreview.matches.length" class="mb-3">
            <h4 class="form-label">Các ngày trùng và cách xử lý</h4>
            <ul class="small mb-0" data-testid="month-template-addition-matches">
              <li v-for="(match, index) in templateAdditionPreview.matches" :key="`${match.date}-${match.class_id}-${match.action}-${index}`">
                {{ formatBusinessDate(match.date) }} · {{ templateAdditionClassName(match.class_id) }} · {{ templateAdditionMatchDescription(match) }}
              </li>
            </ul>
          </div>
          <fieldset v-if="templateAdditionPreview.overwriteable_duplicate_count || templateAdditionPreview.recurring_duplicate_count" class="mb-0">
            <legend class="form-label">Cách xử lý các buổi trùng</legend>
            <div class="form-check">
              <input id="template-add-overwrite" v-model="templateAdditionDuplicateAction" class="form-check-input" type="radio" name="template-add-duplicate-action" value="OVERWRITE_SAFE" @change="refreshMonthTemplateAdditionPreview" />
              <label class="form-check-label" for="template-add-overwrite">Cập nhật buổi trùng đủ điều kiện</label>
            </div>
            <div class="form-check">
              <input id="template-add-skip" v-model="templateAdditionDuplicateAction" class="form-check-input" type="radio" name="template-add-duplicate-action" value="SKIP" @change="refreshMonthTemplateAdditionPreview" />
              <label class="form-check-label" for="template-add-skip">Giữ nguyên và bỏ qua tất cả buổi trùng</label>
            </div>
          </fieldset>
          <div v-if="templateAdditionPreview.protected_duplicate_count" class="alert alert-warning mt-3 mb-0" role="status">
            Buổi đã có attendance, kết quả, chấm công, đã hủy hoặc không còn ở trạng thái SCHEDULED sẽ được giữ nguyên và không ghi đè.
          </div>
          <div v-if="templateAdditionPreview.blockers.length" class="alert alert-danger mt-3 mb-0" role="alert">
            <strong>Chưa thể áp dụng vì có xung đột:</strong>
            <ul class="mb-0 mt-2">
              <li v-for="(blocker, index) in templateAdditionPreview.blockers.slice(0, 8)" :key="`${blocker.date}-${blocker.class_id}-${blocker.code}-${index}`">
                {{ formatBusinessDate(blocker.date) }} · {{ templateAdditionClassName(blocker.class_id) }} · {{ blocker.message }}
              </li>
            </ul>
            <p v-if="templateAdditionPreview.blockers.length > 8" class="mb-0 mt-2">Còn {{ templateAdditionPreview.blockers.length - 8 }} xung đột khác.</p>
          </div>
        </div>
      </div>
    </template>
    <div v-if="weeklyTemplateValidationError" class="alert alert-info mt-3 mb-0" role="status">{{ weeklyTemplateValidationError }}</div>
    <div v-if="templateError" class="alert alert-danger mt-3 mb-0" role="alert">{{ templateError }}</div>
  </FormModal>

  <FormModal
    v-model="excelScheduleOpen"
    :title="`Nhập lịch Excel cho ${formatBusinessMonth(displayedMonthStart)}`"
    description="Chọn biểu mẫu đã điền. Lịch áp dụng cho toàn trung tâm và chỉ tháng này; lịch lặp từ các tháng sau được giữ nguyên."
    size="xl"
    :busy="excelScheduleBusy || excelSchedulePreviewBusy"
    :submit-disabled="!excelScheduleCanApply"
    submit-label="Áp dụng lịch tháng"
    submitting-label="Đang áp dụng…"
    @submit="applyExcelScheduleImport"
    @cancel="excelScheduleOpen = false"
  >
    <div class="alert alert-info" role="note">
      Lịch được lặp theo thứ trong tháng đang mở. Những ngày đã qua sẽ tạo buổi điểm danh bù ở trạng thái “Đã lên lịch”. Nếu có lỗi hoặc xung đột, hệ thống sẽ không áp dụng dòng nào.
    </div>
    <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
      <div class="flex-grow-1">
        <label for="month-week-schedule-file" class="form-label">Biểu mẫu lịch tháng (.xlsx)</label>
        <input id="month-week-schedule-file" ref="excelScheduleFileInput" class="form-control" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="excelScheduleBusy || excelSchedulePreviewBusy" @change="readExcelScheduleFile" />
        <div class="form-text">Tệp tối đa 10 MB, không quá 100 dòng lịch tuần.</div>
      </div>
      <div v-if="excelScheduleFileName" class="d-flex align-items-center gap-2">
        <span class="small text-secondary">{{ excelScheduleFileName }}</span>
        <button class="btn btn-sm btn-outline-secondary" type="button" :disabled="excelScheduleBusy || excelSchedulePreviewBusy" @click="resetExcelScheduleFile">Chọn tệp khác</button>
      </div>
    </div>
    <div v-if="excelSchedulePreviewBusy" class="py-3 text-secondary" role="status" aria-live="polite">
      <span class="app-button__spinner" aria-hidden="true"></span> Đang đọc biểu mẫu và kiểm tra các ngày trong tháng…
    </div>
    <div v-if="excelScheduleError" class="alert alert-danger" role="alert">{{ excelScheduleError }}</div>
    <div v-if="excelScheduleIssues.length" class="alert alert-danger" role="alert">
      <strong>Biểu mẫu có {{ excelScheduleIssues.length }} dòng cần sửa:</strong>
      <ul class="mb-0 mt-2">
        <li v-for="issue in excelScheduleIssues" :key="`${issue.row_number}-${issue.message}`">Dòng {{ issue.row_number }}: {{ issue.message }}</li>
      </ul>
    </div>
    <template v-if="excelSchedulePreview">
      <div class="month-import-summary" aria-label="Tóm tắt lịch sẽ áp dụng">
        <div><strong>{{ excelScheduleSlots.length }}</strong><span>dòng mẫu hợp lệ</span></div>
        <div><strong>{{ excelSchedulePreview.create_count }}</strong><span>buổi sẽ tạo</span></div>
        <div><strong>{{ excelSchedulePreview.update_count }}</strong><span>buổi sẽ cập nhật</span></div>
        <div><strong>{{ excelSchedulePreview.cancel_future_count }}</strong><span>buổi tương lai sẽ hủy</span></div>
        <div><strong>{{ excelSchedulePreview.preserve_history_count }}</strong><span>buổi sẽ được giữ nguyên</span></div>
      </div>
      <div v-if="excelSchedulePreview.blockers.length" class="alert alert-danger mt-3" role="alert">
        <strong>Chưa thể áp dụng lịch. Sửa các lỗi hoặc xung đột dưới đây rồi tải lại tệp:</strong>
        <ul class="mb-0 mt-2">
          <li v-for="(blocker, index) in excelSchedulePreview.blockers" :key="`${blocker.slot_id}-${blocker.date}-${blocker.code}-${index}`">
            <template v-if="excelScheduleSlots.find((slot) => slot.slot_id === blocker.slot_id)?.source_row_number">Dòng {{ excelScheduleSlots.find((slot) => slot.slot_id === blocker.slot_id)?.source_row_number }} · </template>
            {{ blocker.date ? formatBusinessDate(blocker.date) : '' }}{{ blocker.date ? ' · ' : '' }}{{ blocker.message }}
          </li>
        </ul>
      </div>
      <div v-else class="alert alert-success mt-3" role="status">
        Có thể áp dụng toàn bộ {{ excelScheduleSlots.length }} dòng mẫu. Học sinh trong roster hiện có, điểm danh, kết quả và chấm công của buổi được cập nhật sẽ được giữ nguyên.
      </div>
    </template>
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
  <SessionAttendanceExcelModal
    v-model="excelAttendanceOpen"
    :session="selected"
    :rows="learningRows"
    @apply="applyExcelAttendance"
    @hidden="handleExcelAttendanceHidden"
  />

  <div class="card border-0 shadow-sm mb-4">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <div class="btn-group" role="group" aria-label="Chế độ hiển thị buổi học">
            <button class="btn" :class="viewMode === 'week' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'week'" @click="viewMode = 'week'">Tuần</button>
            <button class="btn" :class="viewMode === 'month' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'month'" @click="viewMode = 'month'">Tháng</button>
            <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'">Danh sách</button>
          </div>
          <label class="visually-hidden" for="session-event-filter">Lọc loại lịch</label>
          <select id="session-event-filter" class="form-select form-select-sm event-filter" :value="eventFilter" @change="setEventFilter(($event.target as HTMLSelectElement).value as EventFilter)">
            <option value="all">Tất cả lịch</option>
            <option value="sessions">Buổi học</option>
            <option value="rentals">Thuê phòng</option>
          </select>
          <button class="btn btn-sm" :class="showHistory ? 'btn-primary' : 'btn-outline-secondary'" :aria-pressed="showHistory" @click="toggleHistory">
            {{ showHistory ? 'Ẩn lịch sử' : 'Hiện lịch sử' }}
          </button>
          <button
            class="btn btn-sm"
            :class="showAttendedSessions ? 'btn-primary' : 'btn-outline-primary'"
            type="button"
            :aria-pressed="showAttendedSessions"
            :disabled="Boolean(attendanceSummaryError)"
            :title="attendanceSummaryError || 'Hiển thị các buổi hoàn tất có đủ bản ghi điểm danh trong CSDL'"
            @click="toggleAttendedSessions"
          >Các buổi học đã điểm danh</button>
        </div>
        <small v-if="attendanceSummaryError" class="text-danger" role="alert">{{ attendanceSummaryError }}</small>
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
            <div v-else-if="!loading && !errorMessage && !visibleEvents.length" class="text-center text-secondary py-5">
              <p class="mb-2">{{ listEmptyMessage }}</p>
              <button v-if="!showHistory && (hiddenHistorySessions.length || (eventFilter !== 'sessions' && hiddenHistoryRentals.length))" type="button" class="btn btn-sm btn-outline-primary" @click="revealHiddenHistory">Xem lịch sử trong danh sách</button>
            </div>
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead><tr><th>Ngày</th><th>Loại</th><th>Lớp / người thuê</th><th>Thời gian</th><th>Phòng</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  <tr v-for="event in visibleEvents" :key="`${event.kind}-${event.id}`" :class="event.kind === 'session' && selected?.id === event.session.id ? 'table-primary' : event.kind === 'rental' ? 'room-rental-row' : ''" :aria-label="eventAriaLabel(event)" role="button" tabindex="0" @click="selectCalendarEvent(event)" @keydown.enter="selectCalendarEvent(event)">
                    <td>{{ formatBusinessDate(getBusinessDateKey(event.startsAt)) }}</td>
                    <td><span class="badge" :class="event.kind === 'rental' ? 'text-bg-info' : 'text-bg-secondary'">{{ eventTypeLabel(event) }}</span></td>
                    <td class="fw-semibold">{{ eventPrimaryLabel(event) }}</td>
                    <td>{{ formatBusinessTime(event.startsAt) }}–{{ formatBusinessTime(event.endsAt) }}</td>
                    <td>{{ eventRoom(event) }}</td>
                    <td><span class="badge" :class="eventStatusClass(event)">{{ eventStatusLabel(event) }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else-if="viewMode === 'week'" key="week" class="session-calendar-view">
            <div class="week-timetable-scroll" role="region" aria-label="Thời khóa biểu theo tuần" tabindex="0">
              <div class="week-timetable">
                <div class="week-timetable__corner">Giờ</div>
                <div
                  v-for="(dateKey, dayIndex) in weekDateKeys"
                  :key="dateKey"
                  class="week-timetable__heading"
                  :class="{ 'week-timetable__heading--today': dateKey === todayDateKey }"
                  :aria-label="`${weekdayLabels[dayIndex]}, ${formatBusinessDate(dateKey)}`"
                >
                  <span class="week-timetable__weekday">{{ weekdayLabels[dayIndex] }}</span>
                  <span class="week-timetable__date" :title="formatBusinessDate(dateKey)">{{ dateKey.slice(8) }}/{{ dateKey.slice(5, 7) }}</span>
                  <span v-if="dateKey === todayDateKey" class="badge text-bg-primary week-timetable__today">Hôm nay</span>
                  <button class="btn btn-sm btn-outline-primary calendar-add-button" :aria-label="`Thêm buổi ngày ${formatBusinessDate(dateKey)}`" @click="openSessionForm(dateKey)">+</button>
                </div>
                <div class="week-timetable__time-axis" :style="{ height: `${timetableHeightPx}px` }" aria-hidden="true">
                  <template v-for="tick in timetableTicks" :key="tick.minute">
                    <div class="week-timetable__axis-line" :class="{ 'week-timetable__axis-line--hour': tick.hour }" :style="{ top: `${tick.minute - timetableRange.startMinute}px` }"></div>
                    <span class="week-timetable__time-label" :class="{ 'week-timetable__time-label--hour': tick.hour }" :style="{ top: `${tick.minute - timetableRange.startMinute}px` }">{{ tick.label }}</span>
                  </template>
                </div>
                <section
                  v-for="(dateKey, dayIndex) in weekDateKeys"
                  :key="`day-${dateKey}`"
                  class="week-timetable__day calendar-day"
                  :class="{ 'calendar-day-today': dateKey === todayDateKey }"
                  :style="{ height: `${timetableHeightPx}px` }"
                  :aria-label="`${weekdayLabels[dayIndex]}, ${formatBusinessDate(dateKey)}`"
                >
                  <div
                    v-for="tick in timetableTicks"
                    :key="tick.minute"
                    class="week-timetable__grid-line"
                    :class="{ 'week-timetable__grid-line--hour': tick.hour }"
                    :style="{ top: `${tick.minute - timetableRange.startMinute}px` }"
                    aria-hidden="true"
                  ></div>
                  <button
                    v-for="placement in timetableEventsByDate[dateKey] || []"
                    :key="`${placement.event.kind}-${placement.event.id}`"
                    class="calendar-event week-timetable__event"
                    :class="[
                      { 'calendar-event-selected': placement.event.kind === 'session' && selected?.id === placement.event.session.id },
                      { 'calendar-event-rental': placement.event.kind === 'rental' },
                    ]"
                    :style="{
                      top: `${placement.topPx}px`,
                      height: `${placement.heightPx}px`,
                      left: `calc(${placement.lane * 100 / placement.laneCount}% + 2px)`,
                      width: `calc(${100 / placement.laneCount}% - 4px)`,
                    }"
                    :aria-pressed="placement.event.kind === 'session' ? selected?.id === placement.event.session.id : undefined"
                    :aria-label="eventAriaLabel(placement.event)"
                    :disabled="!eventCanOpen(placement.event)"
                    :title="`${eventTypeLabel(placement.event)} · ${eventAriaLabel(placement.event)} · Phòng ${eventRoom(placement.event)}`"
                    @click="selectCalendarEvent(placement.event)"
                  >
                    <span class="week-timetable__event-heading">
                      <span class="calendar-event-kind">{{ eventTypeLabel(placement.event) }}</span>
                      <span class="badge week-timetable__event-status" :class="eventStatusClass(placement.event)">{{ eventStatusLabel(placement.event) }}</span>
                    </span>
                    <span class="calendar-event-time">{{ formatBusinessTime(placement.event.startsAt) }}–{{ formatBusinessTime(placement.event.endsAt) }}</span>
                    <span class="calendar-event-name">{{ eventPrimaryLabel(placement.event) }}</span>
                    <span v-if="placement.heightPx >= 60" class="calendar-event-room">{{ placement.event.kind === 'rental' ? `Phòng ${eventRoom(placement.event)}` : eventRoom(placement.event) }}</span>
                  </button>
                </section>
              </div>
            </div>
            <div v-if="loading" class="text-center text-secondary py-3" role="status">Đang tải buổi học…</div>
            <div v-else-if="!loading && !errorMessage && !visibleCalendarEventCount" class="session-calendar-empty text-center text-secondary py-3">
              <p class="mb-2">{{ calendarEmptyMessage }}</p>
              <button v-if="!showHistory && (hiddenHistorySessions.length || (eventFilter !== 'sessions' && hiddenHistoryRentals.length))" type="button" class="btn btn-sm btn-outline-primary" @click="revealHiddenHistory">
                {{ hiddenHistorySessionsInView.length ? 'Hiện lịch sử' : 'Xem lịch sử trong danh sách' }}
              </button>
            </div>
          </div>

          <div v-else key="month" class="session-calendar-view">
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
                      v-for="event in visibleEventsByDate[dateKey] || []"
                      :key="`${event.kind}-${event.id}`"
                      class="calendar-event"
                      :class="[{ 'calendar-event-selected': event.kind === 'session' && selected?.id === event.session.id }, { 'calendar-event-rental': event.kind === 'rental' }]"
                      :aria-pressed="event.kind === 'session' ? selected?.id === event.session.id : undefined"
                      :aria-label="eventAriaLabel(event)"
                      :disabled="!eventCanOpen(event)"
                      @click="selectCalendarEvent(event)"
                    >
                      <span class="calendar-event-kind">{{ eventTypeLabel(event) }}</span>
                      <span class="calendar-event-time">{{ formatBusinessTime(event.startsAt) }}–{{ formatBusinessTime(event.endsAt) }}</span>
                      <span class="calendar-event-name">{{ eventPrimaryLabel(event) }}</span>
                      <span class="calendar-event-room">{{ event.kind === 'rental' ? `Phòng ${eventRoom(event)}` : eventRoom(event) }}</span>
                      <span class="badge align-self-start" :class="eventStatusClass(event)">{{ eventStatusLabel(event) }}</span>
                    </button>
                  </div>
                </section>
              </div>
            </div>
            <div class="session-agenda" aria-label="Buổi học trong kỳ này">
              <div v-for="event in agendaEvents" :key="`${event.kind}-${event.id}`" class="session-agenda__item" :class="{ 'session-agenda__item-rental': event.kind === 'rental' }">
                <button type="button" class="session-agenda__select" :aria-pressed="event.kind === 'session' ? selected?.id === event.session.id : undefined" :disabled="!eventCanOpen(event)" @click="selectCalendarEvent(event)">
                  <span class="session-agenda__time">{{ formatBusinessDate(getBusinessDateKey(event.startsAt)) }} · {{ formatBusinessTime(event.startsAt) }}–{{ formatBusinessTime(event.endsAt) }}</span>
                  <strong><span class="badge me-1" :class="event.kind === 'rental' ? 'text-bg-info' : 'text-bg-secondary'">{{ eventTypeLabel(event) }}</span>{{ eventPrimaryLabel(event) }}</strong>
                  <span>Phòng {{ eventRoom(event) }}</span>
                </button>
                <span class="badge" :class="eventStatusClass(event)">{{ eventStatusLabel(event) }}</span>
              </div>
            </div>
            <div v-if="loading" class="text-center text-secondary py-3" role="status">Đang tải buổi học…</div>
            <div v-else-if="!loading && !errorMessage && !visibleCalendarEventCount" class="session-calendar-empty text-center text-secondary py-3">
              <p class="mb-2">{{ calendarEmptyMessage }}</p>
              <button v-if="!showHistory && (hiddenHistorySessions.length || (eventFilter !== 'sessions' && hiddenHistoryRentals.length))" type="button" class="btn btn-sm btn-outline-primary" @click="revealHiddenHistory">
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
      <DetailModal v-if="selected && (selectedDetailOpen || openExcelAfterDetailHidden || returnToDetailAfterExcel)" v-model="selectedDetailOpen" :title="className(selected)" :description="`${formatDateTime(selected.scheduled_start_at)} · ${selected.status}`" size="xl" @hidden="handleSelectedDetailHidden">
          <CompletedSessionAttendanceEditor
            v-if="isCompletedAttendanceDetail"
            v-model:rows="learningRows"
            v-model:start-input="startInput"
            v-model:end-input="endInput"
            v-model:room-input="sessionRoomInput"
            v-model:session-note-input="sessionNoteInput"
            v-model:lesson-youtube-input="lessonYoutubeInput"
            v-model:teacher-eligibility-draft="teacherEligibilityDraft"
            :session="selected"
            :editing="completedSessionEditOpen"
            :saving="completedSessionCorrectionBusy"
            :dirty="completedSessionEditsDirty"
            :error="completedSessionCorrectionError"
            :timesheet-saving="completedTimesheetBusy"
            :timesheet-dirty="teacherEligibilityDirty"
            :timesheet-error="completedTimesheetError"
            :deletable="canDeleteSelectedSession"
            :deleting="deleteSessionPreviewBusy"
            @edit="completedSessionEditOpen = true; completedSessionCorrectionError = ''"
            @cancel="cancelCompletedSessionEdit"
            @save="saveCompletedSessionCorrection"
            @save-timesheets="saveCompletedSessionTimesheets"
            @delete="confirmDeleteSession"
          />
          <template v-else>
          <h2 class="h5">{{ className(selected) }}</h2>
          <div class="text-secondary mb-3">Giáo viên: {{ teachers }} · {{ selected.status }} · {{ sessionRoomInput || 'Chưa xếp phòng' }}</div>
          <div v-if="selected.status !== 'CANCELLED'" class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <button
              class="btn btn-outline-primary btn-sm"
              type="button"
              :disabled="!canAdminFinalizeAttendance || learningBusy || rosterEditorBusy || !learningRows.length"
              :title="canAdminFinalizeAttendance ? 'Tải mẫu hoặc nhập kết quả Excel cho buổi này' : `Admin chỉ chốt điểm danh sau ${formatDateTime(selected.scheduled_end_at)}`"
              @click="openExcelAttendance"
            >
              Điểm danh bằng Excel
            </button>
            <span v-if="!canAdminFinalizeAttendance" class="small text-secondary" role="status">
              {{ `Có thể nhập sau ${formatDateTime(selected.scheduled_end_at)}.` }}
            </span>
          </div>
          <div v-if="canEditSelectedSession" class="row g-2 align-items-end mb-3">
            <div class="col-md-8"><label class="form-label" for="session-detail-teachers">Giáo viên được phân công cho buổi này ({{ teacherCountLabel(selected.class_id, selectedTeacherIds, selected.id) }})</label><TeacherPicker id="session-detail-teachers" :model-value="selectedTeacherIds" :teachers="activeTeachers" multiple placeholder="Tìm theo tên hoặc mã giáo viên" :disabled="teacherSaveBusy || adminAttendanceTakenOver" :disabled-ids="activeTeachers.filter((teacher) => !canSelectSessionTeacher(teacher.id)).map((teacher) => teacher.id)" @update:model-value="updateSelectedTeacherSelection" /></div>
            <div class="col-md-4"><button class="btn btn-outline-primary" :disabled="teacherSaveBusy || adminAttendanceTakenOver || selectedSessionTeacherCount > MAX_CLASS_TEACHERS" @click="saveTeachers">{{ teacherSaveBusy ? 'Đang lưu…' : 'Lưu phân công buổi này' }}</button></div>
          </div>
          <p v-if="adminAttendanceTakenOver" class="small text-secondary">Phân công giáo viên và roster đã khóa sau khi Admin chốt điểm danh; quyết định tính công vẫn có thể chỉnh trong biểu mẫu bên dưới.</p>
          <div class="row g-2 mb-3">
            <div class="col-md-4"><label class="form-label">Bắt đầu</label><input v-model="startInput" class="form-control" type="datetime-local" :disabled="!canEditSelectedSession || scheduleSaveBusy" /></div>
            <div class="col-md-4"><label class="form-label">Kết thúc</label><input v-model="endInput" class="form-control" type="datetime-local" :disabled="!canEditSelectedSession || scheduleSaveBusy" /></div>
            <div class="col-md-4"><label class="form-label">Phòng</label><input v-model="sessionRoomInput" class="form-control" :disabled="!canEditSelectedSession || scheduleSaveBusy" /></div>
          </div>
          <div v-if="canEditSelectedSession" class="d-flex flex-wrap gap-2 mb-4">
            <button class="btn btn-primary btn-sm" :disabled="scheduleSaveBusy" @click="saveSchedule">{{ scheduleSaveBusy ? 'Đang lưu…' : 'Lưu thông tin buổi học' }}</button>
            <button v-if="canCancelOrDeleteSelectedSession" class="btn btn-outline-danger btn-sm" @click="cancel">Hủy buổi học</button>
            <button v-if="canDeleteSelectedSession" class="btn btn-danger btn-sm" :disabled="deleteSessionPreviewBusy" @click="confirmDeleteSession">{{ deleteSessionPreviewBusy ? 'Đang xem dữ liệu…' : 'Xóa buổi học' }}</button>
          </div>
          <p v-if="selected.session_note && (!canEditSelectedLearning || !learningEditorOpen)" class="border-start border-3 ps-3">{{ selected.session_note }}</p>
          <YouTubePlayer v-if="selected.lesson_youtube_url && (!canEditSelectedLearning || !learningEditorOpen)" class="mb-3" :url="selected.lesson_youtube_url" :title="`Video bài học ${className(selected)}`" />
          <div v-if="canEditSelectedLearning" class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 mb-2">
            <h3 class="h6 mb-0">Nội dung và kết quả học tập</h3>
            <button class="btn btn-outline-primary btn-sm" type="button" @click="learningEditorOpen = !learningEditorOpen">
              {{ learningEditorOpen ? 'Ẩn biểu mẫu chỉnh sửa' : 'Sửa nội dung, điểm danh và đánh giá' }}
            </button>
          </div>
          <section v-if="learningEditorOpen && canEditSelectedLearning" class="border rounded p-3 mb-4" aria-label="Chỉnh sửa nội dung và kết quả buổi học">
            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label" for="admin-session-note">Ghi chú buổi học</label>
                <textarea id="admin-session-note" v-model="sessionNoteInput" class="form-control" rows="3" maxlength="4000" :disabled="learningBusy || rosterEditorBusy" placeholder="Ghi chú nội dung buổi học"></textarea>
              </div>
              <div class="col-md-6">
                <label class="form-label" for="admin-session-youtube">Video YouTube</label>
                <input id="admin-session-youtube" v-model="lessonYoutubeInput" class="form-control" type="url" :disabled="learningBusy || rosterEditorBusy" placeholder="https://youtu.be/..." />
                <small class="text-secondary">Để trống nếu buổi học không có video.</small>
              </div>
            </div>
            <div v-if="selected.status === 'IN_PROGRESS'" class="alert alert-info py-2" role="status">Buổi đang diễn ra. Admin có thể kết thúc sớm sau khi nhập đủ điểm danh và chọn quyết định chấm công cho từng giáo viên.</div>
            <div v-else-if="!canAdminFinalizeAttendance" class="alert alert-info py-2" role="status">{{ `Admin chỉ có thể chốt điểm danh và chấm công sau ${formatDateTime(selected.scheduled_end_at)}.` }} Có thể lưu ghi chú hoặc video trước thời điểm này.</div>
            <p class="small text-secondary">Mỗi học sinh cần có trạng thái điểm danh. Hãy chọn quyết định công cho từng giáo viên trước khi chốt. Điểm bài tập 0–10, hiểu bài và thái độ 1–5; các điểm được phép để trống.</p>
            <div v-for="row in learningRows" :key="row.student_id" class="border rounded p-3 mb-3">
              <div class="fw-semibold mb-2">{{ row.students?.full_name || 'Học sinh' }} <small class="text-secondary">{{ row.students?.student_code }}</small></div>
              <div class="row g-2">
                <div class="col-md-3">
                  <label class="form-label" :for="`admin-attendance-status-${row.student_id}`">Điểm danh</label>
                  <select :id="`admin-attendance-status-${row.student_id}`" v-model="row.attendance.status" class="form-select" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance" :aria-label="`Trạng thái điểm danh của ${row.students?.full_name || 'học sinh'}`">
                    <option :value="null">Chọn trạng thái</option>
                    <option v-for="status in attendanceStatuses" :key="status" :value="status">{{ attendanceStatusLabel(status) }}</option>
                  </select>
                  <small v-if="learningValidationErrors[row.student_id]" class="text-danger" role="alert">{{ learningValidationErrors[row.student_id] }}</small>
                </div>
                <div class="col-md-2"><label class="form-label" :for="`admin-late-${row.student_id}`">Phút đi muộn</label><input :id="`admin-late-${row.student_id}`" v-model.number="row.attendance.late_minutes" class="form-control" type="number" min="0" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance || row.attendance.status !== 'LATE'" placeholder="—" /></div>
                <div class="col-md-3"><label class="form-label" :for="`admin-absence-${row.student_id}`">Lý do vắng</label><input :id="`admin-absence-${row.student_id}`" v-model="row.attendance.absence_reason" class="form-control" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance || !['ABSENT', 'EXCUSED'].includes(row.attendance.status || '')" placeholder="Không bắt buộc" /></div>
                <div class="col-md-2"><label class="form-label" :for="`admin-homework-${row.student_id}`">BTVN /10</label><input :id="`admin-homework-${row.student_id}`" v-model.number="row.attendance.homework_score" class="form-control" type="number" min="0" max="10" step="0.1" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance" placeholder="—" /></div>
                <div class="col-md-2"><label class="form-label" :for="`admin-understanding-${row.student_id}`">Hiểu bài /5</label><input :id="`admin-understanding-${row.student_id}`" v-model.number="row.attendance.understanding_score" class="form-control" type="number" min="1" max="5" step="1" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance" placeholder="—" /></div>
                <div class="col-md-2"><label class="form-label" :for="`admin-attitude-${row.student_id}`">Thái độ /5</label><input :id="`admin-attitude-${row.student_id}`" v-model.number="row.attendance.attitude_score" class="form-control" type="number" min="1" max="5" step="1" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance" placeholder="—" /></div>
                <div class="col-md-2"><label class="form-label" :for="`admin-feedback-count-${row.student_id}`">Điểm cộng</label><input :id="`admin-feedback-count-${row.student_id}`" v-model.number="row.attendance.positive_feedback_count" class="form-control" type="number" min="0" step="1" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance" placeholder="—" /></div>
                <div class="col-md-4"><label class="form-label" :for="`admin-homework-note-${row.student_id}`">Ghi chú BTVN</label><input :id="`admin-homework-note-${row.student_id}`" v-model="row.attendance.homework_note" class="form-control" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance" /></div>
                <div class="col-md-4"><label class="form-label" :for="`admin-feedback-raw-${row.student_id}`">Ghi nhận điểm cộng</label><input :id="`admin-feedback-raw-${row.student_id}`" v-model="row.attendance.positive_feedback_raw" class="form-control" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance" /></div>
                <div class="col-12"><label class="form-label" :for="`admin-attendance-comment-${row.student_id}`">Nhận xét</label><textarea :id="`admin-attendance-comment-${row.student_id}`" v-model="row.attendance.comment" class="form-control" rows="2" maxlength="2000" :disabled="learningBusy || rosterEditorBusy || !canAdminFinalizeAttendance"></textarea></div>
              </div>
            </div>
            <div v-if="!learningRows.length" class="text-secondary small mb-3">Chưa có học sinh trong roster buổi học.</div>
            <section v-if="assignedTeachers.length" class="border rounded p-3 mb-3" aria-label="Quyết định tính công cho giáo viên">
              <h4 class="h6">Quyết định chấm công</h4>
              <div v-for="teacher in assignedTeachers" :key="teacher.staff_id" class="row align-items-center g-2 py-1">
                <label class="col-md-6" :for="`admin-timesheet-decision-${teacher.staff_id}`">{{ teacher.staff?.full_name || teacher.staff_id }}</label>
                <div class="col-md-6">
                  <select :id="`admin-timesheet-decision-${teacher.staff_id}`" v-model="teacherEligibilityDraft[teacher.staff_id]" class="form-select" :disabled="learningBusy || !canAdminFinalizeAttendance">
                    <option :value="null">Chọn quyết định</option>
                    <option :value="true">Tính công</option>
                    <option :value="false">Không tính công</option>
                  </select>
                </div>
              </div>
              <small v-if="learningTeacherValidationError" class="text-danger" role="alert">{{ learningTeacherValidationError }}</small>
              <small v-else-if="adminAttendanceTakenOver" class="text-secondary">Admin có thể đổi quyết định; lần đổi được ghi vào lịch sử.</small>
            </section>
            <div class="d-flex flex-wrap align-items-center gap-2">
              <button class="btn btn-primary btn-sm" type="button" :disabled="learningBusy || rosterEditorBusy || !learningDirty || (adminAttendanceDirty && !canAdminFinalizeAttendance)" @click="saveSelectedLearning">{{ learningBusy ? 'Đang lưu…' : completedTimesheetOnlyChange ? 'Lưu quyết định chấm công' : adminAttendanceDirty ? selected.status === 'IN_PROGRESS' ? 'Kết thúc buổi và chốt điểm danh, chấm công' : 'Chốt điểm danh và chấm công' : 'Lưu nội dung buổi học' }}</button>
              <span v-if="dirtyLearningRows.length" class="small text-secondary">{{ dirtyLearningRows.length }} học sinh có thay đổi.</span>
            </div>
          </section>
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 mb-2">
            <h3 class="h6 mb-0">Học sinh và kết quả</h3>
            <div v-if="canEditSelectedSession && !adminAttendanceTakenOver" class="d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm" :disabled="rosterEditorLoading || rosterEditorBusy" @click="openRosterEditor">{{ rosterEditorLoading ? 'Đang tải lớp…' : 'Sửa danh sách học sinh' }}</button>
              <button class="btn btn-outline-success btn-sm" :disabled="rosterEditorLoading || rosterEditorBusy || rosterEditorOpen" @click="prepareSessionRosterSync">Đồng bộ học sinh theo lớp</button>
            </div>
          </div>
          <div v-if="students.length" class="alert alert-info py-2 mb-3" role="status" aria-label="Kiểm tra dữ liệu điểm danh">
            <strong>Kiểm tra dữ liệu trong CSDL:</strong>
            {{ attendanceDiagnostics.attendanceCount }}/{{ attendanceDiagnostics.rosterCount }} học sinh có bản ghi điểm danh;
            trạng thái {{ attendanceDiagnostics.statusCount }}/{{ attendanceDiagnostics.rosterCount }};
            BTVN {{ attendanceDiagnostics.homeworkCount }}/{{ attendanceDiagnostics.rosterCount }};
            Hiểu bài {{ attendanceDiagnostics.understandingCount }}/{{ attendanceDiagnostics.rosterCount }};
            Thái độ {{ attendanceDiagnostics.attitudeCount }}/{{ attendanceDiagnostics.rosterCount }}.
            <div v-if="attendanceDiagnostics.objectRelationDetected" class="mt-1">
              Nguyên nhân giao diện cũ không hiện kết quả: API trả quan hệ attendance một-một dạng object, còn giao diện cũ đọc như mảng bằng <code>[0]</code>. Bản sửa đã chuẩn hóa dữ liệu.
            </div>
            <div v-if="attendanceDiagnostics.homeworkCount < attendanceDiagnostics.rosterCount || attendanceDiagnostics.understandingCount < attendanceDiagnostics.rosterCount || attendanceDiagnostics.attitudeCount < attendanceDiagnostics.rosterCount" class="mt-1">
              Các ô “—” tương ứng với trường điểm chưa có giá trị lưu trong CSDL.
            </div>
          </div>
          <div
            v-if="attendanceSaveVerification"
            class="alert py-2 mb-3"
            :class="attendanceSaveVerification.kind === 'success' ? 'alert-success' : attendanceSaveVerification.kind === 'warning' ? 'alert-warning' : 'alert-danger'"
            :role="attendanceSaveVerification.kind === 'success' ? 'status' : 'alert'"
            aria-label="Kết quả xác minh lưu điểm danh"
          >{{ attendanceSaveVerification.message }}</div>
          <p v-if="adminAttendanceTakenOver" class="small text-secondary">Roster đã khóa sau khi Admin chốt điểm danh để giữ đủ dữ liệu của buổi.</p>
          <div v-if="rosterEditorError" class="alert alert-danger py-2" role="alert">{{ rosterEditorError }}</div>
          <section v-if="rosterEditorOpen" class="border rounded p-3 mb-3" aria-label="Sửa danh sách học sinh của buổi học">
            <div class="fw-semibold mb-1">Thành viên lớp có hiệu lực ngày {{ formatBusinessDate(selectedSessionDate) }}</div>
            <p class="small text-secondary">Chỉ thêm học sinh cùng lớp có membership hiệu lực đúng ngày này. Dòng đã có điểm danh, đánh giá hoặc dữ liệu được bảo vệ sẽ được giữ nguyên.</p>
            <div v-if="!sessionRosterCandidates.length" class="text-secondary small mb-3">Không có thành viên đang hoạt động trong lớp vào ngày buổi học.</div>
            <div v-for="membership in sessionRosterCandidates" :key="membership.student_id" class="form-check py-1">
              <input :id="`session-roster-student-${membership.student_id}`" v-model="selectedRosterStudentIds" class="form-check-input" type="checkbox" :value="membership.student_id" :disabled="sessionStudentHasHistory(students.find((row) => row.student_id === membership.student_id) || {})" />
              <label class="form-check-label" :for="`session-roster-student-${membership.student_id}`">
                {{ membership.students?.full_name }} <span class="text-secondary">{{ membership.students?.student_code }}</span>
                <span v-if="sessionStudentHasHistory(students.find((row) => row.student_id === membership.student_id) || {})" class="badge text-bg-light ms-1">Đã có dữ liệu, giữ nguyên</span>
              </label>
            </div>
            <div v-for="row in students.filter((item) => !sessionRosterCandidates.some((membership) => membership.student_id === item.student_id))" :key="`outside-membership-${row.student_id}`" class="small text-secondary mt-2">
              {{ row.students?.full_name || row.student_id }} · {{ sessionStudentHasHistory(row) ? 'được giữ vì đã có điểm danh hoặc dữ liệu đánh giá.' : 'không còn membership hiệu lực; chỉ gỡ khi không có dữ liệu cần bảo toàn.' }}
            </div>
            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-primary btn-sm" :disabled="rosterEditorBusy" @click="saveSelectedRoster">{{ rosterEditorBusy ? 'Đang lưu…' : 'Lưu danh sách' }}</button>
              <button class="btn btn-outline-secondary btn-sm" :disabled="rosterEditorBusy" @click="rosterEditorOpen = false">Đóng</button>
            </div>
          </section>
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
          </template>
          <template #footer><button class="btn btn-outline-secondary" type="button" @click="selectedDetailOpen = false">Đóng</button></template>
      </DetailModal>
    </div>
  </div>
  </template>
  <ConfirmModal v-model="confirmOpen" v-bind="confirmDetails" :busy="confirmBusy" :error="['delete-month-sessions', 'delete-session', 'sync-session-roster'].includes(confirmActionType) ? deleteError : ''" @confirm="runConfirmation" />
</template>

<style scoped>
.attended-session-page {
  width: 100%;
  min-width: 0;
}

.attended-session-page__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 1rem 1.15rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-surface);
}

.attended-session-page__back,
.attended-session-page__export {
  min-height: 44px;
  white-space: nowrap;
}

.attended-session-page__heading {
  min-width: 0;
}

.attended-session-page__heading h1 {
  margin: 0.2rem 0 0.15rem;
  font-size: clamp(1.3rem, 2vw, 1.8rem);
}

.attended-session-page__eyebrow {
  color: var(--color-primary);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.attended-session-page__content {
  min-width: 0;
}

@media (max-width: 767.98px) {
  .attended-session-page__header {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.8rem;
    padding: 0.85rem;
  }

  .attended-session-page__back {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .attended-session-page__heading {
    grid-column: 1;
  }

  .attended-session-page__export {
    grid-column: 2;
    grid-row: 2;
    align-self: center;
  }
}

.calendar-period-title {
  min-width: 13rem;
}

.class-filter {
  min-width: min(100%, 18rem);
  max-width: 30rem;
}

.event-filter {
  width: auto;
  min-width: 9rem;
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

.month-import-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.65rem;
}

.month-import-summary > div {
  display: flex;
  min-height: 4.25rem;
  flex-direction: column;
  justify-content: center;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.55rem;
  background: var(--bs-tertiary-bg);
}

.month-import-summary strong {
  font-size: 1.15rem;
}

.month-import-summary span {
  color: var(--bs-secondary-color);
  font-size: 0.78rem;
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

.calendar-event-rental {
  border-style: dashed;
  border-left-color: var(--bs-info);
  background: var(--bs-info-bg-subtle);
}

.calendar-event-kind {
  color: var(--bs-info-text-emphasis);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.calendar-event-rental:disabled,
.session-agenda__select:disabled {
  cursor: default;
  opacity: 0.85;
}

.session-agenda__item-rental {
  border-left: 3px dashed var(--bs-info);
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

.week-timetable-scroll {
  max-height: min(72vh, 880px);
  overflow: auto;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.week-timetable {
  display: grid;
  grid-template-columns: 4.25rem repeat(7, minmax(8.5rem, 1fr));
  grid-template-rows: auto auto;
  min-width: 1010px;
}

.week-timetable__corner,
.week-timetable__heading {
  position: sticky;
  top: 0;
  z-index: 4;
  min-height: 3.7rem;
  background: var(--bs-tertiary-bg);
  border-right: 1px solid var(--bs-border-color);
  border-bottom: 1px solid var(--bs-border-color);
}

.week-timetable__corner {
  left: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bs-secondary-color);
  font-size: 0.72rem;
  font-weight: 600;
}

.week-timetable__heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 1fr 1fr;
  align-items: center;
  column-gap: 0.35rem;
  padding: 0.25rem 0.4rem;
}

.week-timetable__heading--today {
  box-shadow: inset 0 -2px 0 var(--bs-primary);
}

.week-timetable__weekday {
  overflow: hidden;
  color: var(--bs-secondary-color);
  font-size: 0.72rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-timetable__date {
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-timetable__today {
  grid-column: 2;
  grid-row: 2;
  justify-self: end;
  font-size: 0.58rem;
}

.week-timetable__heading .calendar-add-button {
  grid-column: 2;
  grid-row: 1;
}

.week-timetable__time-axis {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 4.25rem;
  background: var(--bs-body-bg);
  border-right: 1px solid var(--bs-border-color);
}

.week-timetable__axis-line,
.week-timetable__grid-line {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px dashed var(--bs-border-color);
  pointer-events: none;
}

.week-timetable__axis-line--hour,
.week-timetable__grid-line--hour {
  border-top-style: solid;
}

.week-timetable__time-label {
  position: absolute;
  right: 0.25rem;
  z-index: 1;
  padding: 0 0.1rem;
  transform: translateY(-50%);
  background: var(--bs-body-bg);
  color: var(--bs-secondary-color);
  font-size: 0.62rem;
  line-height: 1.15;
  white-space: nowrap;
}

.week-timetable__time-label--hour {
  color: var(--bs-body-color);
  font-weight: 600;
}

.week-timetable__time-label:first-of-type {
  transform: translateY(0);
}

.week-timetable__time-label:last-of-type {
  transform: translateY(-100%);
}

.week-timetable__day {
  position: relative;
  min-height: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  border-right: 1px solid var(--bs-border-color);
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg);
}

.week-timetable__day .week-timetable__grid-line {
  z-index: 0;
}

.week-timetable__event {
  position: absolute;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  align-items: stretch;
  gap: 0.06rem;
  padding: 0.12rem 0.18rem;
  overflow: hidden;
  font-size: 0.66rem;
  line-height: 1.08;
}

.week-timetable__event-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.12rem;
}

.week-timetable__event .calendar-event-kind {
  overflow: hidden;
  font-size: 0.54rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-timetable__event-status {
  flex: 0 0 auto;
  padding: 0.12rem 0.22rem;
  font-size: 0.52rem;
  line-height: 1;
}

.week-timetable__event .calendar-event-time {
  overflow: hidden;
  font-size: 0.58rem;
  text-overflow: ellipsis;
}

.week-timetable__event .calendar-event-name,
.week-timetable__event .calendar-event-room {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-timetable__event .calendar-event-room {
  font-size: 0.58rem;
}

.week-timetable__event:focus-visible {
  z-index: 2;
}

@media (max-width: 575.98px) {
  .week-timetable-scroll {
    max-height: 70vh;
    touch-action: pan-x pan-y;
  }

  .week-timetable__heading {
    padding-inline: 0.3rem;
  }
}
</style>
