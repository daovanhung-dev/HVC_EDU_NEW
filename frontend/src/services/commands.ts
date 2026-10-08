import { invokeFunction } from './edge-functions'
import { supabase } from './supabase'

export interface CreateUserInput {
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
  username?: string
  email?: string
  password?: string
  phone?: string
  display_name?: string
  student?: { student_code?: string; full_name?: string; parent_name?: string; parent_phone?: string }
  staff?: { staff_code?: string; full_name?: string }
}

export function adminCreateUser(input: CreateUserInput) {
  return invokeFunction<CreateUserInput, { profile: unknown; temporary_password: string }>('admin-create-user', input)
}

export function adminResetPassword(user_id: string) {
  return invokeFunction<{ user_id: string }, { profile: unknown; temporary_password: string }>('admin-reset-password', { user_id })
}

export type AdminResetPasswordBulkStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

export interface AdminResetPasswordBulkResult {
  user_id: string
  status: AdminResetPasswordBulkStatus
  password_reset: boolean
  reason_codes: string[]
}

export interface AdminResetPasswordBulkResponse {
  temporary_password: string | null
  results: AdminResetPasswordBulkResult[]
}

export function adminResetPasswordBulk(user_ids: string[]) {
  return invokeFunction<{ user_ids: string[] }, AdminResetPasswordBulkResponse>('admin-reset-password-bulk', { user_ids })
}

export interface AdminExportStudentLoginsRow {
  student_code: string
  full_name: string
  login_email: string | null
}

export interface AdminExportStudentLoginsResponse {
  rows: AdminExportStudentLoginsRow[]
  missing_email_count: number
  skipped_count: number
}

export function adminExportStudentLogins(user_ids: string[]) {
  return invokeFunction<{ user_ids: string[] }, AdminExportStudentLoginsResponse>(
    'admin-export-student-logins',
    { user_ids },
  )
}

export function changeRequiredPassword(new_password: string) {
  return invokeFunction<{ new_password: string }, { changed: boolean }>('student-required-password-change', { new_password })
}

export function completeSession(session_id: string) {
  return invokeFunction<{ session_id: string }, unknown>('session-complete', { session_id })
}

export function submitTimesheet(input: { session_id: string; notes?: string | null }) {
  return invokeFunction<typeof input, { timesheet_id: string; status: 'PENDING' }>('timesheet-submit', input)
}

export function reviewTimesheet(input: { timesheet_id: string; approve: boolean; reason?: string | null }) {
  return invokeFunction<typeof input, { timesheet_id: string; status: 'APPROVED' | 'REJECTED' }>('timesheet-review', input)
}

export function startSession(session_id: string) {
  return invokeFunction<{ session_id: string }, unknown>('session-start', { session_id })
}

export function updateSessionLearning(input: {
  session_id: string
  session_note?: string | null
  lesson_youtube_url?: string | null
  students: Array<{
    student_id: string
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
    late_minutes?: number | null
    absence_reason?: string | null
    homework_score?: number | null
    homework_note?: string | null
    understanding_score?: number | null
    attitude_score?: number | null
    positive_feedback_count?: number | null
    positive_feedback_raw?: string | null
    comment?: string | null
  }>
}) {
  return invokeFunction<typeof input, { session_id: string; students_updated: number }>('session-learning-update', input)
}

export function askStudentAI(input: {
  question: string
  history: Array<{ role: 'user' | 'model'; text: string }>
  session_id?: string
}) {
  return invokeFunction<typeof input, { answer: string }>('student-ai-tutor', input)
}

export function optimizeTeacherComment(comment: string) {
  return invokeFunction<{ comment: string }, { optimized_comment: string }>(
    'teacher-comment-optimize',
    { comment },
  )
}

export async function setAccountStatus(user_id: string, status: 'ACTIVE' | 'INACTIVE' | 'LOCKED') {
  const result = await invokeFunction<{ user_id: string; status: string }, unknown>('admin-account-status', { user_id, status })
  await generateUpcomingSessions()
  return result
}

