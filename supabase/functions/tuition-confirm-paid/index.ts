import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyUsers } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'ACCOUNTING_MANAGE')
    const body = await req.json() as { tuition_id?: string; payment_method?: 'CASH' | 'BANK_TRANSFER' | 'OTHER' }
    if (!body.tuition_id || !body.payment_method) return fail('INVALID_INPUT', 'Thiếu tuition_id hoặc payment_method.')
    const admin = adminClient()
    const target = await admin.from('tuition_records').select('student_id,students(user_id)').eq('id', body.tuition_id).maybeSingle()
    const result = await admin.rpc('confirm_tuition_paid', { p_tuition_id: body.tuition_id, p_actor_user_id: caller.user.id, p_payment_method: body.payment_method })
    if (result.error) throw new Error(result.error.message)
    const studentRelation: any = target.data?.students
    const targetUserId = (Array.isArray(studentRelation) ? studentRelation[0] : studentRelation)?.user_id
    await notifyUsers(admin, targetUserId ? [targetUserId] : [], 'Học phí đã được xác nhận', 'Trung tâm đã xác nhận học phí tháng của bạn.', { tuition_id: body.tuition_id })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
