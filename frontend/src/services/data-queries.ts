import { supabase } from './supabase'
import type { AttendanceHistoryRow, ClassDetailRow, ClassMembershipDetailRow, ClassScheduleRow, SessionRow, StudentHistoryRow, TimesheetRow } from '@/shared/types/domain'

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

export function getStudent(studentId: string) {
  return unwrap(supabase.from('students').select('*').eq('id', studentId).maybeSingle())
}

export function getStaff(search = '') {
  let query = supabase.from('staff').select('*').eq('staff_type', 'TEACHER').order('full_name')
  if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,staff_code.ilike.%${search.trim()}%`)
  return unwrap(query)
}

export function getClasses() {
  return unwrap(supabase.from('classes').select('id,code,name,subject_id,grade_id,max_students,capacity_policy,status,subjects(name),grades(name)').order('name'))
}

export function getSubjects() {
  return unwrap(supabase.from('subjects').select('id,code,name,status').order('name'))
}

export function getGrades() {
  return unwrap(supabase.from('grades').select('id,code,name,status').order('name'))
}

export async function getClassDetail(classId: string): Promise<ClassDetailRow | null> {
  const row = await unwrap<any>(supabase.from('classes').select('id,code,name,subject_id,grade_id,max_students,capacity_policy,status,subjects(name),grades(name)').eq('id', classId).maybeSingle())
  return row ? { ...row, subjects: oneRelation(row.subjects), grades: oneRelation(row.grades) } as ClassDetailRow : null
}

export async function getClassActiveMemberships(classId: string): Promise<ClassMembershipDetailRow[]> {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const rows = await unwrap<any[]>(supabase.from('class_memberships').select('id,class_id,student_id,start_date,end_date,status,students(id,student_code,full_name,phone,email,address,parent_name,parent_phone,status)').eq('class_id', classId).eq('status', 'ACTIVE').or(`end_date.is.null,end_date.gte.${today}`).order('start_date').order('created_at'))
  return rows.map((row) => ({ ...row, students: oneRelation(row.students) }) as ClassMembershipDetailRow)
}

export async function getClassActiveRosterSize(classId: string): Promise<number> {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const rows = await unwrap<Array<{ id: string }>>(supabase.from('class_memberships').select('id').eq('class_id', classId).eq('status', 'ACTIVE').lte('start_date', today).or(`end_date.is.null,end_date.gte.${today}`).limit(1))
  return rows.length
}

export async function getClassSchedules(classId: string): Promise<ClassScheduleRow[]> {
  const rows = await unwrap<any[]>(supabase.from('class_schedules').select('id,class_id,day_of_week,start_time,end_time,room,status,reviewed_at,class_schedule_staff(staff_id,staff(id,staff_code,full_name))').eq('class_id', classId).order('day_of_week').order('start_time'))
  return rows.map((row) => ({ ...row, class_schedule_staff: (row.class_schedule_staff || []).map((item: any) => ({ ...item, staff: oneRelation(item.staff) })) })) as ClassScheduleRow[]
}

export function getMySessions() {
  return unwrap<SessionRow[]>(supabase.from('sessions').select('id,class_id,recurrence_schedule_id,recurrence_occurrence_date,scheduled_start_at,scheduled_end_at,status,session_note,lesson_youtube_url,room,schedule_override,classes(id,name,subjects(name),grades(name)),class_schedules(room),session_students(student_id,students(id,student_code,full_name)),session_staff(staff_id,assignment_role,staff!session_staff_staff_id_fkey(id,staff_code,full_name))').order('scheduled_start_at', { ascending: false }))
}

async function loadTimesheets(): Promise<TimesheetRow[]> {
  const rows = await unwrap<any[]>(supabase.from('timesheets')
    .select('id,session_id,staff_id,status,submitted_at,approved_at,approved_by,rejection_reason,notes,sessions(id,scheduled_start_at,scheduled_end_at,status,classes(name)),staff(id,staff_code,full_name)')
    .order('submitted_at', { ascending: false }))
  return rows.map((row) => {
    const session = oneRelation(row.sessions)
    return {
      ...row,
      sessions: session ? { ...session, classes: oneRelation(session.classes) } : null,
      staff: oneRelation(row.staff),
    } as TimesheetRow
  })
}

export function getMyTimesheets() {
  return loadTimesheets()
}

export function getTimesheets() {
  return loadTimesheets()
}

export async function getMyStaff() {
  const { data: sessionData, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!sessionData.session?.user) return null
  return unwrap(supabase.from('staff').select('id,user_id,staff_type,staff_code,full_name,phone,email,address,status').eq('user_id', sessionData.session.user.id).maybeSingle())
}

export async function getMyStudent() {
  const { data: sessionData, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!sessionData.session?.user) return null
  return unwrap(supabase.from('students').select('id,user_id,student_code,full_name,phone,email,address,parent_name,parent_phone,status').eq('user_id', sessionData.session.user.id).maybeSingle())
}

export function getSessionStudents(sessionId: string) {
  return unwrap(supabase.from('session_students').select('id,student_id,assessment_snapshot,students(student_code,full_name),student_attendances(id,status,late_minutes,absence_reason,homework_score,homework_note,understanding_score,attitude_score,positive_feedback_count,positive_feedback_raw,comment,updated_at)').eq('session_id', sessionId).order('created_at'))
}

export function getMyAttendance(studentId?: string) {
  let query = supabase.from('student_attendances').select('id,student_id,status,late_minutes,absence_reason,homework_score,homework_note,understanding_score,attitude_score,positive_feedback_count,positive_feedback_raw,comment,updated_at,students(id,student_code,full_name),sessions(id,class_id,scheduled_start_at,scheduled_end_at,status,session_note,classes(code,name),session_staff(staff_id,staff!session_staff_staff_id_fkey(id,full_name)))').order('updated_at', { ascending: false })
  if (studentId) query = query.eq('student_id', studentId)
  return unwrap<AttendanceHistoryRow[]>(query)
}

export async function getStudentHistory(studentId: string): Promise<StudentHistoryRow[]> {
  const sessions = await unwrap<any[]>(supabase.from('sessions').select('id,class_id,scheduled_start_at,scheduled_end_at,status,session_note,classes(code,name),session_students!inner(student_id),session_staff(staff!session_staff_staff_id_fkey(full_name))').eq('session_students.student_id', studentId).order('scheduled_start_at', { ascending: false }))
  if (!sessions.length) return []
  const attendances = await getMyAttendance(studentId)
  const attendanceBySession = new Map(attendances.map((row) => [row.sessions?.id, row]))
  return sessions.map((row) => ({
    id: row.id,
    class_id: row.class_id,
    scheduled_start_at: row.scheduled_start_at,
    scheduled_end_at: row.scheduled_end_at,
    status: row.status,
    session_note: row.session_note,
    classes: oneRelation(row.classes),
    attendance: attendanceBySession.get(row.id) || null,
    teachers: (row.session_staff || []).map((item: any) => oneRelation(item.staff)?.full_name).filter(Boolean),
  }))
}
