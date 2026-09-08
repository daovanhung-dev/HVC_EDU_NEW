import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyUsers, sessionStudentUsers } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { session_id?: string }
    if (!body.session_id) return fail('INVALID_INPUT', 'Thiếu session_id.')
    const admin = adminClient()
    const result = await admin.rpc('complete_session', { p_session_id: body.session_id, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    await notifyUsers(admin, await sessionStudentUsers(admin, body.session_id), 'Buổi học đã hoàn thành', 'Điểm danh, BTVN và nhận xét của buổi học đã được cập nhật.', { session_id: body.session_id })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
