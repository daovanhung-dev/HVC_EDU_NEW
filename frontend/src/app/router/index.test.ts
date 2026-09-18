import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import router from './index'
import { usePermissionStore } from '@/stores/permission.store'
import { useAppErrorStore } from '@/stores/app-error.store'

const mocks = vi.hoisted(() => {
  const profileRows: unknown[] = []
  let permissionQueryError: Error | null = null
  const supabase = {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => table === 'admin_permission_groups'
          ? {
              then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: [], error: permissionQueryError }).then(resolve, reject),
            }
          : {
              maybeSingle: vi.fn(async () => ({ data: profileRows.shift() ?? null })),
            }),
      })),
    })),
  }
  return {
    supabase,
    profileRows,
    setPermissionQueryError(error: Error | null) { permissionQueryError = error },
  }
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

function profile(forcePasswordChange: boolean, role = 'ADMIN') {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    role,
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
    mocks.setPermissionQueryError(null)
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session } })
    const permissions = usePermissionStore()
    permissions.loaded = true
  })

  it('allows an account with a legacy force flag to enter Dashboard', async () => {
    mocks.profileRows.push(profile(true))
    await router.push('/dashboard?case=forced')

    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('allows an account with the cleared flag to enter Dashboard', async () => {
    mocks.profileRows.push(profile(false))
    await router.push('/dashboard?case=cleared')

    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it.each(['TEACHER', 'ASSISTANT'])('allows %s to open all staff functions without admin permissions', async (role) => {
    mocks.profileRows.push(profile(false, role))

    await router.push(`/staff/sessions?role=${role}`)
    expect(router.currentRoute.value.path).toBe('/staff/sessions')

    await router.push(`/staff/timesheets?role=${role}`)
    expect(router.currentRoute.value.path).toBe('/staff/timesheets')

    await router.push(`/staff/payroll?role=${role}`)
    expect(router.currentRoute.value.path).toBe('/staff/payroll')
  })

  it('keeps admin permission checks for admin routes', async () => {
    mocks.profileRows.push(profile(false, 'ADMIN'))
    await router.push('/admin/students?case=permission')

    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('shows a global error when permission loading fails', async () => {
    const permissions = usePermissionStore()
    permissions.clear()
    mocks.setPermissionQueryError(new Error('raw permission database detail'))
    mocks.profileRows.push(profile(false, 'ADMIN'))

    await router.push('/admin/students?case=permission-error')

    expect(router.currentRoute.value.path).toBe('/dashboard')
    const appErrors = useAppErrorStore()
    expect(appErrors.current?.message).toBe('Không thể kiểm tra quyền truy cập. Vui lòng thử lại sau.')
    expect(appErrors.current?.message).not.toContain('raw permission database detail')
  })

  it('redirects an unauthenticated account to login', async () => {
    mocks.supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    await router.push('/staff/sessions?case=unauthenticated')

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('registers class and student detail routes', () => {
    expect(router.resolve('/admin/classes/class-1').matched.some((record) => record.path === '/admin/classes/:classId')).toBe(true)
    expect(router.resolve('/admin/classes/class-1/students/student-1').matched.some((record) => record.path === '/admin/classes/:classId/students/:studentId')).toBe(true)
  })
})
