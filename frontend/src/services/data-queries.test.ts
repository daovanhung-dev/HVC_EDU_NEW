import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  selections: [] as Array<{ table: string; columns: string }>,
  responses: {} as Record<string, unknown>,
}))

vi.mock('./supabase', () => ({
  supabase: {
    from(table: string) {
      const query: any = {
        select(columns: string) {
          mockState.selections.push({ table, columns })
          return query
        },
        eq() { return query },
        lte() { return query },
        or() { return query },
        order() { return query },
        limit() { return query },
        maybeSingle() { return query },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: mockState.responses[table] ?? [], error: null }).then(resolve, reject)
        },
      }
      return query
    },
  },
}))

import { getClassActiveRosterSize, getMyAttendance, getMySessions, getMyTimesheets, getStudentHistory, getTimesheets } from './data-queries'

const assignedStaffRelation = 'staff!session_staff_staff_id_fkey('

describe('session staff PostgREST relations', () => {
  beforeEach(() => {
    mockState.selections.length = 0
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
    mockState.responses = { class_memberships: [{ id: 'qa-membership' }] }
  })

  it('checks for an active roster without fetching student profile fields', async () => {
    await expect(getClassActiveRosterSize('qa-class')).resolves.toBe(1)

    const selection = mockState.selections.find((item) => item.table === 'class_memberships')
    expect(selection?.columns).toBe('id')
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
