import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import router from './index'
import { useAuthStore } from '@/stores/auth.store'

const mocks = vi.hoisted(() => {
  const profileRows: unknown[] = []
  return {
    profileRows,
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: profileRows.shift() ?? null, error: null })) })) })) })),
    },
  }
})

vi.mock('@/services/supabase', () => ({ isSupabaseConfigured: true, supabase: mocks.supabase }))

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  user: { id: 'user-1', email: 'test@local.vn' },
} as unknown as Session

function profile(role: string) {
  return { id: 'profile-1', user_id: 'user-1', role, username: 'user', display_name: 'Test', status: 'ACTIVE', force_password_change: false }
}

describe('authentication route guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.profileRows.length = 0
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null })
  })

  it.each(['ADMIN', 'ROOT_ADMIN'])('routes %s into the admin workspace', async (role) => {
    mocks.profileRows.push(profile(role))
    await router.push(`/?role=${role}`)
    expect(router.currentRoute.value.path).toBe('/admin/students')
  })

  it('routes teachers to assigned sessions and personal profile', async () => {
    mocks.profileRows.push(profile('TEACHER'))
    await router.push('/staff/profile?case=teacher')
    expect(router.currentRoute.value.path).toBe('/staff/profile')
    await router.push('/staff/timesheets?case=teacher')
    expect(router.currentRoute.value.path).toBe('/staff/timesheets')
    await router.push('/admin/classes?case=teacher')
    expect(router.currentRoute.value.path).toBe('/staff/sessions')
  })

  it('allows students to use their own learning portal and blocks admin routes', async () => {
    mocks.profileRows.push(profile('STUDENT'))
    await router.push('/student/schedule?case=student')
    expect(router.currentRoute.value.path).toBe('/student/schedule')
    await router.push('/staff/timesheets?case=student')
    expect(router.currentRoute.value.path).toBe('/student/schedule')
    await router.push('/admin/classes?case=student')
    expect(router.currentRoute.value.path).toBe('/student/schedule')
  })

  it.each(['PARENT', 'ASSISTANT'])('blocks retired %s accounts', async (role) => {
    mocks.profileRows.push(profile(role))
    await router.push(`/student/schedule?role=${role}`)
    expect(router.currentRoute.value.path).toBe('/login')
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('redirects unauthenticated users to login', async () => {
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await router.push('/staff/sessions?case=unauthenticated')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('registers continuous class and student profile routes, not retired modules', () => {
    expect(router.resolve('/admin/classes/class-1').matched.some((record) => record.path === '/admin/classes/:classId')).toBe(true)
    expect(router.resolve('/admin/students/student-1').matched.some((record) => record.path === '/admin/students/:studentId')).toBe(true)
    expect(router.resolve('/admin/timesheets').matched.some((record) => record.path === '/admin/timesheets')).toBe(true)
    expect(router.resolve('/staff/timesheets').matched.some((record) => record.path === '/staff/timesheets')).toBe(true)
    expect(router.resolve('/student/review').matched.some((record) => record.path === '/student/review')).toBe(true)
    expect(router.resolve('/student/ai').matched.some((record) => record.path === '/student/ai')).toBe(true)
    expect(router.resolve('/admin/class-months').matched.some((record) => record.path === '/admin/class-months')).toBe(false)
  })
})
