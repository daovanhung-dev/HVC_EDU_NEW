import { supabase } from './supabase'
import type { ClassDetailRow, ClassMembershipDetailRow, ClassMonthDetailRow, ClassMonthScheduleDetailRow, ClassMonthScheduleStaffDetailRow, ClassMonthStaffDetailRow, ClassMonthStudentDetailRow, ClassStudentHistoryRow, ReportFilters, ReportType } from '@/shared/types/domain'

async function unwrap<T>(request: PromiseLike<{ data: T | null; error: Error | null }>): Promise<T> {
  const { data, error } = await request
  if (error) throw error
  return data as T
}

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

export function getStudents(search = '') {
  let query = supabase.from('students').select('*').order('full_name')
  if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,student_code.ilike.%${search.trim()}%`)
  return unwrap(query)
}

export function getStaff(search = '') {
  let query = supabase.from('staff').select('*').order('full_name')
  if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,staff_code.ilike.%${search.trim()}%`)
  return unwrap(query)
}

export function getClasses() {
  return unwrap(supabase.from('classes').select('*,subjects(name),grades(name)').order('name'))
}

export async function getClassDetail(classId: string): Promise<ClassDetailRow | null> {
  const row = await unwrap<any>(supabase.from('classes').select('id,code,name,subject_id,grade_id,max_students,capacity_policy,status,subjects(name),grades(name)').eq('id', classId).maybeSingle())
  return row ? { ...row, subjects: oneRelation(row.subjects), grades: oneRelation(row.grades) } as ClassDetailRow : null
}

export async function getClassMonthsForClass(classId: string): Promise<ClassMonthDetailRow[]> {
  const rows = await unwrap<any[]>(supabase.from('class_months').select('id,class_id,year,month,status,classes(code,name)').eq('class_id', classId).order('year', { ascending: false }).order('month', { ascending: false }))
  return rows.map((row) => ({ ...row, classes: oneRelation(row.classes) }) as ClassMonthDetailRow)
}

export async function getClassActiveMemberships(classId: string): Promise<ClassMembershipDetailRow[]> {
  const rows = await unwrap<any[]>(supabase.from('class_memberships').select('id,class_id,student_id,start_date,end_date,status,students(id,student_code,full_name,phone,email,address,parent_name,parent_phone,status)').eq('class_id', classId).eq('status', 'ACTIVE').order('created_at'))
  return rows.map((row) => ({ ...row, students: oneRelation(row.students) }) as ClassMembershipDetailRow)
}

export async function getClassStudentMembership(classId: string, studentId: string): Promise<ClassMembershipDetailRow | null> {
  const row = await unwrap<any>(supabase.from('class_memberships').select('id,class_id,student_id,start_date,end_date,status,students(id,student_code,full_name,phone,email,address,parent_name,parent_phone,status)').eq('class_id', classId).eq('student_id', studentId).maybeSingle())
  return row ? { ...row, students: oneRelation(row.students) } as ClassMembershipDetailRow : null
}

export async function getClassMonthStudents(classMonthId: string): Promise<ClassMonthStudentDetailRow[]> {
  const rows = await unwrap<any[]>(supabase.from('class_month_students').select('id,class_month_id,student_id,membership_start_date,membership_end_date,students(id,student_code,full_name,phone,email,address,parent_name,parent_phone,status)').eq('class_month_id', classMonthId).order('created_at'))
  return rows.map((row) => ({ ...row, students: oneRelation(row.students) }) as ClassMonthStudentDetailRow)
}

export async function getClassMonthStaff(classMonthId: string): Promise<ClassMonthStaffDetailRow[]> {
  const rows = await unwrap<any[]>(supabase.from('class_month_staff').select('id,class_month_id,staff_id,assignment_role,staff(id,staff_code,full_name,staff_type,status)').eq('class_month_id', classMonthId).order('assignment_role').order('created_at'))
  return rows.map((row) => ({ ...row, staff: oneRelation(row.staff) }) as ClassMonthStaffDetailRow)
}

export async function getClassMonthScheduleDetails(classMonthId: string): Promise<ClassMonthScheduleDetailRow[]> {
  return unwrap<ClassMonthScheduleDetailRow[]>(supabase.from('class_month_schedules').select('id,class_month_id,day_of_week,start_time,end_time,room,status').eq('class_month_id', classMonthId).order('day_of_week').order('start_time'))
}

export async function getClassMonthScheduleStaffDetails(classMonthId: string): Promise<ClassMonthScheduleStaffDetailRow[]> {
  const rows = await unwrap<any[]>(supabase.from('class_month_schedule_staff').select('schedule_id,staff_id,assignment_role,staff(id,staff_code,full_name),class_month_schedules!inner(class_month_id)').eq('class_month_schedules.class_month_id', classMonthId))
  return rows.map((row) => ({ ...row, staff: oneRelation(row.staff) }) as ClassMonthScheduleStaffDetailRow)
}

