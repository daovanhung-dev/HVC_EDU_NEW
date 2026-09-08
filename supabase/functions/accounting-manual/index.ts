import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'ACCOUNTING_MANAGE')
    const body = await req.json() as { direction?: 'INCOME' | 'EXPENSE'; category_id?: string; amount?: number; transaction_date?: string; payment_method?: 'CASH' | 'BANK_TRANSFER' | 'OTHER'; description?: string }
    if (!body.direction || !body.category_id || !body.amount || !body.description) return fail('INVALID_INPUT', 'Thiếu dữ liệu giao dịch.')
    const result = await adminClient().rpc('create_manual_transaction', { p_direction: body.direction, p_category_id: body.category_id, p_amount: Math.trunc(body.amount), p_transaction_date: body.transaction_date || null, p_payment_method: body.payment_method || null, p_description: body.description, p_actor_user_id: caller.user.id })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
