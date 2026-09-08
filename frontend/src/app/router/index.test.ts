import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import router from './index'
import { usePermissionStore } from '@/stores/permission.store'

const mocks = vi.hoisted(() => {
  const profileRows: unknown[] = []
  const supabase = {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: profileRows.shift() ?? null })),
        })),
      })),
    })),
  }
  return { supabase, profileRows }
})

vi.mock('@/services/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: mocks.supabase,
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

describe('authentication route guard', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.profileRows.length = 0
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session } })
    const permissions = usePermissionStore()
    permissions.loaded = true
  })

  it('redirects a first-login account to change-password', async () => {
    mocks.profileRows.push(profile(true))
    await router.push('/dashboard?case=forced')

    expect(router.currentRoute.value.path).toBe('/auth/change-password')
  })

  it('allows an account with the cleared flag to enter Dashboard', async () => {
    mocks.profileRows.push(profile(false))
    await router.push('/dashboard?case=cleared')

    expect(router.currentRoute.value.path).toBe('/dashboard')
  })
})
