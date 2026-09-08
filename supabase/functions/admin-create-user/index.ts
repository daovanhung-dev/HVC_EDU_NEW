import { adminClient, canManageRole, requireCaller, syntheticEmail, temporaryPassword } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { role?: string; username?: string; password?: string; email?: string; phone?: string; display_name?: string; student?: Record<string, unknown>; staff?: Record<string, unknown> }
    const role = body.role || ''
    if (!['ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT'].includes(role) || !canManageRole(caller, role)) return fail('FORBIDDEN', 'Bạn không có quyền tạo tài khoản này.', 403)
    const admin = adminClient()
    if (caller.profile.role !== 'ROOT_ADMIN') {
      const permission = role === 'STUDENT' ? 'STUDENTS_MANAGE' : 'STAFF_MANAGE'
      const allowed = await admin.rpc('actor_has_permission', { p_user_id: caller.user.id, p_permission_code: permission })
      if (allowed.error || !allowed.data) return fail('FORBIDDEN', 'Tài khoản chưa được cấp nhóm quyền phù hợp.', 403)
    }
    const displayName = body.display_name || String(body.student?.full_name || body.staff?.full_name || 'user')
    let username = body.username?.trim()
    if (!username) {
      const slug = displayName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'user'
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `${slug}${Math.floor(100 + Math.random() * 900)}`
        const exists = await admin.from('profiles').select('id').ilike('username', candidate).maybeSingle()
        if (!exists.data) { username = candidate; break }
      }
    }
    if (!username) throw new Error('USERNAME_GENERATION_FAILED')
    const password = body.password || temporaryPassword()
    const email = body.email || syntheticEmail(username)
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, phone: body.phone || undefined })
    if (created.error || !created.data.user) throw created.error || new Error('AUTH_CREATE_FAILED')
    const profile = await admin.from('profiles').insert({ user_id: created.data.user.id, role, username, display_name: displayName, email, phone: body.phone || null, created_by: caller.profile.id, force_password_change: false }).select('id,user_id,role,username,display_name').single()
    if (profile.error || !profile.data) {
      await admin.auth.admin.deleteUser(created.data.user.id)
      throw profile.error || new Error('PROFILE_CREATE_FAILED')
    }
    if (role === 'STUDENT') {
      let studentCode = body.student?.student_code as string | undefined
      if (!studentCode) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const candidate = `HS${String(Math.floor(100000 + Math.random() * 900000))}`
          const exists = await admin.from('students').select('id').eq('student_code', candidate).maybeSingle()
          if (!exists.data) { studentCode = candidate; break }
        }
      }
      if (!studentCode) throw new Error('STUDENT_CODE_GENERATION_FAILED')
      const student = await admin.from('students').insert({ user_id: created.data.user.id, student_code: studentCode, full_name: body.student?.full_name || body.display_name || body.username, parent_name: body.student?.parent_name || null, parent_phone: body.student?.parent_phone || null, email, phone: body.phone || null, created_by: caller.user.id }).select('id,student_code').single()
      if (student.error) { await admin.auth.admin.deleteUser(created.data.user.id); throw student.error }
    } else if (role !== 'ADMIN') {
      const staff = await admin.from('staff').insert({ user_id: created.data.user.id, staff_type: role, staff_code: body.staff?.staff_code || null, full_name: body.staff?.full_name || body.display_name || body.username, email, phone: body.phone || null, created_by: caller.user.id }).select('id,staff_code').single()
      if (staff.error) { await admin.auth.admin.deleteUser(created.data.user.id); throw staff.error }
    }
    await admin.rpc('write_audit', { p_actor_user_id: caller.user.id, p_action: 'ACCOUNT_CREATE', p_entity_type: 'profiles', p_entity_id: profile.data.id, p_new_data: { role, username } })
    return ok({ profile: profile.data, temporary_password: password })
  } catch (error) {
    return fromError(error)
  }
})
