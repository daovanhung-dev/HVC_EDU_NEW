export const ROLES = ['ROOT_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT'] as const
export type Role = (typeof ROLES)[number]
export type RetiredRole = 'PARENT' | 'ASSISTANT'

export const ROLE_LABELS: Record<Role, string> = {
  ROOT_ADMIN: 'Admin',
  ADMIN: 'Admin',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học sinh',
}
