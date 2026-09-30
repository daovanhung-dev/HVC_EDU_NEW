import type { RetiredRole, Role } from '@/shared/constants/roles'

export interface Profile {
  id: string
  user_id: string
  role: Role | RetiredRole
  username: string | null
  display_name: string | null
  phone: string | null
  email: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  force_password_change: boolean
}

export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'

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

export interface ClassMembershipDetailRow {
  id: string
  class_id: string
  student_id: string
  start_date: string
  end_date: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  students?: ClassStudentProfile | null
}

export interface ClassScheduleRow {
  id: string
  class_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  reviewed_at: string | null
  class_schedule_staff?: Array<{ staff_id: string; staff?: { id: string; staff_code: string | null; full_name: string } | null }>
}

export interface SessionStaffRow {
  staff_id: string
  assignment_role?: 'TEACHER'
  staff?: { id: string; staff_code?: string | null; full_name: string } | null
}

export interface SessionRow {
  id: string
  class_id: string
  recurrence_schedule_id: string | null
  recurrence_occurrence_date: string | null
  scheduled_start_at: string
  scheduled_end_at: string
  status: SessionStatus
  session_note: string | null
  schedule_override?: boolean
  manual_schedule?: boolean
  staff_assignment_override?: boolean
  classes?: { id?: string; name: string } | null
  class_schedules?: { room: string | null } | null
  session_students?: Array<{ student_id: string; students?: { id: string; student_code: string; full_name: string } | null }>
  session_staff?: SessionStaffRow[]
}

export interface AttendanceHistoryRow {
  id: string
  student_id: string
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
  students?: ClassStudentProfile | null
  sessions?: SessionRow | null
}

export interface StudentHistoryRow {
  id: string
  class_id: string
  scheduled_start_at: string
  scheduled_end_at: string
  status: SessionStatus
  session_note: string | null
  classes?: { code: string; name: string } | null
  attendance?: AttendanceHistoryRow | null
  teachers: string[]
}
