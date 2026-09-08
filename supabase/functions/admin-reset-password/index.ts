import { adminClient, requireCaller, temporaryPassword } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { user_id?: string }
    if (!body.user_id) return fail('INVALID_INPUT', 'Thiếu user_id.')
    if (caller.profile.role !== 'ROOT_ADMIN') {
      const permission = await adminClient().rpc('actor_has_permission', { p_user_id: caller.user.id, p_permission_code: 'STAFF_MANAGE' })
      if (permission.error || !permission.data) return fail('FORBIDDEN', 'Bạn không có quyền reset mật khẩu.', 403)
    }
    const password = temporaryPassword()
    const admin = adminClient()
    const updated = await admin.auth.admin.updateUserById(body.user_id, { password })
    if (updated.error) throw updated.error
    const profile = await admin.from('profiles').update({ force_password_change: true }).eq('user_id', body.user_id).select('id,username').single()
    if (profile.error) throw profile.error
    await admin.rpc('write_audit', { p_actor_user_id: caller.user.id, p_action: 'ACCOUNT_RESET_PASSWORD', p_entity_type: 'profiles', p_entity_id: profile.data.id, p_new_data: { force_password_change: true } })
    return ok({ profile: profile.data, temporary_password: password })
  } catch (error) {
    return fromError(error)
  }
})
