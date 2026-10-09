import { reviewState } from './review-state'

const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const dayOffset = (days: number) => {
  const date = new Date(`${today}T12:00:00+07:00`)
  date.setDate(date.getDate() + days)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
}
const at = (days: number, time: string) => `${dayOffset(days)}T${time}:00+07:00`

export const students = [
  { id: 'qa-student-1', user_id: 'qa-user-1', student_code: 'QA-S-001', full_name: 'QA- Nguyễn Minh An', phone: '0900000001', email: 'qa.an@example.test', parent_name: 'QA- Nguyễn Thu Hà', parent_phone: '0900000011', address: 'QA- Quận Hải Châu', status: 'ACTIVE', created_at: at(-35, '08:00') },
  { id: 'qa-student-2', user_id: 'qa-user-2', student_code: 'QA-S-002', full_name: 'QA- Trần Gia Linh', phone: '0900000002', email: 'qa.linh@example.test', parent_name: 'QA- Trần Minh Đức', parent_phone: '0900000022', address: 'QA- Quận Thanh Khê', status: 'ACTIVE', created_at: at(-20, '09:30') },
  { id: 'qa-student-3', user_id: 'qa-user-3', student_code: 'QA-S-003', full_name: 'QA- Lê Hoàng Nam', phone: '0900000003', email: null, parent_name: 'QA- Lê Thị Lan', parent_phone: '0900000033', address: 'QA- Quận Sơn Trà', status: 'LOCKED', created_at: at(-8, '14:15') },
  { id: 'qa-student-4', user_id: 'qa-user-4', student_code: 'QA-S-004', full_name: 'QA- Phan Bảo Ngọc', phone: null, email: null, parent_name: null, parent_phone: null, address: null, status: 'ACTIVE', created_at: at(0, '09:00') },
]

export const teachers = [
  { id: 'qa-teacher-1', user_id: 'qa-teacher-user-1', staff_code: 'QA-T-001', full_name: 'QA- Phạm Thu Trang', staff_type: 'TEACHER', phone: '0910000001', email: 'qa.trang@example.test', address: 'QA- Đà Nẵng', notes: 'QA- Giáo viên phụ trách Toán tư duy.', status: 'ACTIVE', created_at: at(-120, '08:30'), updated_at: at(-4, '16:15') },
  { id: 'qa-teacher-2', user_id: 'qa-teacher-user-2', staff_code: 'QA-T-002', full_name: 'QA- Võ Quốc Bảo', staff_type: 'TEACHER', phone: '0910000002', email: 'qa.bao@example.test', address: 'QA- Đà Nẵng', notes: 'QA- Giáo viên phụ trách Tiếng Anh.', status: 'ACTIVE', created_at: at(-90, '09:00'), updated_at: at(-2, '11:45') },
]

export const subjects = [{ id: 'qa-subject-1', name: 'QA- Toán' }, { id: 'qa-subject-2', name: 'QA- Tiếng Anh' }]
export const grades = [{ id: 'qa-grade-1', name: 'QA- Lớp 5' }, { id: 'qa-grade-2', name: 'QA- Lớp 8' }]

export const classes: any[] = [
  { id: 'qa-class-1', code: 'QA-MATH-05', name: 'QA- Toán tư duy 5A', subject_id: 'qa-subject-1', grade_id: 'qa-grade-1', max_students: 12, capacity_policy: 'WARNING', status: 'ACTIVE', subjects: subjects[0], grades: grades[0] },
  { id: 'qa-class-2', code: 'QA-ENG-08', name: 'QA- Tiếng Anh 8B', subject_id: 'qa-subject-2', grade_id: 'qa-grade-2', max_students: null, capacity_policy: 'UNLIMITED', status: 'ACTIVE', subjects: subjects[1], grades: grades[1] },
]

export const memberships: any[] = [
  { id: 'qa-membership-1', class_id: 'qa-class-1', student_id: 'qa-student-1', start_date: dayOffset(-55), end_date: null, status: 'ACTIVE', students: students[0] },
  { id: 'qa-membership-2', class_id: 'qa-class-1', student_id: 'qa-student-2', start_date: dayOffset(-25), end_date: null, status: 'ACTIVE', students: students[1] },
  { id: 'qa-membership-3', class_id: 'qa-class-1', student_id: 'qa-student-4', start_date: today, end_date: null, status: 'ACTIVE', students: students[3] },
]

