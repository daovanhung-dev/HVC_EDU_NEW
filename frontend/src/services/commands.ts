import { invokeFunction } from './edge-functions'
import { supabase } from './supabase'
import type { FileExport, ReportFilters, ReportFormat, ReportType } from '@/shared/types/domain'

export interface CreateUserInput {
  role: 'ADMIN' | 'TEACHER' | 'ASSISTANT' | 'STUDENT' | 'PARENT'
  username?: string
  email?: string
  phone?: string
  display_name?: string
  student?: { student_code?: string; full_name?: string; parent_name?: string; parent_phone?: string }
  staff?: { staff_code?: string; full_name?: string }
  parent?: { student_ids: string[] }
}

export function adminCreateUser(input: CreateUserInput) {
  return invokeFunction<CreateUserInput, { profile: unknown; temporary_password: string }>('admin-create-user', input)
}

export function adminResetPassword(user_id: string) {
  return invokeFunction<{ user_id: string }, { profile: unknown; temporary_password: string }>('admin-reset-password', { user_id })
}

export function activateClassMonth(class_month_id: string, override_conflicts = false) {
  return invokeFunction<{ class_month_id: string; override_conflicts: boolean }, unknown>('class-month-activate', { class_month_id, override_conflicts })
}

export function copyClassMonth(source_class_month_id: string, year: number, month: number) {
  return invokeFunction<{ source_class_month_id: string; year: number; month: number }, { class_month_id: string; status: string }>('class-month-copy', { source_class_month_id, year, month })
}

export function completeSession(session_id: string) {
  return invokeFunction<{ session_id: string }, unknown>('session-complete', { session_id })
}

export function startSession(session_id: string) {
  return invokeFunction<{ session_id: string }, unknown>('session-start', { session_id })
}

export function reopenSession(session_id: string, reason: string) {
  return invokeFunction<{ session_id: string; reason: string }, unknown>('session-reopen', { session_id, reason })
}

export function replaceSessionStaff(session_id: string, original_staff_id: string, replacement_staff_id: string, reason: string) {
  return invokeFunction<{ session_id: string; original_staff_id: string; replacement_staff_id: string; reason: string }, unknown>('session-replace-staff', { session_id, original_staff_id, replacement_staff_id, reason })
}

export function submitTimesheet(session_id: string, staff_id: string, notes?: string) {
  return invokeFunction<{ session_id: string; staff_id: string; notes?: string }, unknown>('timesheet-submit', { session_id, staff_id, notes })
}

export function approveTimesheet(timesheet_id: string, approve: boolean, reason?: string) {
  return invokeFunction<{ timesheet_id: string; approve: boolean; reason?: string }, unknown>('timesheet-approve', { timesheet_id, approve, reason })
}

export function updateSessionLearning(input: {
  session_id: string
  session_note?: string | null
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

export function setAccountStatus(user_id: string, status: 'ACTIVE' | 'INACTIVE' | 'LOCKED') {
  return invokeFunction<{ user_id: string; status: string }, unknown>('admin-account-status', { user_id, status })
}

export function setAdminPermissionGroups(user_id: string, permission_group_ids: string[]) {
  return invokeFunction<{ user_id: string; permission_group_ids: string[] }, unknown>('admin-permissions', { user_id, permission_group_ids })
}

export function exportReport(type: ReportType, format: ReportFormat, filters: ReportFilters) {
  return invokeFunction<{ type: ReportType; format: ReportFormat; filters: ReportFilters }, FileExport>('report-export', { type, format, filters })
}

export async function createClass(input: { code: string; name: string; subject_id: string; grade_id: string; max_students?: number | null; capacity_policy?: 'WARNING' | 'BLOCK' | 'UNLIMITED' }) {
  const { data, error } = await supabase.from('classes').insert({ ...input, default_monthly_fee: 0, default_session_fee: 0 }).select('*').single()
  if (error) throw error
  return data
}

export async function updateClass(id: string, input: { code: string; name: string; subject_id: string; grade_id: string; max_students?: number | null; capacity_policy?: 'WARNING' | 'BLOCK' | 'UNLIMITED' }) {
  const { data, error } = await supabase.from('classes').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function archiveClass(id: string) {
  const { data, error } = await supabase.from('classes').update({ status: 'ARCHIVED' }).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function updateStaff(id: string, input: { staff_code?: string | null; full_name: string; phone?: string | null }) {
  const { data, error } = await supabase.from('staff').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function archiveStaff(id: string) {
  const { data, error } = await supabase.from('staff').update({ status: 'ARCHIVED' }).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function updateStudent(id: string, input: { student_code: string; full_name: string; phone?: string | null; parent_name?: string | null; parent_phone?: string | null }) {
  const { data, error } = await supabase.from('students').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function archiveStudent(id: string) {
  const { data, error } = await supabase.from('students').update({ status: 'ARCHIVED' }).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function createClassMonth(input: { class_id: string; year: number; month: number; notes?: string }) {
  const { data, error } = await supabase.from('class_months').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function addClassMonthStudent(input: { class_month_id: string; student_id: string; membership_start_date: string; membership_end_date?: string | null }) {
  const { data, error } = await supabase.from('class_month_students').insert({ ...input, monthly_fee_snapshot: 0, session_fee_snapshot: 0 }).select('*').single()
  if (error) throw error
  return data
}

export async function addClassMonthStaff(input: { class_month_id: string; staff_id: string; assignment_role: 'TEACHER' | 'ASSISTANT' }) {
  const { data, error } = await supabase.from('class_month_staff').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function addClassMonthSchedule(input: { class_month_id: string; day_of_week: number; start_time: string; end_time: string; room?: string | null }) {
  const { data, error } = await supabase.from('class_month_schedules').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function addClassMonthScheduleStaff(input: { schedule_id: string; staff_id: string; assignment_role: 'TEACHER' | 'ASSISTANT' }) {
  const { data, error } = await supabase.from('class_month_schedule_staff').insert(input).select('*').single()
  if (error) throw error
  return data
}
