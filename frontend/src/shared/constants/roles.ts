export const ROLES = ['ROOT_ADMIN', 'ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  ROOT_ADMIN: 'Admin Root',
  ADMIN: 'Admin',
  TEACHER: 'Giáo viên',
  ASSISTANT: 'Trợ giảng',
  STUDENT: 'Học sinh',
}

export const ADMIN_PERMISSION_GROUPS = [
  'STUDENT_MANAGEMENT',
  'CLASS_MANAGEMENT',
  'STAFF_MANAGEMENT',
  'ACADEMIC_MANAGEMENT',
  'TIMESHEET_MANAGEMENT',
  'PAYROLL_MANAGEMENT',
  'ACCOUNTING',
  'REPORTING',
  'NOTIFICATIONS',
] as const