export const schedules: any[] = [
  { id: 'qa-schedule-1', class_id: 'qa-class-1', day_of_week: new Date(`${today}T12:00:00Z`).getUTCDay() || 7, start_time: '17:30:00', end_time: '19:00:00', room: 'QA-A1', status: 'ACTIVE', reviewed_at: at(-15, '10:00'), class_schedule_staff: [{ staff_id: 'qa-teacher-1', staff: teachers[0] }] },
]

export const sessions: any[] = [
  { id: 'qa-session-1', class_id: 'qa-class-1', recurrence_schedule_id: 'qa-schedule-1', manual_schedule: false, scheduled_start_at: at(1, '17:30'), scheduled_end_at: at(1, '19:00'), status: 'SCHEDULED', room: 'QA-A1', session_note: null, classes: classes[0], class_schedules: schedules[0], session_staff: [{ staff_id: 'qa-teacher-1', assignment_role: 'TEACHER', staff: teachers[0] }], session_students: memberships.filter((item) => item.student_id !== 'qa-student-4').map((item) => ({ student_id: item.student_id })) },
  { id: 'qa-session-2', class_id: 'qa-class-1', recurrence_schedule_id: 'qa-schedule-1', manual_schedule: false, scheduled_start_at: at(0, '10:00'), scheduled_end_at: at(0, '11:30'), status: 'IN_PROGRESS', room: 'QA-A1', session_note: 'Phân số và bài tập ứng dụng.', classes: classes[0], class_schedules: schedules[0], session_staff: [{ staff_id: 'qa-teacher-1', assignment_role: 'TEACHER', staff: teachers[0] }], session_students: memberships.map((item) => ({ student_id: item.student_id })) },
  { id: 'qa-session-3', class_id: 'qa-class-2', scheduled_start_at: at(-1, '15:00'), scheduled_end_at: at(-1, '16:30'), status: 'COMPLETED', room: 'QA-B2', session_note: 'Ôn tập từ vựng.', lesson_youtube_url: 'https://youtu.be/dQw4w9WgXcQ', classes: classes[1], class_schedules: null, session_staff: [{ staff_id: 'qa-teacher-2', assignment_role: 'TEACHER', staff: teachers[1] }], session_students: [] },
  { id: 'qa-session-4', class_id: 'qa-class-1', recurrence_schedule_id: 'qa-schedule-1', manual_schedule: false, scheduled_start_at: at(-3, '17:30'), scheduled_end_at: at(-3, '19:00'), status: 'COMPLETED', room: 'QA-A1', session_note: 'Phép chia và luyện tập.', classes: classes[0], class_schedules: schedules[0], session_staff: [{ staff_id: 'qa-teacher-1', assignment_role: 'TEACHER', staff: teachers[0] }], session_students: [{ student_id: 'qa-student-1' }, { student_id: 'qa-student-2' }] },
  { id: 'qa-session-5', class_id: 'qa-class-2', recurrence_schedule_id: null, manual_schedule: true, scheduled_start_at: at(3, '15:00'), scheduled_end_at: at(3, '16:30'), status: 'SCHEDULED', room: 'QA-B2', session_note: null, classes: classes[1], class_schedules: null, session_staff: [{ staff_id: 'qa-teacher-2', assignment_role: 'TEACHER', staff: teachers[1] }], session_students: [] },
  { id: 'qa-session-6', class_id: 'qa-class-2', recurrence_schedule_id: null, manual_schedule: true, scheduled_start_at: at(-2, '15:00'), scheduled_end_at: at(-2, '16:30'), status: 'CANCELLED', room: 'QA-B2', session_note: null, classes: classes[1], class_schedules: null, session_staff: [], session_students: [] },
]

