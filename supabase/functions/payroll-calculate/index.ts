import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'PAYROLL_MANAGE')
    const body = await req.json() as { payroll_period_id?: string; salary_method?: 'PERCENTAGE' | 'FIXED'; percentage?: number; fixed_amount?: number }
    if (!body.payroll_period_id || !body.salary_method) return fail('INVALID_INPUT', 'Thiếu dữ liệu tính lương.')
    const result = await adminClient().rpc('calculate_payroll', { p_payroll_period_id: body.payroll_period_id, p_actor_user_id: caller.user.id, p_salary_method: body.salary_method, p_percentage: body.percentage ?? null, p_fixed_amount: body.fixed_amount ?? null })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
