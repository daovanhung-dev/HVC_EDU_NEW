import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req); if (options) return options
  try {
    const caller = await requireCaller(req)
    if (caller.profile.role !== 'ROOT_ADMIN') return fail('FORBIDDEN', 'Chỉ ROOT mới được thay đổi nhóm quyền.', 403)
    const body = await req.json() as { user_id?: string; permission_group_ids?: string[] }
    if (!body.user_id || !Array.isArray(body.permission_group_ids)) return fail('INVALID_INPUT', 'Thiếu tài khoản hoặc nhóm quyền.')
    const result = await adminClient().rpc('set_admin_permission_groups', { p_user_id: body.user_id, p_group_ids: body.permission_group_ids, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
