import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyUsers } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'PAYROLL_MANAGE')
    const body = await req.json() as { payroll_period_id?: string }
    if (!body.payroll_period_id) return fail('INVALID_INPUT', 'Thiếu payroll_period_id.')
    const admin = adminClient()
    const result = await admin.rpc('confirm_payroll', { p_payroll_period_id: body.payroll_period_id, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    const staff = await admin.from('payroll_items').select('staff(user_id)').eq('payroll_period_id', body.payroll_period_id)
    await notifyUsers(admin, (staff.data || []).map((row: any) => row.staff?.user_id), 'Bảng lương đã được chốt', 'Bảng lương của bạn đã được chốt.', { payroll_period_id: body.payroll_period_id })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
