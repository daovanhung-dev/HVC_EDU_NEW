import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'CLASS_MONTH_MANAGE')
    const body = await req.json() as { source_class_month_id?: string; year?: number; month?: number }
    if (!body.source_class_month_id || !body.year || !body.month) return fail('INVALID_INPUT', 'Thiếu tháng nguồn, năm hoặc tháng đích.')
    const result = await adminClient().rpc('copy_class_month', {
      p_source_class_month_id: body.source_class_month_id,
      p_year: body.year,
      p_month: body.month,
      p_actor_user_id: caller.user.id,
    })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
