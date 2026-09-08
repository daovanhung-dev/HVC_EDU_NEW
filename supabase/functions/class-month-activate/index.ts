import { adminClient, requirePermission } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { notifyUsers } from '../_shared/notifications.ts'

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requirePermission(req, 'CLASS_MONTH_MANAGE')
    const body = await req.json() as { class_month_id?: string; override_conflicts?: boolean }
    if (!body.class_month_id) return fail('INVALID_INPUT', 'Thiếu class_month_id.')
    const admin = adminClient()
    const result = await admin.rpc('activate_class_month', { p_class_month_id: body.class_month_id, p_actor_user_id: caller.user.id, p_override_conflicts: body.override_conflicts || false })
    if (result.error) throw new Error(result.error.message)
    const [staff, students] = await Promise.all([
      admin.from('class_month_staff').select('staff(user_id)').eq('class_month_id', body.class_month_id),
      admin.from('class_month_students').select('students(user_id)').eq('class_month_id', body.class_month_id),
    ])
    const staffUsers = (staff.data || []).map((row: any) => Array.isArray(row.staff) ? row.staff[0]?.user_id : row.staff?.user_id)
    const studentUsers = (students.data || []).map((row: any) => Array.isArray(row.students) ? row.students[0]?.user_id : row.students?.user_id)
    await notifyUsers(admin, [...staffUsers, ...studentUsers], 'Lịch học tháng mới đã sẵn sàng', 'ClassMonth đã được kích hoạt và các buổi học đã được sinh.', { class_month_id: body.class_month_id })
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
