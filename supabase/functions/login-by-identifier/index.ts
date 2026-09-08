import { adminClient } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const body = await req.json() as { identifier?: string; password?: string }
    const identifier = body.identifier?.trim()
    if (!identifier || !body.password) return fail('INVALID_LOGIN_INPUT', 'Vui lòng nhập tài khoản và mật khẩu.')
    const admin = adminClient()
    let profile: any = null
    const byUsername = await admin.from('profiles').select('*').ilike('username', identifier).maybeSingle()
    profile = byUsername.data
    if (!profile) profile = (await admin.from('profiles').select('*').ilike('email', identifier).maybeSingle()).data
    if (!profile) profile = (await admin.from('profiles').select('*').eq('phone', identifier).maybeSingle()).data
    if (!profile) {
      const student = (await admin.from('students').select('user_id').eq('student_code', identifier).maybeSingle()).data
      if (student) profile = (await admin.from('profiles').select('*').eq('user_id', student.user_id).maybeSingle()).data
    }
    if (!profile || profile.status !== 'ACTIVE') return fail('INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không đúng.', 401)
    const authUser = (await admin.auth.admin.getUserById(profile.user_id)).data.user
    if (!authUser?.email) return fail('AUTH_IDENTITY_MISSING', 'Tài khoản chưa có định danh đăng nhập.', 500)
    const signedIn = await admin.auth.signInWithPassword({ email: authUser.email, password: body.password })
    if (signedIn.error || !signedIn.data.session) return fail('INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không đúng.', 401)
    await admin.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id)
    return ok({ session: signedIn.data.session, profile })
  } catch (error) {
    return fromError(error)
  }
})
