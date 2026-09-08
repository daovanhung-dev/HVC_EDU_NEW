import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { session_id?: string }
    if (!body.session_id) return fail('INVALID_INPUT', 'Thiếu session_id.')
    const result = await adminClient().rpc('start_session', { p_session_id: body.session_id, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
