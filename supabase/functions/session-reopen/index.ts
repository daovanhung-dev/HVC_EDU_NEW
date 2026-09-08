import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyUsers, sessionStaffUsers, sessionStudentUsers } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'ACADEMIC_MANAGE')
    const body = await req.json() as { session_id?: string; reason?: string }
    if (!body.session_id || !body.reason) return fail('INVALID_INPUT', 'Thiếu session_id hoặc reason.')
    const admin = adminClient()
    const result = await admin.rpc('reopen_session', { p_session_id: body.session_id, p_actor_user_id: caller.user.id, p_reason: body.reason })
    if (result.error) throw new Error(result.error.message)
    await notifyUsers(admin, [...await sessionStaffUsers(admin, body.session_id), ...await sessionStudentUsers(admin, body.session_id)], 'Buổi học được mở lại', 'Buổi học đã được mở lại để cập nhật dữ liệu.', { session_id: body.session_id })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
