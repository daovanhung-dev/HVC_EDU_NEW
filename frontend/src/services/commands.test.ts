import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: { rpc: mockState.rpc } }))
vi.mock('./edge-functions', () => ({ invokeFunction: vi.fn() }))

import { createManualSession, updateSessionOccurrence } from './commands'

describe('session room scheduling commands', () => {
  beforeEach(() => {
    mockState.rpc.mockReset().mockResolvedValue({ data: { session_id: 'qa-session' }, error: null })
  })

  it('sends the room when creating a manual session', async () => {
    await createManualSession({
      class_id: 'qa-class',
      start: '2026-10-02T10:30:00.000Z',
      end: '2026-10-02T12:30:00.000Z',
      staff_ids: ['qa-teacher'],
      room: 'QA-Room-A',
    })

    expect(mockState.rpc).toHaveBeenCalledWith('admin_create_session', {
      p_class_id: 'qa-class',
      p_scheduled_start_at: '2026-10-02T10:30:00.000Z',
      p_scheduled_end_at: '2026-10-02T12:30:00.000Z',
      p_staff_ids: ['qa-teacher'],
      p_room: 'QA-Room-A',
    })
  })

  it('sends the selected room when rescheduling a session', async () => {
    await updateSessionOccurrence({
      session_id: 'qa-session',
      start: '2026-10-02T10:30:00.000Z',
      end: '2026-10-02T12:30:00.000Z',
      room: 'QA-Room-B',
    })

    expect(mockState.rpc).toHaveBeenCalledWith('admin_update_session_occurrence', {
      p_session_id: 'qa-session',
      p_scheduled_start_at: '2026-10-02T10:30:00.000Z',
      p_scheduled_end_at: '2026-10-02T12:30:00.000Z',
      p_cancel: false,
      p_room: 'QA-Room-B',
    })
  })
})
