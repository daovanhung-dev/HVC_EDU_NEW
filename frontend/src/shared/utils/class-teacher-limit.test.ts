import { describe, expect, it } from 'vitest'
import type { ClassScheduleRow, SessionRow } from '@/shared/types/domain'
import { canSelectClassTeacher, getClassTeacherIds, MAX_CLASS_TEACHERS, selectedTeacherCount } from './class-teacher-limit'

function schedule(
  classId: string,
  status: ClassScheduleRow['status'],
  teacherIds: string[],
): ClassScheduleRow {
  return {
    id: `schedule-${classId}-${status}`,
    class_id: classId,
    day_of_week: 1,
    start_time: '17:30:00',
    end_time: '19:30:00',
    room: null,
    status,
    reviewed_at: null,
    class_schedule_staff: teacherIds.map((staff_id) => ({ staff_id })),
  }
}

function session(classId: string, status: SessionRow['status'], teacherIds: string[], id = `session-${status}`): SessionRow {
  return {
    id,
    class_id: classId,
    recurrence_schedule_id: null,
    recurrence_occurrence_date: null,
    scheduled_start_at: '2026-10-01T17:30:00+07:00',
    scheduled_end_at: '2026-10-01T19:30:00+07:00',
    status,
    session_note: null,
    session_staff: teacherIds.map((staff_id) => ({ staff_id, assignment_role: 'TEACHER' })),
  }
}

describe('class teacher assignment limit', () => {
  it('counts distinct teachers across non-archived schedules and unfinished sessions only', () => {
    const schedules = [
      schedule('qa-class-a', 'ACTIVE', ['teacher-1', 'teacher-2']),
      schedule('qa-class-a', 'INACTIVE', ['teacher-2', 'teacher-3']),
      schedule('qa-class-a', 'ARCHIVED', ['teacher-4']),
      schedule('qa-class-b', 'ACTIVE', ['teacher-other-class']),
    ]
    const sessions = [
      session('qa-class-a', 'SCHEDULED', ['teacher-3', 'teacher-4']),
      session('qa-class-a', 'IN_PROGRESS', ['teacher-4', 'teacher-5']),
      session('qa-class-a', 'COMPLETED', ['teacher-6']),
      session('qa-class-a', 'CANCELLED', ['teacher-7']),
      session('qa-class-b', 'SCHEDULED', ['teacher-other-session']),
    ]

    expect([...getClassTeacherIds('qa-class-a', schedules, sessions)].sort()).toEqual([
      'teacher-1', 'teacher-2', 'teacher-3', 'teacher-4', 'teacher-5',
    ])
  })

  it('allows replacements that stay within five and blocks a sixth distinct teacher', () => {
    const assigned = new Set(['teacher-1', 'teacher-2', 'teacher-3', 'teacher-4'])
    const selected = ['teacher-5']

    expect(selectedTeacherCount(assigned, selected)).toBe(MAX_CLASS_TEACHERS)
    expect(canSelectClassTeacher(assigned, selected, 'teacher-5')).toBe(true)
    expect(canSelectClassTeacher(assigned, selected, 'teacher-6')).toBe(false)
    expect(canSelectClassTeacher(assigned, [], 'teacher-6')).toBe(true)
  })

  it('excludes the edited session so one of its teachers can be replaced without exceeding five', () => {
    const schedules = [schedule('qa-class-a', 'ACTIVE', ['teacher-1', 'teacher-2', 'teacher-3', 'teacher-4'])]
    const sessions = [session('qa-class-a', 'SCHEDULED', ['teacher-5'], 'edited')]
    const baseIds = getClassTeacherIds('qa-class-a', schedules, sessions, 'edited')

    expect(selectedTeacherCount(baseIds, ['teacher-5'])).toBe(MAX_CLASS_TEACHERS)
    expect(canSelectClassTeacher(baseIds, ['teacher-5'], 'teacher-6')).toBe(false)
    expect(canSelectClassTeacher(baseIds, [], 'teacher-6')).toBe(true)
  })
})
