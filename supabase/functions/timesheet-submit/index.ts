import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    if (caller.profile.role !== 'TEACHER') throw new Error('FORBIDDEN')
    const body = await req.json() as { session_id?: string; notes?: string | null }
    if (!body.session_id || (body.notes != null && typeof body.notes !== 'string')) {
      return fail('INVALID_INPUT', 'Thông tin chấm công không hợp lệ.')
    }

    const admin = adminClient()
    const { data: staff, error: staffError } = await admin.from('staff')
      .select('id,staff_type,status')
      .eq('user_id', caller.user.id)
      .maybeSingle()
    if (staffError) throw new Error(staffError.message)
    if (!staff || staff.status !== 'ACTIVE' || staff.staff_type !== 'TEACHER') throw new Error('STAFF_NOT_FOUND')

    const { data, error } = await admin.rpc('submit_timesheet', {
      p_session_id: body.session_id,
      p_staff_id: staff.id,
      p_actor_user_id: caller.user.id,
      p_notes: body.notes?.trim() || null,
    })
    if (error) throw new Error(error.message)
    return ok(data)
  } catch (error) { return fromError(error) }
})
