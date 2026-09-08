import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'PAYROLL_MANAGE')
    const body = await req.json() as { payroll_period_id?: string; staff_id?: string; adjustment_type?: 'BONUS' | 'PENALTY'; amount?: number; reason?: string }
    if (!body.payroll_period_id || !body.staff_id || !body.adjustment_type || !body.amount || !body.reason) return fail('INVALID_INPUT', 'Thiếu dữ liệu thưởng/phạt.')
    const result = await adminClient().rpc('add_salary_adjustment', { p_payroll_period_id: body.payroll_period_id, p_staff_id: body.staff_id, p_adjustment_type: body.adjustment_type, p_amount: Math.trunc(body.amount), p_reason: body.reason, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
