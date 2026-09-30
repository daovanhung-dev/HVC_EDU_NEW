import type { ClassScheduleRow, SessionRow } from '@/shared/types/domain'

export const MAX_CLASS_TEACHERS = 5

export function getClassTeacherIds(
  classId: string,
  schedules: ClassScheduleRow[],
  sessions: SessionRow[],
  excludeSessionId?: string,
): Set<string> {
  const staffIds = new Set<string>()

  for (const schedule of schedules) {
    if (schedule.class_id !== classId || schedule.status === 'ARCHIVED') continue
    for (const assignment of schedule.class_schedule_staff || []) staffIds.add(assignment.staff_id)
  }

  for (const session of sessions) {
    if (session.class_id !== classId || session.id === excludeSessionId) continue
    if (session.status !== 'SCHEDULED' && session.status !== 'IN_PROGRESS') continue
    for (const assignment of session.session_staff || []) {
      if (assignment.assignment_role === 'TEACHER') staffIds.add(assignment.staff_id)
    }
  }

  return staffIds
}

export function selectedTeacherCount(baseIds: Set<string>, selectedIds: string[]): number {
  return new Set([...baseIds, ...selectedIds]).size
}

export function canSelectClassTeacher(baseIds: Set<string>, selectedIds: string[], teacherId: string): boolean {
  if (selectedIds.includes(teacherId)) return true
  return selectedTeacherCount(baseIds, [...selectedIds, teacherId]) <= MAX_CLASS_TEACHERS
}