export async function createClass(input: { code: string; name: string; subject_id: string; grade_id: string; max_students?: number | null; capacity_policy?: 'WARNING' | 'BLOCK' | 'UNLIMITED' }) {
  const { data, error } = await supabase.from('classes').insert(input).select('id,code,name,subject_id,grade_id,max_students,capacity_policy,status').single()
  if (error) throw error
  return data
}

export async function updateClass(id: string, input: { code: string; name: string; subject_id: string; grade_id: string; max_students?: number | null; capacity_policy?: 'WARNING' | 'BLOCK' | 'UNLIMITED' }) {
  const { data, error } = await supabase.from('classes').update(input).eq('id', id).select('id,code,name,subject_id,grade_id,max_students,capacity_policy,status').single()
  if (error) throw error
  return data
}

export async function archiveClass(id: string) {
  const { data, error } = await supabase.from('classes').update({ status: 'ARCHIVED' }).eq('id', id).select('id,code,name,subject_id,grade_id,max_students,capacity_policy,status').single()
  if (error) throw error
  await generateUpcomingSessions()
  return data
}

export async function updateStaff(id: string, input: { staff_code?: string | null; full_name: string; phone?: string | null; email?: string | null; address?: string | null }) {
  const { data, error } = await supabase.from('staff').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export function updateMyStaffProfile(input: { full_name: string; phone?: string | null; email?: string | null; address?: string | null }) {
  return supabase.rpc('update_my_staff_profile', { p_full_name: input.full_name, p_phone: input.phone || null, p_email: input.email || null, p_address: input.address || null })
    .then(({ data, error }) => { if (error) throw error; return data })
}

export async function archiveStaff(id: string) {
  const { data, error } = await supabase.from('staff').update({ status: 'ARCHIVED' }).eq('id', id).select('*').single()
  if (error) throw error
  await generateUpcomingSessions()
  return data
}

export async function updateStudent(id: string, input: { student_code: string; full_name: string; phone?: string | null; email?: string | null; address?: string | null; parent_name?: string | null; parent_phone?: string | null }) {
  const { data, error } = await supabase.from('students').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function archiveStudent(id: string) {
  const { data, error } = await supabase.from('students').update({ status: 'ARCHIVED' }).eq('id', id).select('*').single()
  if (error) throw error
  await generateUpcomingSessions()
  return data
}

export async function addClassMembership(input: { class_id: string; student_id: string; start_date: string; end_date?: string | null }) {
  const { data, error } = await supabase.from('class_memberships').insert({ ...input, status: 'ACTIVE' }).select('*').single()
  if (error) throw error
  await generateUpcomingSessions()
  return data
}

export async function updateClassMembership(id: string, input: { start_date: string; end_date?: string | null; status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' }) {
  const { data, error } = await supabase.from('class_memberships').update(input).eq('id', id).select('*').single()
  if (error) throw error
  await generateUpcomingSessions()
  return data
}

export async function createClassSchedule(input: { class_id: string; day_of_week: number; start_time: string; end_time: string; room?: string | null; status?: 'ACTIVE' | 'INACTIVE' }) {
  const { data, error } = await supabase.from('class_schedules').insert({ ...input, room: input.room || null, status: input.status || 'INACTIVE' }).select('id,class_id,day_of_week,start_time,end_time,room,status,reviewed_at').single()
  if (error) throw error
  return data
}

export async function updateClassSchedule(id: string, input: { day_of_week: number; start_time: string; end_time: string; room?: string | null }) {
  const { data, error } = await supabase.from('class_schedules').update({ ...input, room: input.room || null }).eq('id', id).select('id,class_id,day_of_week,start_time,end_time,room,status,reviewed_at').single()
  if (error) throw error
  const generation = await generateUpcomingSessions()
  return { ...data, generation }
}

export async function setClassScheduleStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') {
  const { data: authData } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('class_schedules').update({ status, reviewed_at: status === 'ACTIVE' ? new Date().toISOString() : null, reviewed_by: status === 'ACTIVE' ? authData.user?.id || null : null }).eq('id', id).select('id,class_id,day_of_week,start_time,end_time,room,status,reviewed_at').single()
  if (error) throw error
  const generation = await supabase.rpc('generate_upcoming_sessions', { p_days: 30 })
  if (generation.error) throw generation.error
  return { ...data, generation: generation.data }
}

export async function addTeacherToClassSchedule(schedule_id: string, staff_id: string) {
  const { data, error } = await supabase.from('class_schedule_staff').insert({ schedule_id, staff_id }).select('*').single()
  if (error) throw error
  const generation = await generateUpcomingSessions()
  return { ...data, generation }
}

export async function removeTeacherFromClassSchedule(schedule_id: string, staff_id: string) {
  const { error } = await supabase.from('class_schedule_staff').delete().eq('schedule_id', schedule_id).eq('staff_id', staff_id)
  if (error) throw error
  return generateUpcomingSessions()
}

export async function generateUpcomingSessions(): Promise<{ room_conflicts?: number; missing_room_conflicts?: number; [key: string]: unknown }> {
  const { data, error } = await supabase.rpc('generate_upcoming_sessions', { p_days: 30 })
  if (error) throw error
  return data as { room_conflicts?: number; missing_room_conflicts?: number; [key: string]: unknown }
}

export type DeleteSessionsForMonthPreview = {
  month_start: string
  schedule_count: number
  schedule_staff_count: number
  session_count: number
  status_counts: {
    SCHEDULED: number
    IN_PROGRESS: number
    COMPLETED: number
    CANCELLED: number
  }
  session_student_count: number
  assessment_count: number
  session_staff_count: number
  staff_replacement_count: number
  attendance_count: number
  timesheet_count: number
  payroll_item_count: number
}

export type DeleteSessionsForMonthResult = {
  month_start: string
  deleted_sessions: number
  deleted_schedules: number
  deleted_schedule_staff: number
  deleted_status_counts: {
    SCHEDULED: number
    IN_PROGRESS: number
    COMPLETED: number
    CANCELLED: number
  }
  deleted_session_students: number
  deleted_session_staff: number
  deleted_staff_replacements: number
  deleted_attendances: number
  deleted_timesheets: number
  deleted_payroll_items: number
}

export async function previewDeleteSessionsForMonth(monthStart: string): Promise<DeleteSessionsForMonthPreview> {
  const { data, error } = await supabase.rpc('admin_preview_delete_sessions_for_month', { p_month_start: monthStart })
  if (error) throw error
  return data as DeleteSessionsForMonthPreview
}

export async function deleteSessionsForMonth(monthStart: string): Promise<DeleteSessionsForMonthResult> {
  const { data, error } = await supabase.rpc('admin_delete_sessions_for_month', { p_month_start: monthStart })
  if (error) throw error
  return data as DeleteSessionsForMonthResult
}

export async function updateSessionOccurrence(input: { session_id: string; start?: string; end?: string; cancel?: boolean; room?: string | null }) {
  const { data, error } = await supabase.rpc('admin_update_session_occurrence', {
    p_session_id: input.session_id,
    p_scheduled_start_at: input.start || null,
    p_scheduled_end_at: input.end || null,
    p_cancel: input.cancel || false,
    p_room: input.room || null,
  })
  if (error) throw error
  return data
}

export async function createManualSession(input: {
  class_id: string
  start: string
  end: string
  staff_ids: string[]
  room?: string | null
}) {
  const { data, error } = await supabase.rpc('admin_create_session', {
    p_class_id: input.class_id,
    p_scheduled_start_at: input.start,
    p_scheduled_end_at: input.end,
    p_staff_ids: input.staff_ids,
    p_room: input.room || null,
  })
  if (error) throw error
  return data
}

export async function applyWeekToMonth(input: { source_session_ids: string[]; month_start: string }) {
  const { data, error } = await supabase.rpc('admin_apply_week_to_month', {
    p_source_session_ids: input.source_session_ids,
    p_month_start: input.month_start,
  })
  if (error) throw error
  return data
}

export async function updateSessionTeachers(input: { session_id: string; staff_ids: string[] }) {
  const { data, error } = await supabase.rpc('admin_update_session_teachers', {
    p_session_id: input.session_id,
    p_staff_ids: input.staff_ids,
  })
  if (error) throw error
  return data
}
