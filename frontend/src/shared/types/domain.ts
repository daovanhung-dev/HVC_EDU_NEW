import type { Role } from '@/shared/constants/roles'

export interface Profile {
  id: string
  user_id: string
  role: Role
  username: string | null
  display_name: string | null
  phone: string | null
  email: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
  force_password_change: boolean
}

export interface DashboardMetric {
  label: string
  value: string
  hint?: string
  tone: 'primary' | 'success' | 'warning' | 'info'
}

export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
export type TimesheetStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type PayrollStatus = 'DRAFT' | 'CONFIRMED' | 'PAID'
export type ReportType = 'STUDENTS' | 'ATTENDANCE' | 'HOMEWORK' | 'TUITION' | 'PAYROLL' | 'ACCOUNTING' | 'MONTHLY'
export type ReportFormat = 'XLSX' | 'PDF'

export interface ReportFilters {
  year: number
  month: number
  class_id?: string
  student_id?: string
  staff_id?: string
}

export interface FileExport {
  filename: string
  mime_type: string
  content_base64: string
}

export interface NotificationRow {
  id: string
  title: string
  body: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}
