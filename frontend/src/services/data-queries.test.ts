import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  selections: [] as Array<{ table: string; columns: string }>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  responses: {} as Record<string, unknown>,
}))

vi.mock('./supabase', () => ({
  supabase: {
    from(table: string) {
      const query: any = {
        rangeArgs: null as [number, number] | null,
        select(columns: string) {
          mockState.selections.push({ table, columns })
          return query
        },
        eq(...args: unknown[]) { mockState.calls.push({ table, method: 'eq', args }); return query },
        in(...args: unknown[]) { mockState.calls.push({ table, method: 'in', args }); return query },
        lte(...args: unknown[]) { mockState.calls.push({ table, method: 'lte', args }); return query },
        or(...args: unknown[]) { mockState.calls.push({ table, method: 'or', args }); return query },
        order(...args: unknown[]) { mockState.calls.push({ table, method: 'order', args }); return query },
        range(...args: [number, number]) { query.rangeArgs = args; mockState.calls.push({ table, method: 'range', args }); return query },
        limit() { return query },
        maybeSingle() { return query },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          const data = mockState.responses[table] ?? []
          const ranged = Array.isArray(data) && query.rangeArgs
            ? data.slice(query.rangeArgs[0], query.rangeArgs[1] + 1)
            : data
          return Promise.resolve({ data: ranged, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  },
}))

import { getClassActiveRosterSize, getClassRosterForExport, getMyAttendance, getMySessions, getMyTimesheets, getStudentCurrentClasses, getStudentHistory, getStudentIntakeDuplicateIdentities, getStudentsCurrentClassSummaries, getTimesheets } from './data-queries'

const assignedStaffRelation = 'staff!session_staff_staff_id_fkey('

describe('session staff PostgREST relations', () => {
  beforeEach(() => {
    mockState.selections.length = 0
    mockState.calls.length = 0
    mockState.responses = {}
  })

  it('uses the assigned staff foreign key when loading sessions', async () => {
    await getMySessions()

    const selection = mockState.selections.find((item) => item.table === 'sessions')
    expect(selection?.columns).toContain(assignedStaffRelation)
    expect(selection?.columns).toContain('classes(id,name,subjects(name),grades(name))')
    expect(selection?.columns).toContain('lesson_youtube_url')
    expect(selection?.columns).toContain('subjects(name)')
    expect(selection?.columns).toContain('room')
    expect(selection?.columns).not.toContain('classes(id,code,name)')
    expect(selection?.columns).not.toContain('manual_schedule')
    expect(selection?.columns).not.toContain('staff_assignment_override')
  })

  it('uses the assigned staff foreign key in attendance history', async () => {
    await getMyAttendance()

    const selection = mockState.selections.find((item) => item.table === 'student_attendances')
    expect(selection?.columns).toContain(assignedStaffRelation)
  })

  it('uses the assigned staff foreign key in student history', async () => {
    mockState.responses.sessions = [{
      id: 'qa-session',
      class_id: 'qa-class',
      scheduled_start_at: '2026-09-30T10:00:00.000Z',
      scheduled_end_at: '2026-09-30T12:00:00.000Z',
      status: 'COMPLETED',
      session_note: null,
      classes: null,
      session_students: [],
      session_staff: [],
    }]

    await getStudentHistory('qa-student')

    const selection = mockState.selections.find((item) => item.table === 'sessions')
    expect(selection?.columns).toContain(assignedStaffRelation)
  })
})

describe('class roster summary query', () => {
  beforeEach(() => {
    mockState.selections.length = 0
    mockState.calls.length = 0
    mockState.responses = { class_memberships: [{ id: 'qa-membership' }] }
  })

  it('checks for an active roster without fetching student profile fields', async () => {
    await expect(getClassActiveRosterSize('qa-class')).resolves.toBe(1)

    const selection = mockState.selections.find((item) => item.table === 'class_memberships')
    expect(selection?.columns).toBe('id')
  })

  it('exports one row per student who is effective in the selected class today', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T04:00:00.000Z'))
    const currentStudent = {
      id: 'qa-student-current', student_code: 'QA-S-02', full_name: 'QA- Bảo An', phone: '0123456789',
      parent_name: 'QA- Phụ huynh', status: 'ACTIVE', created_at: '2026-10-01T08:00:00.000Z',
    }
    const sameDayStudent = {
      id: 'qa-student-today', student_code: 'QA-S-01', full_name: 'QA- An Bình', phone: null,
      parent_name: null, status: 'INACTIVE', created_at: '2026-10-02T08:00:00.000Z',
    }
    mockState.responses.class_memberships = [
      { class_id: 'qa-class', student_id: currentStudent.id, start_date: '2026-10-01', end_date: null, status: 'ACTIVE', students: currentStudent },
      { class_id: 'qa-class', student_id: currentStudent.id, start_date: '2026-10-02', end_date: '2026-10-08', status: 'ACTIVE', students: [currentStudent] },
      { class_id: 'qa-class', student_id: sameDayStudent.id, start_date: '2026-10-08', end_date: '2026-10-08', status: 'ACTIVE', students: sameDayStudent },
      { class_id: 'qa-class', student_id: 'qa-student-ended', start_date: '2026-10-01', end_date: '2026-10-07', status: 'ACTIVE', students: { ...currentStudent, id: 'qa-student-ended' } },
      { class_id: 'qa-class', student_id: 'qa-student-future', start_date: '2026-10-09', end_date: null, status: 'ACTIVE', students: { ...currentStudent, id: 'qa-student-future' } },
      { class_id: 'qa-class-other', student_id: 'qa-student-other-class', start_date: '2026-10-01', end_date: null, status: 'ACTIVE', students: { ...currentStudent, id: 'qa-student-other-class' } },
      { class_id: 'qa-class', student_id: 'qa-student-inactive-membership', start_date: '2026-10-01', end_date: null, status: 'INACTIVE', students: { ...currentStudent, id: 'qa-student-inactive-membership' } },
    ]

    try {
      const roster = await getClassRosterForExport('qa-class')
      expect(roster.map((student) => student.id)).toEqual(['qa-student-today', 'qa-student-current'])
      expect(roster[1]).toMatchObject({ student_code: 'QA-S-02', phone: '0123456789', parent_name: 'QA- Phụ huynh' })
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'eq', args: ['class_id', 'qa-class'] })
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'eq', args: ['status', 'ACTIVE'] })
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'lte', args: ['start_date', '2026-10-08'] })
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'or', args: ['end_date.is.null,end_date.gte.2026-10-08'] })
      expect(mockState.selections.find((item) => item.table === 'class_memberships')?.columns)
        .toContain('students(id,student_code,full_name,phone,parent_name,status,created_at)')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('current student classes', () => {
  beforeEach(() => {
    mockState.selections.length = 0
    mockState.calls.length = 0
    mockState.responses = {}
  })

  it('loads multiple effective class summaries and ignores future, ended, or inactive memberships', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T17:30:00.000Z'))
    mockState.responses.class_memberships = [
      { id: 'qa-membership-a', student_id: 'qa-student-1', class_id: 'qa-class-1', start_date: '2026-10-10', end_date: '2026-10-10', status: 'ACTIVE', classes: { id: 'qa-class-1', code: 'QA-A', name: 'QA Toán' } },
      { id: 'qa-membership-b', student_id: 'qa-student-1', class_id: 'qa-class-2', start_date: '2026-10-01', end_date: null, status: 'ACTIVE', classes: [{ id: 'qa-class-2', code: 'QA-B', name: 'QA Anh' }] },
      { id: 'qa-membership-duplicate', student_id: 'qa-student-1', class_id: 'qa-class-1', start_date: '2026-10-02', end_date: null, status: 'ACTIVE', classes: { id: 'qa-class-1', code: 'QA-A', name: 'QA Toán' } },
      { id: 'qa-membership-future', student_id: 'qa-student-1', class_id: 'qa-future', start_date: '2026-10-11', end_date: null, status: 'ACTIVE', classes: { id: 'qa-future', code: 'QA-F', name: 'QA Tương lai' } },
      { id: 'qa-membership-ended', student_id: 'qa-student-1', class_id: 'qa-ended', start_date: '2026-10-01', end_date: '2026-10-09', status: 'ACTIVE', classes: { id: 'qa-ended', code: 'QA-E', name: 'QA Đã kết thúc' } },
      { id: 'qa-membership-inactive', student_id: 'qa-student-1', class_id: 'qa-inactive', start_date: '2026-10-01', end_date: null, status: 'INACTIVE', classes: { id: 'qa-inactive', code: 'QA-I', name: 'QA Không hoạt động' } },
      { id: 'qa-membership-other', student_id: 'qa-student-outside', class_id: 'qa-other', start_date: '2026-10-01', end_date: null, status: 'ACTIVE', classes: { id: 'qa-other', code: 'QA-O', name: 'QA Ngoài truy vấn' } },
    ]

    try {
      const result = await getStudentsCurrentClassSummaries(['qa-student-1', 'qa-student-2'])
      expect(result['qa-student-1']).toEqual([
        { id: 'qa-class-1', code: 'QA-A', name: 'QA Toán' },
        { id: 'qa-class-2', code: 'QA-B', name: 'QA Anh' },
      ])
      expect(result['qa-student-2']).toEqual([])
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'in', args: ['student_id', ['qa-student-1', 'qa-student-2']] })
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'eq', args: ['status', 'ACTIVE'] })
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'lte', args: ['start_date', '2026-10-10'] })
      expect(mockState.calls).toContainEqual({ table: 'class_memberships', method: 'or', args: ['end_date.is.null,end_date.gte.2026-10-10'] })
    } finally {
      vi.useRealTimers()
    }
  })

  it('includes current enrollment date and active schedules with assigned teachers in the detail result', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T03:00:00.000Z'))
    mockState.responses.class_memberships = [{
      id: 'qa-membership-1', student_id: 'qa-student-1', class_id: 'qa-class-1',
      start_date: '2026-10-01', end_date: null, status: 'ACTIVE',
      classes: { id: 'qa-class-1', code: 'QA-MATH', name: 'QA Toán', status: 'ACTIVE', subjects: [{ name: 'QA Môn Toán' }], grades: { name: 'QA Khối 7' } },
    }]
    mockState.responses.class_schedules = [
      { id: 'qa-schedule-active', class_id: 'qa-class-1', day_of_week: 2, start_time: '17:30:00', end_time: '19:00:00', room: 'QA-A1', status: 'ACTIVE', reviewed_at: null, class_schedule_staff: [{ staff_id: 'qa-teacher-1', staff: [{ id: 'qa-teacher-1', staff_code: 'QA-T-1', full_name: 'QA Giáo viên' }] }] },
      { id: 'qa-schedule-inactive', class_id: 'qa-class-1', day_of_week: 4, start_time: '17:30:00', end_time: '19:00:00', room: null, status: 'INACTIVE', reviewed_at: null, class_schedule_staff: [] },
    ]

    try {
      const [classRow] = await getStudentCurrentClasses('qa-student-1')
      expect(classRow).toMatchObject({
        id: 'qa-class-1', code: 'QA-MATH', name: 'QA Toán', membership_id: 'qa-membership-1',
        start_date: '2026-10-01', subject_name: 'QA Môn Toán', grade_name: 'QA Khối 7',
      })
      expect(classRow.schedules).toHaveLength(1)
      expect(classRow.schedules[0].class_schedule_staff?.[0].staff?.full_name).toBe('QA Giáo viên')
      expect(mockState.calls).toContainEqual({ table: 'class_schedules', method: 'in', args: ['class_id', ['qa-class-1']] })
      expect(mockState.calls).toContainEqual({ table: 'class_schedules', method: 'eq', args: ['status', 'ACTIVE'] })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('student intake duplicate lookup', () => {
  beforeEach(() => {
    mockState.selections.length = 0
    mockState.calls.length = 0
    mockState.responses = {}
  })

  it('loads all existing student identities in stable pages', async () => {
    mockState.responses.students = Array.from({ length: 1001 }, (_, index) => ({
      id: `qa-student-${index + 1}`,
      student_code: `QA-${index + 1}`,
      full_name: `QA Student ${index + 1}`,
      phone: null,
    }))

    const students = await getStudentIntakeDuplicateIdentities()

    expect(students).toHaveLength(1001)
    expect(students[0].id).toBe('qa-student-1')
    expect(students.at(-1)?.id).toBe('qa-student-1001')
    expect(mockState.selections.find((item) => item.table === 'students')?.columns).toBe('id,student_code,full_name,phone')
    expect(mockState.calls.filter((item) => item.table === 'students' && item.method === 'range')).toEqual([
      { table: 'students', method: 'range', args: [0, 999] },
      { table: 'students', method: 'range', args: [1000, 1999] },
    ])
  })
})

describe('timesheet queries', () => {
  beforeEach(() => {
    mockState.selections.length = 0
    mockState.responses = {
      timesheets: [{
        id: 'qa-timesheet', session_id: 'qa-session', staff_id: 'qa-teacher', status: 'PENDING',
        submitted_at: '2026-09-30T10:00:00Z', approved_at: null, approved_by: null,
        rejection_reason: null, notes: 'QA note',
        sessions: [{ id: 'qa-session', scheduled_start_at: '2026-09-30T10:00:00Z', scheduled_end_at: '2026-09-30T12:00:00Z', status: 'COMPLETED', classes: [{ name: 'QA class' }] }],
        staff: [{ id: 'qa-teacher', staff_code: 'QA-T-1', full_name: 'QA Teacher' }],
      }],
    }
  })

  it('loads and normalizes own timesheets using the same RLS-protected table query', async () => {
    const rows = await getMyTimesheets()
    expect(rows).toHaveLength(1)
    expect(rows[0].sessions?.classes?.name).toBe('QA class')
    expect(rows[0].staff?.full_name).toBe('QA Teacher')
    expect(mockState.selections.find((item) => item.table === 'timesheets')?.columns).toContain('sessions(')
  })

  it('loads the admin review queue through the same RLS-protected query', async () => {
    await expect(getTimesheets()).resolves.toHaveLength(1)
    expect(mockState.selections.filter((item) => item.table === 'timesheets')).toHaveLength(1)
  })
})
