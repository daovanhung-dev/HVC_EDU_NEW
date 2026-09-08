import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyPermission } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { session_id?: string; staff_id?: string; notes?: string }
    if (!body.session_id || !body.staff_id) return fail('INVALID_INPUT', 'Thiếu session_id hoặc staff_id.')
    const admin = adminClient()
    const result = await admin.rpc('submit_timesheet', { p_session_id: body.session_id, p_staff_id: body.staff_id, p_actor_user_id: caller.user.id, p_notes: body.notes || null })
    if (result.error) throw new Error(result.error.message)
    await notifyPermission(admin, 'TIMESHEET_APPROVE', 'Có chấm công mới chờ duyệt', 'Một nhân sự vừa gửi chấm công sau buổi học hoàn thành.', { timesheet_id: result.data?.timesheet_id })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
