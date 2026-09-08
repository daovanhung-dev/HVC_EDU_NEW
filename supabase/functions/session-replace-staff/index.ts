import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyUsers } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { session_id?: string; original_staff_id?: string; replacement_staff_id?: string; reason?: string }
    if (!body.session_id || !body.original_staff_id || !body.replacement_staff_id || !body.reason) return fail('INVALID_INPUT', 'Thiếu dữ liệu dạy thay.')
    const admin = adminClient()
    const result = await admin.rpc('replace_session_staff', { p_session_id: body.session_id, p_original_staff_id: body.original_staff_id, p_replacement_staff_id: body.replacement_staff_id, p_reason: body.reason, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    const replacement = await admin.from('staff').select('user_id').eq('id', body.replacement_staff_id).maybeSingle()
    await notifyUsers(admin, replacement.data?.user_id ? [replacement.data.user_id] : [], 'Bạn được chỉ định dạy thay', 'Bạn đã được phân công dạy thay cho một session.', { session_id: body.session_id })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
