import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

function one<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value || undefined }

export async function notifyUsers(admin: SupabaseClient, userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return
  await admin.from('notifications').insert(ids.map((user_id) => ({ user_id, channel: 'IN_APP', title, body, data })))
}

export async function notifyPermission(admin: SupabaseClient, permissionCode: string, title: string, body: string, data: Record<string, unknown> = {}) {
  const permission = await admin.from('permissions').select('id').eq('code', permissionCode).maybeSingle()
  if (permission.error || !permission.data) return
  const groups = await admin.from('permission_group_permissions').select('permission_group_id').eq('permission_id', permission.data.id)
  const groupIds = (groups.data || []).map((row: any) => row.permission_group_id)
  const assigned = groupIds.length ? await admin.from('admin_permission_groups').select('user_id').in('permission_group_id', groupIds) : { data: [] as any[] }
  const roots = await admin.from('profiles').select('user_id').eq('role', 'ROOT_ADMIN').eq('status', 'ACTIVE')
  await notifyUsers(admin, [...(assigned.data || []).map((row: any) => row.user_id), ...(roots.data || []).map((row: any) => row.user_id)], title, body, data)
}

export async function sessionStaffUsers(admin: SupabaseClient, sessionId: string) {
  const result = await admin.from('session_staff').select('staff(user_id)').eq('session_id', sessionId)
  return (result.data || []).map((row: any) => one(row.staff)?.user_id).filter(Boolean) as string[]
}

export async function sessionStudentUsers(admin: SupabaseClient, sessionId: string) {
  const result = await admin.from('session_students').select('students(user_id)').eq('session_id', sessionId)
  return (result.data || []).map((row: any) => one(row.students)?.user_id).filter(Boolean) as string[]
}