export const attendance: any[] = [
  { id: 'qa-attendance-1', session_id: 'qa-session-4', student_id: 'qa-student-1', status: 'PRESENT', late_minutes: null, absence_reason: null, homework_score: 8.5, homework_note: 'Bài làm đầy đủ', understanding_score: 4, attitude_score: 5, positive_feedback_count: 1, positive_feedback_raw: 'Chủ động giải thích cách làm', comment: 'Tập trung tốt.', sessions: { ...sessions[3], classes: classes[0], session_staff: sessions[3].session_staff } },
  { id: 'qa-attendance-2', session_id: 'qa-session-4', student_id: 'qa-student-2', status: 'LATE', late_minutes: 5, absence_reason: null, homework_score: 9, homework_note: null, understanding_score: 5, attitude_score: 4, positive_feedback_count: 0, positive_feedback_raw: null, comment: 'Tiến bộ rõ.', sessions: { ...sessions[3], classes: classes[0], session_staff: sessions[3].session_staff } },
]

export const timesheets: any[] = [
  { id: 'qa-timesheet-1', session_id: 'qa-session-4', staff_id: 'qa-teacher-1', status: 'PENDING', submitted_at: at(-2, '09:15'), approved_at: null, approved_by: null, rejection_reason: null, notes: 'Đã dạy đủ thời lượng.', sessions: { ...sessions[3], classes: classes[0] }, staff: teachers[0] },
  { id: 'qa-timesheet-2', session_id: 'qa-session-3', staff_id: 'qa-teacher-2', status: 'APPROVED', submitted_at: at(-1, '18:00'), approved_at: at(-1, '18:30'), approved_by: 'qa-admin', rejection_reason: null, notes: null, sessions: { ...sessions[2], classes: classes[1] }, staff: teachers[1] },
]

async function query<T>(value: T): Promise<T> {
  if (reviewState.mode === 'error') throw new Error('Lỗi mô phỏng QA. Hãy thử lại để kiểm tra trạng thái lỗi.')
  if (reviewState.mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 1100))
  if (reviewState.mode === 'empty') return (Array.isArray(value) ? [] : typeof value === 'number' ? 0 : null) as T
  return structuredClone(value)
}

