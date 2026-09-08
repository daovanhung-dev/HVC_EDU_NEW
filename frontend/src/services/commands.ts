import { invokeFunction } from './edge-functions'
import { supabase } from './supabase'
import type { FileExport, ReportFilters, ReportFormat, ReportType } from '@/shared/types/domain'

export interface CreateUserInput {
  role: 'ADMIN' | 'TEACHER' | 'ASSISTANT' | 'STUDENT'
  username?: string
  email?: string
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

export function activateClassMonth(class_month_id: string, override_conflicts = false) {
  return invokeFunction<{ class_month_id: string; override_conflicts: boolean }, unknown>('class-month-activate', { class_month_id, override_conflicts })
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

export function calculatePayroll(payroll_period_id: string, salary_method: 'PERCENTAGE' | 'FIXED', percentage?: number, fixed_amount?: number) {
  return invokeFunction<{ payroll_period_id: string; salary_method: string; percentage?: number; fixed_amount?: number }, unknown>('payroll-calculate', { payroll_period_id, salary_method, percentage, fixed_amount })
}

export function confirmPayroll(payroll_period_id: string) {
  return invokeFunction<{ payroll_period_id: string }, unknown>('payroll-confirm', { payroll_period_id })
}

export function confirmTuitionPaid(tuition_id: string, payment_method: 'CASH' | 'BANK_TRANSFER' | 'OTHER') {
  return invokeFunction<{ tuition_id: string; payment_method: string }, unknown>('tuition-confirm-paid', { tuition_id, payment_method })
}

export function payPayroll(payroll_period_id: string) {
  return invokeFunction<{ payroll_period_id: string }, unknown>('payroll-pay', { payroll_period_id })
}

export function createPayrollPeriod(year: number, month: number) {
  return invokeFunction<{ year: number; month: number }, unknown>('payroll-period-create', { year, month })
}

export function addSalaryAdjustment(payroll_period_id: string, staff_id: string, adjustment_type: 'BONUS' | 'PENALTY', amount: number, reason: string) {
  return invokeFunction<{ payroll_period_id: string; staff_id: string; adjustment_type: string; amount: number; reason: string }, unknown>('payroll-adjustment', { payroll_period_id, staff_id, adjustment_type, amount, reason })
}

export function setAccountStatus(user_id: string, status: 'ACTIVE' | 'INACTIVE' | 'LOCKED') {
  return invokeFunction<{ user_id: string; status: string }, unknown>('admin-account-status', { user_id, status })
}

export function setAdminPermissionGroups(user_id: string, permission_group_ids: string[]) {
  return invokeFunction<{ user_id: string; permission_group_ids: string[] }, unknown>('admin-permissions', { user_id, permission_group_ids })
}

export function createManualAccounting(input: { direction: 'INCOME' | 'EXPENSE'; category_id: string; amount: number; transaction_date: string; payment_method?: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; description: string }) {
  return invokeFunction<typeof input, unknown>('accounting-manual', input)
}

export function exportReport(type: ReportType, format: ReportFormat, filters: ReportFilters) {
  return invokeFunction<{ type: ReportType; format: ReportFormat; filters: ReportFilters }, FileExport>('report-export', { type, format, filters })
}

export async function createClass(input: { code: string; name: string; subject_id: string; grade_id: string; default_monthly_fee: number; max_students?: number | null; capacity_policy?: 'WARNING' | 'BLOCK' | 'UNLIMITED' }) {
  const { data, error } = await supabase.from('classes').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function createClassMonth(input: { class_id: string; year: number; month: number; notes?: string }) {
  const { data, error } = await supabase.from('class_months').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function addClassMonthStudent(input: { class_month_id: string; student_id: string; membership_start_date: string; membership_end_date?: string | null; monthly_fee_snapshot: number }) {
  const { data, error } = await supabase.from('class_month_students').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function addClassMonthStaff(input: { class_month_id: string; staff_id: string; assignment_role: 'TEACHER' | 'ASSISTANT' }) {
  const { data, error } = await supabase.from('class_month_staff').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function addClassMonthSchedule(input: { class_month_id: string; day_of_week: number; start_time: string; end_time: string }) {
  const { data, error } = await supabase.from('class_month_schedules').insert(input).select('*').single()
  if (error) throw error
  return data
}