export async function getClassStudentHistory(classId: string, studentId: string): Promise<ClassStudentHistoryRow[]> {
  const sessions = await unwrap<any[]>(supabase.from('sessions').select('id,class_month_id,schedule_id,scheduled_start_at,scheduled_end_at,status,session_note,class_months!inner(year,month,classes(code,name),class_id)').eq('class_months.class_id', classId).order('scheduled_start_at', { ascending: false }))
  if (!sessions.length) return []
  const sessionIds = sessions.map((row) => row.id)
  const [sessionStudents, attendances] = await Promise.all([
    unwrap<Array<{ session_id: string; assessment_snapshot: Record<string, unknown> | null }>>(supabase.from('session_students').select('session_id,assessment_snapshot').eq('student_id', studentId).in('session_id', sessionIds)),
    unwrap<Array<{ id: string; session_id: string; status: string; late_minutes: number | null; absence_reason: string | null; homework_score: number | null; homework_note: string | null; understanding_score: number | null; attitude_score: number | null; positive_feedback_count: number | null; positive_feedback_raw: string | null; comment: string | null; updated_at: string }>>(supabase.from('student_attendances').select('id,session_id,status,late_minutes,absence_reason,homework_score,homework_note,understanding_score,attitude_score,positive_feedback_count,positive_feedback_raw,comment,updated_at').eq('student_id', studentId).in('session_id', sessionIds)),
  ])
  const enrolledSessionIds = new Set(sessionStudents.map((row) => row.session_id))
  const snapshotBySession = new Map(sessionStudents.map((row) => [row.session_id, row.assessment_snapshot]))
  const attendanceBySession = new Map(attendances.map((row) => [row.session_id, row]))
  return sessions.filter((row) => enrolledSessionIds.has(row.id)).map((row) => {
    const classMonth = oneRelation(row.class_months)
    return {
      id: row.id,
      class_month_id: row.class_month_id,
      schedule_id: row.schedule_id,
      scheduled_start_at: row.scheduled_start_at,
      scheduled_end_at: row.scheduled_end_at,
      status: row.status,
      session_note: row.session_note || null,
      class_months: classMonth ? { ...classMonth, classes: oneRelation(classMonth.classes) } : null,
      attendance: attendanceBySession.has(row.id) ? attendanceBySession.get(row.id)! as ClassStudentHistoryRow['attendance'] : null,
      assessment_snapshot: snapshotBySession.get(row.id) || null,
    }
  })
}

export function getSubjects() {
  return unwrap(supabase.from('subjects').select('id,code,name').eq('status', 'ACTIVE').order('name'))
}

export function getGrades() {
  return unwrap(supabase.from('grades').select('id,code,name').eq('status', 'ACTIVE').order('code'))
}

export function getClassMonths() {
  return unwrap(supabase.from('class_months').select('*,classes(name,code)').order('year', { ascending: false }).order('month', { ascending: false }))
}

export function getClassMonthSchedules(classMonthId: string) {
  return unwrap(supabase.from('class_month_schedules').select('id,class_month_id,day_of_week,start_time,end_time,room,status').eq('class_month_id', classMonthId).order('day_of_week').order('start_time'))
}

export function getClassMonthScheduleStaff(classMonthId: string) {
  return unwrap(supabase.from('class_month_schedule_staff').select('schedule_id,staff_id,assignment_role,staff(id,staff_code,full_name),class_month_schedules!inner(class_month_id)').eq('class_month_schedules.class_month_id', classMonthId))
}

export function getMySessions() {
  return unwrap(supabase.from('sessions').select('*,class_months(classes(name,code)),class_month_schedules(room),session_students(student_id,students(id,student_code,full_name))').order('scheduled_start_at', { ascending: false }))
}

export async function getMyStaff() {
  const { data: sessionData, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!sessionData.session?.user) return null
  return unwrap(supabase.from('staff').select('id,staff_type,full_name').eq('user_id', sessionData.session.user.id).maybeSingle())
}

export function getSessionStudents(sessionId: string) {
  return unwrap(supabase.from('session_students').select('id,student_id,assessment_snapshot,students(student_code,full_name),student_attendances(id,status,late_minutes,absence_reason,homework_score,homework_note,understanding_score,attitude_score,positive_feedback_count,positive_feedback_raw,comment,updated_at)').eq('session_id', sessionId).order('created_at'))
}

export function getSessionStaff(sessionId: string) {
  return unwrap(supabase.from('session_staff').select('id,staff_id,assignment_role,is_replacement,original_staff_id,staff(id,staff_code,full_name)').eq('session_id', sessionId))
}

