import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export interface Caller {
  user: User
  profile: { id: string; user_id: string; role: string; status: string; username: string | null }
}

function projectUrl(): string {
  const value = Deno.env.get('SUPABASE_URL')
  if (!value) throw new Error('SUPABASE_URL_MISSING')
  return value
}

function publishableKey(): string {
  const value = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
  if (!value) throw new Error('SUPABASE_PUBLISHABLE_KEY_MISSING')
  return value
}

function secretKey(): string {
  const keyMap = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keyMap) {
    const parsed = JSON.parse(keyMap) as Record<string, string>
    if (parsed.default) return parsed.default
    const first = Object.values(parsed)[0]
    if (first) return first
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  throw new Error('SUPABASE_SECRET_KEY_MISSING')
}

export function adminClient(): SupabaseClient {
  return createClient(projectUrl(), secretKey(), { auth: { autoRefreshToken: false, persistSession: false } })
}

export function callerClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') || ''
  return createClient(projectUrl(), publishableKey(), { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } })
}

export async function requireCaller(req: Request): Promise<Caller> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) throw new Error('UNAUTHENTICATED')
  const client = callerClient(req)
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) throw new Error('UNAUTHENTICATED')
  const { data: profile, error: profileError } = await adminClient().from('profiles').select('id,user_id,role,status,username').eq('user_id', userData.user.id).single()
  if (profileError || !profile || profile.status !== 'ACTIVE') throw new Error('ACCOUNT_INACTIVE')
  return { user: userData.user, profile }
}

export function canManageRole(caller: Caller, role: string): boolean {
  if (caller.profile.role === 'ROOT_ADMIN') return true
  if (role === 'ADMIN') return false
  if (role === 'STUDENT') return caller.profile.role === 'ADMIN'
  return caller.profile.role === 'ADMIN'
}

export async function requirePermission(req: Request, permission: string): Promise<Caller> {
  const caller = await requireCaller(req)
  if (caller.profile.role === 'ROOT_ADMIN') return caller
  const { data, error } = await adminClient().rpc('actor_has_permission', { p_user_id: caller.user.id, p_permission_code: permission })
  if (error || !data) throw new Error('FORBIDDEN')
  return caller
}

export function temporaryPassword(): string {
  return `HC-${crypto.randomUUID().replaceAll('-', '').slice(0, 14)}!`
}

export function syntheticEmail(username: string): string {
  const safe = username.toLowerCase().replace(/[^a-z0-9._-]/g, '')
  return `${safe || crypto.randomUUID()}@hvc-edu.local`
}
