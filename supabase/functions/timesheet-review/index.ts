import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'TIMESHEET_APPROVE')
    const body = await req.json() as { timesheet_id?: string; approve?: boolean; reason?: string | null }
    if (!body.timesheet_id || typeof body.approve !== 'boolean'
      || (body.reason != null && typeof body.reason !== 'string')) {
      return fail('INVALID_INPUT', 'Thông tin duyệt chấm công không hợp lệ.')
    }
    const reason = body.reason?.trim() || null
    if (!body.approve && !reason) return fail('REJECTION_REASON_REQUIRED', 'Nhập lý do trước khi từ chối chấm công.')

    const { data, error } = await adminClient().rpc('approve_timesheet', {
      p_timesheet_id: body.timesheet_id,
      p_actor_user_id: caller.user.id,
      p_approve: body.approve,
      p_reason: reason,
    })
    if (error) throw new Error(error.message)
    return ok(data)
  } catch (error) { return fromError(error) }
})