export async function getDashboardSummary() {
  const [students, classes, sessions, attendance, pendingTimesheets] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('classes').select('id', { count: 'exact', head: true }),
    supabase.from('sessions').select('id,status', { count: 'exact' }),
    supabase.from('student_attendances').select('status,comment'),
    supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
  ])
  const errors = [students.error, classes.error, sessions.error, attendance.error, pendingTimesheets.error].filter(Boolean)
  if (errors.length) throw errors[0]
  const sessionRows = sessions.data || []
  const attendanceRows = attendance.data || []
  const markedRows = attendanceRows.filter((row: any) => row.status)
  return {
    students: students.count || 0,
    classes: classes.count || 0,
    completedSessions: sessionRows.filter((row: any) => row.status === 'COMPLETED').length,
    upcomingSessions: sessionRows.filter((row: any) => row.status === 'SCHEDULED').length,
    attendanceRate: markedRows.length ? Math.round((markedRows.filter((row: any) => row.status === 'PRESENT' || row.status === 'LATE').length / markedRows.length) * 100) : 0,
    commentCoverage: markedRows.length ? Math.round((markedRows.filter((row: any) => String(row.comment || '').trim()).length / markedRows.length) * 100) : 0,
    pendingTimesheets: pendingTimesheets.count || 0,
  }
}

export function getNotifications() {
  return unwrap(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50))
}

export function getMyAttendance() {
  return unwrap(supabase.from('student_attendances').select('id,status,late_minutes,absence_reason,homework_score,homework_note,understanding_score,attitude_score,positive_feedback_count,positive_feedback_raw,comment,updated_at,sessions(id,scheduled_start_at,status,session_note,class_months(classes(name,code))),students(id,student_code,full_name)').order('updated_at', { ascending: false }))
}

export function getTimesheets() {
  return unwrap(supabase.from('timesheets').select('*,staff(id,staff_code,full_name),sessions(id,scheduled_start_at,status,class_months(year,month,classes(name,code)))').order('submitted_at', { ascending: false }))
}

export function getAuditLogs(limit = 200) {
  return unwrap(supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit))
}

export function getAdminProfiles() {
  return unwrap(supabase.from('profiles').select('id,user_id,username,display_name,role,status').eq('role', 'ADMIN').order('display_name'))
}

export function getPermissionGroups() {
  return unwrap(supabase.from('permission_groups').select('id,code,name').order('code'))
}

export function getAdminPermissionGroupIds(userId: string) {
  return unwrap(supabase.from('admin_permission_groups').select('permission_group_id').eq('user_id', userId))
}

export async function getParentStudents() {
  const rows = await unwrap<any[]>(supabase.from('parent_students').select('student_id,students(id,student_code,full_name)').eq('status', 'ACTIVE').order('created_at'))
  return rows.map((row) => ({ ...row, students: oneRelation(row.students) }))
}

export async function getReports(type: ReportType, filters: ReportFilters) {
  const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
  const endDate = new Date(filters.year, filters.month, 0).getDate()
  const end = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`
  if (type === 'STUDENTS') return getStudents()
  if (type === 'ATTENDANCE' || type === 'HOMEWORK') {
    let query = supabase.from('student_attendances').select('*,students(student_code,full_name),sessions(scheduled_start_at,status,class_months(year,month,classes(name,code)))').gte('updated_at', `${start}T00:00:00+07:00`).lte('updated_at', `${end}T23:59:59+07:00`).order('updated_at', { ascending: false })
    if (filters.student_id) query = query.eq('student_id', filters.student_id)
    return unwrap(query)
  }
  const [sessions, attendance, timesheets] = await Promise.all([
    supabase.from('sessions').select('id,status,scheduled_start_at,session_note,class_months(year,month,classes(name,code))').gte('scheduled_start_at', `${start}T00:00:00+07:00`).lte('scheduled_start_at', `${end}T23:59:59+07:00`),
    supabase.from('student_attendances').select('status,homework_score,comment,student_id,students(student_code,full_name),sessions(scheduled_start_at,class_months(classes(name,code)))').gte('updated_at', `${start}T00:00:00+07:00`).lte('updated_at', `${end}T23:59:59+07:00`),
    supabase.from('timesheets').select('status,submitted_at,staff(staff_code,full_name),sessions(scheduled_start_at,class_months(classes(name,code)))').gte('submitted_at', `${start}T00:00:00+07:00`).lte('submitted_at', `${end}T23:59:59+07:00`),
  ])
  const errors = [sessions.error, attendance.error, timesheets.error].filter(Boolean)
  if (errors.length) throw errors[0]
  return { sessions: sessions.data || [], attendance: attendance.data || [], timesheets: timesheets.data || [] }
}