export function getStudents(search = '') {
  const term = search.trim().toLowerCase()
  return query(term ? students.filter((row) => `${row.full_name} ${row.student_code}`.toLowerCase().includes(term)) : students)
}
export function getStudent(id: string) { return query(students.find((row) => row.id === id) || null) }
export function getStudentHistory() { return query(attendance.map((row) => ({ ...row, scheduled_start_at: row.sessions.scheduled_start_at, scheduled_end_at: row.sessions.scheduled_end_at, classes: row.sessions.classes, teachers: row.sessions.session_staff.map((item: any) => item.staff.full_name), status: row.sessions.status, session_note: row.sessions.session_note, attendance: row }))) }
export function getStaff(search = '') { const term = search.trim().toLowerCase(); return query(term ? teachers.filter((row) => `${row.full_name} ${row.staff_code}`.toLowerCase().includes(term)) : teachers) }
export function getClasses() { return query(classes) }
export function getSubjects() { return query(subjects) }
export function getGrades() { return query(grades) }
export function getClassDetail(id: string) { return query(classes.find((row) => row.id === id) || null) }
export function getClassActiveMemberships(id: string) { return query(memberships.filter((row) => row.class_id === id && row.status === 'ACTIVE')) }
export function getClassRosterForExport(classId: string) {
  const todayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const studentsById = new Map<string, any>()
  for (const membership of memberships) {
    if (membership.class_id !== classId || membership.status !== 'ACTIVE'
      || membership.start_date > todayKey || (membership.end_date && membership.end_date < todayKey)) continue
    const student = students.find((row) => row.id === membership.student_id)
    if (!student || studentsById.has(student.id)) continue
    studentsById.set(student.id, {
      id: student.id,
      student_code: student.student_code ?? null,
      full_name: student.full_name,
      phone: student.phone ?? null,
      parent_name: student.parent_name ?? null,
      status: student.status,
      created_at: student.created_at ?? null,
    })
  }
  return query([...studentsById.values()].sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi')))
}
export function getClassActiveRosterSize(id: string) { return query(memberships.filter((row) => row.class_id === id && row.status === 'ACTIVE').length) }
export function getClassMembershipsForSessionDate(classId: string, sessionDate: string) {
  return query(memberships.filter((row) => row.class_id === classId && row.status === 'ACTIVE'
    && row.start_date <= sessionDate && (!row.end_date || row.end_date >= sessionDate)
    && row.students?.status === 'ACTIVE'))
}
export function getClassSchedules(id: string) { return query(schedules.filter((row) => row.class_id === id)) }
export function getMySessions() { return query(sessions) }
export function getSessionStudents(sessionId: string) {
  const session = sessions.find((item) => item.id === sessionId)
  return query((session?.session_students || []).map((item: any) => {
    const membership = memberships.find((row) => row.class_id === session?.class_id && row.student_id === item.student_id)
    const student = membership?.students || students.find((row) => row.id === item.student_id)
    return {
      ...item,
      student_id: item.student_id,
      students: student ? { student_code: student.student_code, full_name: student.full_name } : null,
      student_attendances: attendance.filter((row) => row.student_id === item.student_id && row.session_id === sessionId),
      assessment_snapshot: item.assessment_snapshot || {},
      monthly_fee_snapshot: item.monthly_fee_snapshot ?? null,
      session_unit_value: item.session_unit_value ?? null,
    }
  }))
}
export function getTimesheets() { return query(timesheets) }
export function getMyTimesheets() { return query(timesheets.filter((row) => row.staff_id === 'qa-teacher-1')) }
export function getMyStaff() { return query(teachers[0]) }
export function getMyStudent() { return query(students[0]) }
export function getMyAttendance() { return query(attendance) }

export async function adminCreateUser(input: any) {
  if (input.role === 'STUDENT') students.unshift({ ...input.student, id: `qa-student-${Date.now()}`, user_id: `qa-user-${Date.now()}`, student_code: input.student.student_code || 'QA-S-NEW', phone: input.phone || null, email: null, address: null, status: 'ACTIVE', created_at: new Date().toISOString() })
  else teachers.unshift({ id: `qa-teacher-${Date.now()}`, user_id: `qa-user-${Date.now()}`, staff_code: input.staff?.staff_code || 'QA-T-NEW', full_name: input.staff.full_name, staff_type: 'TEACHER', phone: input.phone || null, status: 'ACTIVE' })
  return { temporary_password: 'QA-temp-pass-46' }
}
export async function adminResetPassword() { return { temporary_password: '12345678' } }
export async function adminResetPasswordBulk(userIds: string[]) {
  const accounts = [...students, ...teachers]
  const results = userIds.map((userId, index) => {
    const account = accounts.find((row) => row.user_id === userId)
    if (!account) return { user_id: userId, status: 'SKIPPED', password_reset: false, reason_codes: ['ACCOUNT_NOT_FOUND'] }
    if (account.status !== 'ACTIVE') return { user_id: userId, status: 'SKIPPED', password_reset: false, reason_codes: ['TARGET_PROFILE_NOT_ACTIVE'] }
    if (index === 1) return { user_id: userId, status: 'PARTIAL', password_reset: true, reason_codes: ['AUDIT_WRITE_FAILED'] }
    return { user_id: userId, status: 'SUCCESS', password_reset: true, reason_codes: [] }
  })
  return { temporary_password: results.some((result) => result.password_reset) ? '12345678' : null, results }
}
export async function adminExportStudentLogins(userIds: string[]) {
  const authLoginEmails: Record<string, string | null> = {
    'qa-user-1': 'qa-minh-an@hvc-edu.local',
    'qa-user-2': null,
  }
  const active = students.filter((row) => userIds.includes(row.user_id) && row.status === 'ACTIVE')
  const rows = active.map((row) => ({
    student_code: row.student_code,
    full_name: row.full_name,
    login_email: authLoginEmails[row.user_id] || null,
  }))
  return {
    rows,
    missing_email_count: rows.filter((row) => !row.login_email).length,
    skipped_count: userIds.length - active.length,
  }
}
export async function archiveStudent(id: string) { const row = students.find((item) => item.id === id); if (row) row.status = 'ARCHIVED' }
export async function archiveStaff(id: string) { const row = teachers.find((item) => item.id === id); if (row) row.status = 'ARCHIVED' }
export async function setAccountStatus(userId: string, status: string) { const row = [...students, ...teachers].find((item) => item.user_id === userId); if (row) row.status = status }
export async function updateStudent(id: string, input: any) { const row = students.find((item) => item.id === id); if (row) Object.assign(row, input) }
export async function updateStaff(id: string, input: any) { const row = teachers.find((item) => item.id === id); if (row) Object.assign(row, input) }
export async function createClass(input: any) { classes.unshift({ ...input, id: `qa-class-${Date.now()}`, status: 'ACTIVE', subjects: subjects.find((item) => item.id === input.subject_id), grades: grades.find((item) => item.id === input.grade_id) }) }
export async function updateClass(id: string, input: any) { const row = classes.find((item) => item.id === id); if (row) Object.assign(row, input, { subjects: subjects.find((item) => item.id === input.subject_id), grades: grades.find((item) => item.id === input.grade_id) }) }
export async function archiveClass(id: string) { const row = classes.find((item) => item.id === id); if (row) row.status = 'ARCHIVED' }
export async function addClassMembership(input: any) { const student = students.find((item) => item.id === input.student_id); if (student) memberships.push({ ...input, id: `qa-membership-${Date.now()}`, status: 'ACTIVE', end_date: null, students: student }) }
export async function updateClassMembership(id: string, input: any) { const row = memberships.find((item) => item.id === id); if (row) Object.assign(row, input) }
export async function createClassSchedule(input: any) { const row = { ...input, id: `qa-schedule-${Date.now()}`, status: 'PENDING_REVIEW', reviewed_at: null, class_schedule_staff: [] }; schedules.push(row); return row }
export async function updateClassSchedule(id: string, input: any) { const row = schedules.find((item) => item.id === id); if (row) Object.assign(row, input); return {} }
export async function setClassScheduleStatus(id: string, status: string) { const row = schedules.find((item) => item.id === id); if (row) row.status = status; return {} }
function sessionMonth(session: any) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(session.scheduled_start_at))
  return day.slice(0, 7)
}
export async function previewDeleteSessionsForMonth(monthStart: string) {
  const month = monthStart.slice(0, 7)
  const targets = sessions.filter((item) => sessionMonth(item) === month)
  const statusCount = (status: string) => targets.filter((item) => item.status === status).length
  return query({
    month_start: monthStart,
    schedule_count: schedules.length,
    schedule_staff_count: schedules.reduce((sum, item) => sum + (item.class_schedule_staff?.length || 0), 0),
    session_count: targets.length,
    status_counts: {
      SCHEDULED: statusCount('SCHEDULED'),
      IN_PROGRESS: statusCount('IN_PROGRESS'),
      COMPLETED: statusCount('COMPLETED'),
      CANCELLED: statusCount('CANCELLED'),
    },
    session_student_count: targets.reduce((sum, item) => sum + (item.session_students?.length || 0), 0),
    assessment_count: 0,
    session_staff_count: targets.reduce((sum, item) => sum + (item.session_staff?.length || 0), 0),
    staff_replacement_count: 0,
    attendance_count: attendance.filter((item) => targets.some((session) => session.id === item.session_id)).length,
    timesheet_count: timesheets.filter((item) => targets.some((session) => session.id === item.session_id)).length,
    payroll_item_count: 0,
  })
}
export async function deleteSessionsForMonth(monthStart: string) {
  await query(true)
  const month = monthStart.slice(0, 7)
  const targets = sessions.filter((item) => sessionMonth(item) === month)
  const deleted_status_counts = {
    SCHEDULED: targets.filter((item) => item.status === 'SCHEDULED').length,
    IN_PROGRESS: targets.filter((item) => item.status === 'IN_PROGRESS').length,
    COMPLETED: targets.filter((item) => item.status === 'COMPLETED').length,
    CANCELLED: targets.filter((item) => item.status === 'CANCELLED').length,
  }
  const deletedIds = new Set(targets.map((item) => item.id))
  const deleted_schedules = schedules.length
  const deleted_schedule_staff = schedules.reduce((sum, item) => sum + (item.class_schedule_staff?.length || 0), 0)
  const deleted_attendances = attendance.filter((item) => deletedIds.has(item.session_id)).length
  const deleted_timesheets = timesheets.filter((item) => deletedIds.has(item.session_id)).length
  sessions.splice(0, sessions.length, ...sessions.filter((item) => !deletedIds.has(item.id)))
  attendance.splice(0, attendance.length, ...attendance.filter((item) => !deletedIds.has(item.session_id)))
  timesheets.splice(0, timesheets.length, ...timesheets.filter((item) => !deletedIds.has(item.session_id)))
  schedules.splice(0, schedules.length)
  return {
    month_start: monthStart,
    deleted_sessions: targets.length,
    deleted_schedules,
    deleted_schedule_staff,
    deleted_status_counts,
    deleted_session_students: targets.reduce((sum, item) => sum + (item.session_students?.length || 0), 0),
    deleted_session_staff: targets.reduce((sum, item) => sum + (item.session_staff?.length || 0), 0),
    deleted_staff_replacements: 0,
    deleted_attendances,
    deleted_timesheets,
    deleted_payroll_items: 0,
  }
}
export async function addTeacherToClassSchedule(id: string, staffId: string) { const row = schedules.find((item) => item.id === id); const staff = teachers.find((item) => item.id === staffId); if (row && staff) row.class_schedule_staff.push({ staff_id: staffId, staff }); return {} }
export async function removeTeacherFromClassSchedule(id: string, staffId: string) { const row = schedules.find((item) => item.id === id); if (row) row.class_schedule_staff = row.class_schedule_staff.filter((item: any) => item.staff_id !== staffId); return {} }
export async function createManualSession(input: any) { const row = { id: `qa-session-${Date.now()}`, class_id: input.class_id, recurrence_schedule_id: null, recurrence_occurrence_date: null, manual_schedule: true, scheduled_start_at: input.start, scheduled_end_at: input.end, room: input.room, status: 'SCHEDULED', session_note: null, classes: classes.find((item) => item.id === input.class_id), session_staff: input.staff_ids.map((id: string) => ({ staff_id: id, assignment_role: 'TEACHER', staff: teachers.find((item) => item.id === id) })) }; sessions.unshift(row); return { session_id: row.id } }
export async function updateSessionOccurrence(input: any) { const row = sessions.find((item) => item.id === input.session_id); if (row) { if (input.start) row.scheduled_start_at = input.start; if (input.end) row.scheduled_end_at = input.end; if (input.cancel) row.status = 'CANCELLED'; row.room = input.room } }
export async function correctSessionSchedule(input: any) {
  await query(true)
  const row = sessions.find((item) => item.id === input.session_id)
  if (row) {
    row.scheduled_start_at = input.start
    row.scheduled_end_at = input.end
    row.room = input.room
  }
  return { session_id: input.session_id, status: row?.status, room: input.room }
}
export async function correctSessionLearning(input: any) {
  await query(true)
  const session = sessions.find((item) => item.id === input.session_id)
  if (session) {
    session.session_note = input.session_note
    session.lesson_youtube_url = input.lesson_youtube_url
  }
  for (const change of input.students || []) {
    const existing = attendance.find((item) => item.session_id === input.session_id && item.student_id === change.student_id)
    if (existing) Object.assign(existing, change)
    else attendance.push({ id: `qa-attendance-${Date.now()}-${change.student_id}`, session_id: input.session_id, ...change })
  }
  return { session_id: input.session_id, students_updated: (input.students || []).length }
}
export async function updateSessionStudentRoster(input: any) {
  await query(true)
  const session = sessions.find((row) => row.id === input.session_id)
  if (!session) throw new Error('SESSION_NOT_FOUND')
  const previous = session.session_students || []
  const requested = new Set(input.student_ids)
  const protectedIds = new Set(previous.filter((row: any) => attendance.some((item) => item.session_id === session.id && item.student_id === row.student_id)
    || Object.keys(row.assessment_snapshot || {}).length > 0).map((row: any) => row.student_id))
  const nextIds = new Set([...requested, ...protectedIds])
  const removed = previous.filter((row: any) => !nextIds.has(row.student_id))
  session.session_students = [...nextIds].map((student_id) => ({ student_id }))
  return { session_id: session.id, added: [...nextIds].filter((id) => !previous.some((row: any) => row.student_id === id)).length, removed: removed.length, retained_with_history: [...protectedIds].filter((id) => !requested.has(id)).length, student_count: session.session_students.length }
}
export async function syncSessionStudentRoster(sessionId: string) {
  const session = sessions.find((row) => row.id === sessionId)
  if (!session) throw new Error('SESSION_NOT_FOUND')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(session.scheduled_start_at))
  const target = memberships.filter((row) => row.class_id === session.class_id && row.status === 'ACTIVE'
    && row.start_date <= date && (!row.end_date || row.end_date >= date)
    && row.students?.status === 'ACTIVE').map((row) => row.student_id)
  return updateSessionStudentRoster({ session_id: sessionId, student_ids: target })
}
export async function deleteSession(sessionId: string) {
  await query(true)
  const index = sessions.findIndex((row) => row.id === sessionId)
  if (index >= 0) sessions.splice(index, 1)
  return { session_id: sessionId, deleted: true, excluded_occurrence: false }
}
export async function applyWeekToMonth() { return { created: 3 } }
export async function previewMonthWeekTemplateReplacement(monthStart: string, slots: any[]) {
  const month = monthStart.slice(0, 7)
  const targets = sessions.filter((item) => sessionMonth(item) === month)
  const statusCount = (status: string) => targets.filter((item) => item.status === status).length
  const targetIds = new Set(targets.map((item) => item.id))
  let newSessionCount = 0
  const [year, monthNumber] = month.split('-').map(Number)
  const monthLength = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  for (const slot of slots) {
    for (let day = 1; day <= monthLength; day += 1) {
      const weekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay() || 7
      if (weekday === slot.day_of_week) newSessionCount += 1
    }
  }
  return query({
    month_start: monthStart,
    session_count: targets.length,
    status_counts: {
      SCHEDULED: statusCount('SCHEDULED'),
      IN_PROGRESS: statusCount('IN_PROGRESS'),
      COMPLETED: statusCount('COMPLETED'),
      CANCELLED: statusCount('CANCELLED'),
    },
    session_student_count: targets.reduce((sum, item) => sum + (item.session_students?.length || 0), 0),
    assessment_count: 0,
    session_staff_count: targets.reduce((sum, item) => sum + (item.session_staff?.length || 0), 0),
    staff_replacement_count: 0,
    attendance_count: attendance.filter((item) => targetIds.has(item.session_id)).length,
    timesheet_count: timesheets.filter((item) => targetIds.has(item.session_id)).length,
    payroll_item_count: 0,
    new_session_count: newSessionCount,
  })
}
export async function replaceMonthWithWeekTemplate(monthStart: string, slots: any[]) {
  await query(true)
  const month = monthStart.slice(0, 7)
  const targets = sessions.filter((item) => sessionMonth(item) === month)
  const targetIds = new Set(targets.map((item) => item.id))
  const deletedStatusCounts = {
    SCHEDULED: targets.filter((item) => item.status === 'SCHEDULED').length,
    IN_PROGRESS: targets.filter((item) => item.status === 'IN_PROGRESS').length,
    COMPLETED: targets.filter((item) => item.status === 'COMPLETED').length,
    CANCELLED: targets.filter((item) => item.status === 'CANCELLED').length,
  }
  const deletedAttendanceCount = attendance.filter((item) => targetIds.has(item.session_id)).length
  const deletedTimesheetCount = timesheets.filter((item) => targetIds.has(item.session_id)).length
  sessions.splice(0, sessions.length, ...sessions.filter((item) => !targetIds.has(item.id)))
  attendance.splice(0, attendance.length, ...attendance.filter((item) => !targetIds.has(item.session_id)))
  timesheets.splice(0, timesheets.length, ...timesheets.filter((item) => !targetIds.has(item.session_id)))

  const [year, monthNumber] = month.split('-').map(Number)
  const monthLength = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  let createdSessions = 0
  for (let day = 1; day <= monthLength; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    const weekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay() || 7
    for (const slot of slots.filter((item) => item.day_of_week === weekday)) {
      const classRow = classes.find((item) => item.id === slot.class_id)
      const roster = memberships.filter((item) => item.class_id === slot.class_id
        && item.status === 'ACTIVE' && item.start_date <= date && (!item.end_date || item.end_date >= date))
      const id = `qa-template-session-${month.replace('-', '')}-${createdSessions + 1}`
      const session = {
        id,
        class_id: slot.class_id,
        recurrence_schedule_id: null,
        recurrence_occurrence_date: null,
        manual_schedule: true,
        scheduled_start_at: `${date}T${slot.start_time}:00+07:00`,
        scheduled_end_at: `${date}T${slot.end_time}:00+07:00`,
        status: 'SCHEDULED',
        room: slot.room,
        session_note: null,
        classes: classRow,
        class_schedules: null,
        session_staff: slot.staff_ids.map((staffId: string) => ({ staff_id: staffId, assignment_role: 'TEACHER', staff: teachers.find((teacher) => teacher.id === staffId) })),
        session_students: roster.map((membership) => ({ student_id: membership.student_id })),
      }
      sessions.push(session)
      createdSessions += 1
    }
  }
  return {
    month_start: monthStart,
    deleted_sessions: targets.length,
    deleted_status_counts: deletedStatusCounts,
    deleted_session_students: targets.reduce((sum, item) => sum + (item.session_students?.length || 0), 0),
    deleted_session_staff: targets.reduce((sum, item) => sum + (item.session_staff?.length || 0), 0),
    deleted_staff_replacements: 0,
    deleted_attendances: deletedAttendanceCount,
    deleted_timesheets: deletedTimesheetCount,
    deleted_payroll_items: 0,
    created_sessions: createdSessions,
  }
}
export async function updateSessionTeachers(input: any) { const row = sessions.find((item) => item.id === input.session_id); if (row) row.session_staff = input.staff_ids.map((id: string) => ({ staff_id: id, assignment_role: 'TEACHER', staff: teachers.find((item) => item.id === id) })); return {} }
export async function startSession(id: string) { const row = sessions.find((item) => item.id === id); if (row) row.status = 'IN_PROGRESS' }
export async function completeSession(id: string) { const row = sessions.find((item) => item.id === id); if (row) row.status = 'COMPLETED' }
export async function updateSessionLearning(input: any) {
  const session = sessions.find((item) => item.id === input.session_id)
  if (session) { session.session_note = input.session_note; if (input.lesson_youtube_url !== undefined) session.lesson_youtube_url = input.lesson_youtube_url || null }
  for (const change of input.students || []) {
    const existing = attendance.find((item) => item.session_id === input.session_id && item.student_id === change.student_id)
    if (existing) Object.assign(existing, change)
    else attendance.push({ id: `qa-attendance-${Date.now()}-${change.student_id}`, session_id: input.session_id, ...change })
  }
}
export async function askStudentAI(input: any) { return { answer: `QA- Mình sẽ hướng dẫn từng bước${input.session_id ? ' theo bài đã chọn' : ''}.` } }
export async function optimizeTeacherComment(comment: string) {
  return { optimized_comment: `QA- Gợi ý diễn đạt: ${comment.trim().replace(/[.!?]+$/u, '')} với lời nhận xét rõ ràng và tích cực hơn.` }
}
export async function submitTimesheet(input: any) { const row = { id: `qa-timesheet-${Date.now()}`, session_id: input.session_id, staff_id: 'qa-teacher-1', status: 'PENDING', submitted_at: new Date().toISOString(), approved_at: null, approved_by: null, rejection_reason: null, notes: input.notes, sessions: sessions.find((item) => item.id === input.session_id), staff: teachers[0] }; timesheets.unshift(row); return row }
export async function reviewTimesheet(input: any) { const row = timesheets.find((item) => item.id === input.timesheet_id); if (row) { row.status = input.approve ? 'APPROVED' : 'REJECTED'; row.rejection_reason = input.reason || null }; return row }
export async function updateMyStaffProfile(input: any) { Object.assign(teachers[0], input) }
