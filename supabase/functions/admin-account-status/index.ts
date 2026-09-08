import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { user_id?: string; status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED' }
    if (!body.user_id || !body.status || !['ACTIVE', 'INACTIVE', 'LOCKED'].includes(body.status)) return fail('INVALID_INPUT', 'Thiếu user_id hoặc status.')
    const result = await adminClient().rpc('set_account_status', { p_user_id: body.user_id, p_status: body.status, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
