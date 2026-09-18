import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePermissionStore } from './permission.store'

const mocks = vi.hoisted(() => {
  const databaseError = new Error('database connection failed')
  const query = {
    select: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: databaseError })),
    })),
  }
  return { databaseError, query, supabase: { from: vi.fn(() => query) } }
})

vi.mock('@/services/supabase', () => ({ supabase: mocks.supabase }))
vi.mock('./auth.store', () => ({
  useAuthStore: () => ({ user: { id: 'staff-user' }, role: 'ADMIN' }),
}))

describe('permission store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('surfaces permission query failures and remains retryable', async () => {
    const permissions = usePermissionStore()

    await expect(permissions.load()).rejects.toBe(mocks.databaseError)
    expect(permissions.loaded).toBe(false)
  })
})
