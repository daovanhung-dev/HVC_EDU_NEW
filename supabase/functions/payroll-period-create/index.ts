import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'PAYROLL_MANAGE')
    const body = await req.json() as { year?: number; month?: number }
    if (!body.year || !body.month) return fail('INVALID_INPUT', 'Thiếu năm hoặc tháng.')
    const result = await adminClient().rpc('create_payroll_period', { p_year: body.year, p_month: body.month, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
