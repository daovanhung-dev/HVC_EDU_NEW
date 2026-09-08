import { adminClient } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const expected = Deno.env.get('CUSTOM_BOOTSTRAP_SECRET')
    if (!expected || req.headers.get('x-bootstrap-secret') !== expected) return fail('FORBIDDEN', 'Bootstrap token không hợp lệ.', 403)
    const body = await req.json() as { username?: string; password?: string }
    const username = body.username?.trim() || 'ADMIN'
    if (!body.password || body.password.length < 8) return fail('INVALID_BOOTSTRAP_INPUT', 'Mật khẩu bootstrap phải có ít nhất 8 ký tự.')
    const admin = adminClient()
    const existing = (await admin.from('profiles').select('id').eq('role', 'ROOT_ADMIN').limit(1)).data
    if (existing?.length) return fail('ROOT_ALREADY_BOOTSTRAPPED', 'ROOT đã được bootstrap trước đó.', 409)
    const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@hvc-edu.local`
    const created = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true })
    if (created.error || !created.data.user) throw created.error || new Error('AUTH_CREATE_FAILED')
    const inserted = await admin.from('profiles').insert({ user_id: created.data.user.id, role: 'ROOT_ADMIN', username, display_name: 'Admin Root', email, force_password_change: true }).select('id,user_id,role,username').single()
    if (inserted.error) {
      await admin.auth.admin.deleteUser(created.data.user.id)
      throw inserted.error
    }
    await admin.rpc('write_audit', { p_actor_user_id: created.data.user.id, p_action: 'BOOTSTRAP_ROOT', p_entity_type: 'profiles', p_entity_id: inserted.data.id, p_new_data: inserted.data })
    return ok({ profile: inserted.data })
  } catch (error) {
    return fromError(error)
  }
})
