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
        or() { return query },
        order() { return query },
        maybeSingle() { return query },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: mockState.responses[table] ?? [], error: null }).then(resolve, reject)
        },
      }
      return query
    },
  },
}))

import { getMyAttendance, getMySessions, getStudentHistory } from './data-queries'

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
    expect(selection?.columns).toContain('classes(id,name)')
    expect(selection?.columns).not.toContain('classes(id,code,name)')
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
