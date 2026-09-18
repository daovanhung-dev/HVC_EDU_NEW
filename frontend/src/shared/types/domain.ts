import type { Role } from '@/shared/constants/roles'

export interface Profile {
  id: string
  user_id: string
  role: Role
  username: string | null
  display_name: string | null
  phone: string | null
  email: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
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
export type ReportType = 'STUDENTS' | 'ATTENDANCE' | 'HOMEWORK' | 'MONTHLY'
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

export interface ClassDetailRow {
  id: string
  code: string
  name: string
  subject_id: string
  grade_id: string
  max_students: number | null
  capacity_policy: 'WARNING' | 'BLOCK' | 'UNLIMITED'
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  subjects?: { name: string } | null
  grades?: { name: string } | null
}

export interface ClassMonthDetailRow {
  id: string
  class_id: string
  year: number
  month: number
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  classes?: { code: string; name: string } | null
}

export interface ClassMembershipDetailRow {
  id: string
  class_id: string
  student_id: string
  start_date: string
  end_date: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  students?: ClassStudentProfile | null
}

export interface ClassStudentProfile {
  id: string
  student_code: string
  full_name: string
  phone: string | null
  email: string | null
  address?: string | null
  parent_name: string | null
  parent_phone: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
}

export interface ClassMonthStudentDetailRow {
  id: string
  class_month_id: string
  student_id: string
  membership_start_date: string
  membership_end_date: string | null
  students?: ClassStudentProfile | null
}

export interface ClassMonthStaffDetailRow {
  id: string
  class_month_id: string
  staff_id: string
  assignment_role: 'TEACHER' | 'ASSISTANT'
  staff?: { id: string; staff_code: string | null; full_name: string; staff_type?: 'TEACHER' | 'ASSISTANT'; status?: string } | null
}

export interface ClassMonthScheduleDetailRow {
  id: string
  class_month_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
}

export interface ClassMonthScheduleStaffDetailRow {
  schedule_id: string
  staff_id: string
  assignment_role: 'TEACHER' | 'ASSISTANT'
  staff?: { id: string; staff_code: string | null; full_name: string } | null
}

export interface ClassStudentHistoryRow {
  id: string
  class_month_id: string
  schedule_id: string | null
  scheduled_start_at: string
  scheduled_end_at: string
  status: SessionStatus
  session_note?: string | null
  class_months?: { year: number; month: number; classes?: { code: string; name: string } | null } | null
  attendance: {
    id: string
    status: AttendanceStatus
    late_minutes: number | null
    absence_reason: string | null
    homework_score: number | null
    homework_note: string | null
    understanding_score: number | null
    attitude_score: number | null
    positive_feedback_count: number | null
    positive_feedback_raw: string | null
    comment: string | null
    updated_at: string
  } | null
  assessment_snapshot: Record<string, unknown> | null
}
