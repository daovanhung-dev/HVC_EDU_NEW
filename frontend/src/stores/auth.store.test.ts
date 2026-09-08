import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { useAuthStore } from './auth.store'

const mocks = vi.hoisted(() => {
  let authStateCallback: ((event: string, session: Session | null) => void) | undefined
  const profileRows: unknown[] = []
  const supabase = {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((callback: (event: string, session: Session | null) => void) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      setSession: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: await profileRows.shift() ?? null })),
        })),
      })),
    })),
    rpc: vi.fn(),
  }
  return {
    supabase,
    profileRows,
    emitAuthState(session: Session | null) {
      authStateCallback?.('USER_UPDATED', session)
    },
  }
})

vi.mock('@/services/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: mocks.supabase,
}))

vi.mock('@/services/edge-functions', () => ({
  invokeFunction: vi.fn(),
}))

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  user: { id: 'user-1', email: 'admin@local.vn' },
} as unknown as Session

function profile(forcePasswordChange: boolean) {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    role: 'ADMIN',
    username: 'admin_local',
    display_name: 'Administrator',
    phone: null,
    email: 'admin@local.vn',
    status: 'ACTIVE',
    force_password_change: forcePasswordChange,
  }
}

describe('auth store password-change flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.profileRows.length = 0
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    mocks.supabase.auth.updateUser.mockResolvedValue({ error: null })
    mocks.supabase.rpc.mockResolvedValue({ error: null })
  })

  it('hydrates a new account with force_password_change enabled', async () => {
    mocks.profileRows.push(profile(true))
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session } })
    const auth = useAuthStore()

    await auth.initialize()

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.forcePasswordChange).toBe(true)
  })

  it('clears the flag in the database before refreshing local profile state', async () => {
    mocks.profileRows.push(profile(true), profile(false))
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session } })
    const auth = useAuthStore()
    await auth.initialize()

    await auth.updatePassword('NewPassword123!')

    expect(mocks.supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword123!' })
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('clear_force_password_change')
    expect(auth.forcePasswordChange).toBe(false)
  })

  it('does not let a stale auth event restore force_password_change', async () => {
    mocks.profileRows.push(profile(true))
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session } })
    const auth = useAuthStore()
    await auth.initialize()

    let releaseStale: (value: unknown) => void = () => undefined
    const staleProfile = new Promise((resolve) => { releaseStale = resolve })
    mocks.profileRows.push(staleProfile)
    mocks.emitAuthState(session)
    await Promise.resolve()
    mocks.profileRows.push(profile(false))
    await auth.updatePassword('NewPassword123!')
    releaseStale(profile(true))
    await Promise.resolve()

    expect(auth.forcePasswordChange).toBe(false)
  })

  it('keeps the forced-change state when clearing the flag fails', async () => {
    mocks.profileRows.push(profile(true))
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session } })
    const auth = useAuthStore()
    await auth.initialize()
    const rpcError = new Error('RPC_FAILED')
    mocks.supabase.rpc.mockResolvedValue({ error: rpcError })

    await expect(auth.updatePassword('NewPassword123!')).rejects.toBe(rpcError)
    expect(auth.forcePasswordChange).toBe(true)
  })
})
