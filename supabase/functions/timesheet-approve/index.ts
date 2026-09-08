import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyUsers } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'TIMESHEET_APPROVE')
    const body = await req.json() as { timesheet_id?: string; approve?: boolean; reason?: string }
    if (!body.timesheet_id || body.approve === undefined) return fail('INVALID_INPUT', 'Thiếu timesheet_id hoặc approve.')
    const admin = adminClient()
    const target = await admin.from('timesheets').select('staff(user_id)').eq('id', body.timesheet_id).maybeSingle()
    const result = await admin.rpc('approve_timesheet', { p_timesheet_id: body.timesheet_id, p_actor_user_id: caller.user.id, p_approve: body.approve, p_reason: body.reason || null })
    if (result.error) throw new Error(result.error.message)
    const staffRelation: any = target.data?.staff
    const targetUserId = (Array.isArray(staffRelation) ? staffRelation[0] : staffRelation)?.user_id
    await notifyUsers(admin, targetUserId ? [targetUserId] : [], body.approve ? 'Chấm công đã được duyệt' : 'Chấm công bị từ chối', body.approve ? 'Chấm công của bạn đã được duyệt.' : `Chấm công cần gửi lại: ${body.reason || 'Vui lòng kiểm tra lại.'}`, { timesheet_id: body.timesheet_id, status: result.data?.status })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
