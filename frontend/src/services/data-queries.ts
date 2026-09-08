import { supabase } from './supabase'
import type { ReportFilters, ReportType } from '@/shared/types/domain'

async function unwrap<T>(request: PromiseLike<{ data: T | null; error: Error | null }>): Promise<T> {
  const { data, error } = await request
  if (error) throw error
  return data as T
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

export function getSubjects() {
  return unwrap(supabase.from('subjects').select('id,code,name').eq('status', 'ACTIVE').order('name'))
}

export function getGrades() {
  return unwrap(supabase.from('grades').select('id,code,name').eq('status', 'ACTIVE').order('code'))
}

export function getClassMonths() {
  return unwrap(supabase.from('class_months').select('*,classes(name,code)').order('year', { ascending: false }).order('month', { ascending: false }))
}

export function getMySessions() {
  return unwrap(supabase.from('sessions').select('*,class_months(classes(name,code))').order('scheduled_start_at', { ascending: false }))
}

export async function getMyStaff() {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return null
  return unwrap(supabase.from('staff').select('id,staff_type,full_name').eq('user_id', sessionData.session.user.id).maybeSingle())
}

export function getSessionStudents(sessionId: string) {
  return unwrap(supabase.from('session_students').select('id,student_id,students(student_code,full_name),student_attendances(id,status,late_minutes,absence_reason,homework_score,comment)').eq('session_id', sessionId).order('created_at'))
}

export function getSessionStaff(sessionId: string) {
  return unwrap(supabase.from('session_staff').select('id,staff_id,assignment_role,is_replacement,original_staff_id,staff(id,staff_code,full_name)').eq('session_id', sessionId))
}

export function getMyTuition() {
  return unwrap(supabase.from('tuition_records').select('*,class_months(classes(name,code),year,month)').order('created_at', { ascending: false }))
}

export function getTuitionRecords() {
  return unwrap(supabase.from('tuition_records').select('*,students(student_code,full_name),class_months(classes(name,code),year,month)').order('created_at', { ascending: false }))
}

export async function getDashboardSummary() {
  const [students, classes, sessions, tuition, pendingTimesheets] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('classes').select('id', { count: 'exact', head: true }),
    supabase.from('sessions').select('id,status', { count: 'exact' }),
    supabase.from('tuition_records').select('amount_due,amount_paid,status'),
    supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
  ])
  const errors = [students.error, classes.error, sessions.error, tuition.error].filter(Boolean)
  if (errors.length) throw errors[0]
  const sessionRows = sessions.data || []
  const tuitionRows = tuition.data || []
  return {
    students: students.count || 0,
    classes: classes.count || 0,
    completedSessions: sessionRows.filter((row: any) => row.status === 'COMPLETED').length,
    upcomingSessions: sessionRows.filter((row: any) => row.status === 'SCHEDULED').length,
    tuitionDue: tuitionRows.reduce((sum: number, row: any) => sum + Number(row.amount_due || 0), 0),
    tuitionPaid: tuitionRows.filter((row: any) => row.status === 'PAID').reduce((sum: number, row: any) => sum + Number(row.amount_paid || 0), 0),
    pendingTimesheets: pendingTimesheets.count || 0,
  }
}

export function getNotifications() {
  return unwrap(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50))
}

export function getMyAttendance() {
  return unwrap(supabase.from('student_attendances').select('id,status,late_minutes,absence_reason,homework_score,comment,updated_at,sessions(id,scheduled_start_at,status,class_months(classes(name,code))),students(student_code,full_name)').order('updated_at', { ascending: false }))
}

export function getTimesheets() {
  return unwrap(supabase.from('timesheets').select('*,staff(id,staff_code,full_name),sessions(id,scheduled_start_at,status,revenue_snapshot,class_months(year,month,classes(name,code)))').order('submitted_at', { ascending: false }))
}

export function getPayroll() {
  return unwrap(supabase.from('payroll_periods').select('*,payroll_items(id,staff_id,session_id,timesheet_id,salary_method,revenue_snapshot,salary_percentage,fixed_amount,base_salary,staff(staff_code,full_name),sessions(scheduled_start_at,class_months(classes(name,code)))),salary_adjustments(id,staff_id,adjustment_type,amount,reason,staff(full_name))').order('year', { ascending: false }).order('month', { ascending: false }))
}

export function getAuditLogs(limit = 200) {
  return unwrap(supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit))
}

export function getAccountingTransactions() {
  return unwrap(supabase.from('accounting_transactions').select('*,accounting_categories(code,name,direction)').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }))
}

export function getAccountingCategories() {
  return unwrap(supabase.from('accounting_categories').select('id,code,name,direction').eq('status', 'ACTIVE').order('direction').order('name'))
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
  if (type === 'TUITION') {
    let query = supabase.from('tuition_records').select('*,students(student_code,full_name),class_months(classes(name,code),year,month)').eq('class_months.year', filters.year).eq('class_months.month', filters.month).order('created_at', { ascending: false })
    if (filters.student_id) query = query.eq('student_id', filters.student_id)
    if (filters.class_id) query = query.eq('class_months.class_id', filters.class_id)
    return unwrap(query)
  }
  if (type === 'PAYROLL') return getPayroll()
  if (type === 'ACCOUNTING') {
    return unwrap(supabase.from('accounting_transactions').select('*,accounting_categories(code,name,direction)').gte('transaction_date', start).lte('transaction_date', end).order('transaction_date', { ascending: false }))
  }
  const [sessions, tuition, accounting, payroll] = await Promise.all([
    supabase.from('sessions').select('id,status,revenue_snapshot,scheduled_start_at,class_months(year,month,classes(name,code))').gte('scheduled_start_at', `${start}T00:00:00+07:00`).lte('scheduled_start_at', `${end}T23:59:59+07:00`),
    supabase.from('tuition_records').select('amount_due,amount_paid,status,class_months(year,month)').eq('class_months.year', filters.year).eq('class_months.month', filters.month),
    supabase.from('accounting_transactions').select('amount,direction,transaction_type,transaction_date').gte('transaction_date', start).lte('transaction_date', end),
    supabase.from('payroll_periods').select('id,status,year,month,payroll_items(base_salary)').eq('year', filters.year).eq('month', filters.month).maybeSingle(),
  ])
  const errors = [sessions.error, tuition.error, accounting.error, payroll.error].filter(Boolean)
  if (errors.length) throw errors[0]
  return { sessions: sessions.data || [], tuition: tuition.data || [], accounting: accounting.data || [], payroll: payroll.data || null }
}
