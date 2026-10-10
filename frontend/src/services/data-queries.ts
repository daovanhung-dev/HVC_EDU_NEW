import { supabase } from './supabase'
import type { AttendanceHistoryRow, ClassDetailRow, ClassMembershipDetailRow, ClassScheduleRow, SessionRow, StudentCurrentClass, StudentCurrentClassSummary, StudentHistoryRow, TimesheetRow } from '@/shared/types/domain'

async function unwrap<T>(request: PromiseLike<{ data: T | null; error: Error | null }>): Promise<T> {
  const { data, error } = await request
  if (error) throw error
  return data as T
}

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function todayInVietnam(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

function isEffectiveMembership(row: any, today: string): boolean {
  return row.status === 'ACTIVE' && typeof row.start_date === 'string' && row.start_date <= today &&
    (!row.end_date || row.end_date >= today)
}

async function getCurrentMembershipRows(studentIds: string[], columns: string[], today: string): Promise<any[]> {
  const uniqueStudentIds = [...new Set(studentIds)].filter(Boolean)
  const pages: any[][] = []
  for (let offset = 0; offset < uniqueStudentIds.length; offset += 200) {
    const studentIdPage = uniqueStudentIds.slice(offset, offset + 200)
    const rows = await unwrap<any[]>(supabase.from('class_memberships')
      .select(columns.join(','))
      .in('student_id', studentIdPage)
      .eq('status', 'ACTIVE')
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('start_date')
      .order('created_at'))
    pages.push(rows.filter((row) => studentIdPage.includes(row.student_id) && isEffectiveMembership(row, today)))
  }
  return pages.flat()
}

export function getStudents(search = '') {
  let query = supabase.from('students').select('*').order('full_name')
  if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,student_code.ilike.%${search.trim()}%`)
  return unwrap(query)
}

export async function getStudentIntakeDuplicateIdentities() {
  const pageSize = 1000
  const students: Array<{ id: string; student_code: string | null; full_name: string; phone: string | null }> = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await unwrap<Array<{ id: string; student_code: string | null; full_name: string; phone: string | null }>>(
      supabase.from('students').select('id,student_code,full_name,phone').order('id').range(offset, offset + pageSize - 1),
    )
    students.push(...page)
    if (page.length < pageSize) return students
  }
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

export async function getClassMembershipsForSessionDate(classId: string, sessionDate: string): Promise<ClassMembershipDetailRow[]> {
  const rows = await unwrap<any[]>(supabase.from('class_memberships')
    .select('id,class_id,student_id,start_date,end_date,status,students(id,student_code,full_name,status)')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE')
    .lte('start_date', sessionDate)
    .or(`end_date.is.null,end_date.gte.${sessionDate}`)
    .order('start_date')
    .order('created_at'))

  const studentsById = new Map<string, ClassMembershipDetailRow>()
  for (const row of rows) {
    const student = oneRelation<any>(row.students)
    if (!student || student.status !== 'ACTIVE' || row.start_date > sessionDate || (row.end_date && row.end_date < sessionDate)) continue
    if (!studentsById.has(student.id)) {
      studentsById.set(student.id, {
        ...row,
        students: { id: student.id, student_code: student.student_code, full_name: student.full_name, status: student.status },
      } as ClassMembershipDetailRow)
    }
  }
  return [...studentsById.values()].sort((a, b) => (a.students?.full_name || '').localeCompare(b.students?.full_name || '', 'vi'))
}

export interface ClassRosterExportStudent {
  id: string
  student_code: string | null
  full_name: string
  phone: string | null
  parent_name: string | null
  status: string
  created_at: string | null
}

export async function getClassRosterForExport(classId: string): Promise<ClassRosterExportStudent[]> {
  const today = todayInVietnam()
  const rows = await unwrap<any[]>(supabase.from('class_memberships')
    .select('class_id,student_id,start_date,end_date,status,students(id,student_code,full_name,phone,parent_name,status,created_at)')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE')
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date')
    .order('created_at'))

  const studentsById = new Map<string, ClassRosterExportStudent>()
  for (const row of rows) {
    if (row.class_id !== classId || row.status !== 'ACTIVE' || row.start_date > today || (row.end_date && row.end_date < today)) continue
    const student = oneRelation<any>(row.students)
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

  return [...studentsById.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
}

export async function getStudentsCurrentClassSummaries(studentIds: string[]): Promise<Record<string, StudentCurrentClassSummary[]>> {
  const today = todayInVietnam()
  const studentIdsUnique = [...new Set(studentIds)].filter(Boolean)
  const result: Record<string, StudentCurrentClassSummary[]> = Object.fromEntries(studentIdsUnique.map((id) => [id, []]))
  if (!studentIdsUnique.length) return result

  const rows = await getCurrentMembershipRows(studentIdsUnique, [
    'student_id',
    'class_id',
    'start_date',
    'end_date',
    'status',
    'classes(id,code,name)',
  ], today)
  const classesByStudent = new Map<string, Map<string, StudentCurrentClassSummary>>()
  for (const row of rows) {
    const classRow = oneRelation<any>(row.classes)
    if (!classRow || !studentIdsUnique.includes(row.student_id)) continue
    const classesById = classesByStudent.get(row.student_id) || new Map<string, StudentCurrentClassSummary>()
    classesById.set(classRow.id, { id: classRow.id, code: classRow.code, name: classRow.name })
    classesByStudent.set(row.student_id, classesById)
  }

  for (const [studentId, classesById] of classesByStudent) {
    result[studentId] = [...classesById.values()].sort((left, right) =>
      left.code.localeCompare(right.code, 'vi') || left.name.localeCompare(right.name, 'vi'))
  }
  return result
}

export async function getStudentCurrentClasses(studentId: string): Promise<StudentCurrentClass[]> {
  const today = todayInVietnam()
  const rows = await getCurrentMembershipRows([studentId], [
    'id',
    'student_id',
    'class_id',
    'start_date',
    'end_date',
    'status',
    'classes(id,code,name,status,subjects(name),grades(name))',
  ], today)

  const membershipsByClass = new Map<string, { membership_id: string; start_date: string; classRow: any }>()
  for (const row of rows) {
    const classRow = oneRelation<any>(row.classes)
    if (!classRow) continue
    const current = membershipsByClass.get(classRow.id)
    if (!current || row.start_date >= current.start_date) {
      membershipsByClass.set(classRow.id, { membership_id: row.id, start_date: row.start_date, classRow })
    }
  }

  const memberships = [...membershipsByClass.values()]
  if (!memberships.length) return []

  const classIds = memberships.map(({ classRow }) => classRow.id)
  const scheduleRows = await unwrap<any[]>(supabase.from('class_schedules')
    .select('id,class_id,day_of_week,start_time,end_time,room,status,reviewed_at,class_schedule_staff(staff_id,staff(id,staff_code,full_name))')
    .in('class_id', classIds)
    .eq('status', 'ACTIVE')
    .order('day_of_week')
    .order('start_time'))
  const schedulesByClass = new Map<string, ClassScheduleRow[]>()
  for (const row of scheduleRows) {
    if (row.status !== 'ACTIVE' || !classIds.includes(row.class_id)) continue
    const schedule: ClassScheduleRow = {
      ...row,
      class_schedule_staff: (row.class_schedule_staff || []).map((assignment: any) => ({
        ...assignment,
        staff: oneRelation(assignment.staff),
      })),
    }
    schedulesByClass.set(row.class_id, [...(schedulesByClass.get(row.class_id) || []), schedule])
  }

  return memberships.map(({ membership_id, start_date, classRow }) => ({
    id: classRow.id,
    code: classRow.code,
    name: classRow.name,
    membership_id,
    start_date,
    status: classRow.status,
    subject_name: oneRelation<any>(classRow.subjects)?.name || null,
    grade_name: oneRelation<any>(classRow.grades)?.name || null,
    schedules: schedulesByClass.get(classRow.id) || [],
  })).sort((left, right) => left.code.localeCompare(right.code, 'vi') || left.name.localeCompare(right.name, 'vi'))
}

export async function getClassActiveRosterSize(classId: string): Promise<number> {
  const today = todayInVietnam()
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
