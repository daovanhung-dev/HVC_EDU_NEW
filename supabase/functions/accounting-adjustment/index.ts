import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'ACCOUNTING_MANAGE')
    const body = await req.json() as { direction?: 'INCOME' | 'EXPENSE'; category_id?: string; amount?: number; transaction_date?: string; payment_method?: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; description?: string }
    if (!body.direction || !body.category_id || !body.amount || body.amount < 0 || !body.description) return fail('INVALID_INPUT', 'Thiếu dữ liệu giao dịch điều chỉnh.')
    const admin = adminClient()
    const inserted = await admin.from('accounting_transactions').insert({ transaction_type: 'ADJUSTMENT', direction: body.direction, category_id: body.category_id, amount: Math.trunc(body.amount), transaction_date: body.transaction_date || new Date().toISOString().slice(0, 10), payment_method: body.payment_method || null, description: body.description, created_by: caller.user.id }).select('id,transaction_type,direction,amount,transaction_date').single()
    if (inserted.error) throw inserted.error
    await admin.rpc('write_audit', { p_actor_user_id: caller.user.id, p_action: 'ACCOUNTING_ADJUSTMENT', p_entity_type: 'accounting_transactions', p_entity_id: inserted.data.id, p_new_data: inserted.data, p_reason: body.description })
    return ok(inserted.data)
  } catch (error) { return fromError(error) }
})
