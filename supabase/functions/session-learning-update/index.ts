import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'

interface StudentLearningInput {
  student_id?: string
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
  late_minutes?: number | null
  absence_reason?: string | null
  homework_score?: number | null
  homework_note?: string | null
  understanding_score?: number | null
  attitude_score?: number | null
  positive_feedback_count?: number | null
  positive_feedback_raw?: string | null
  comment?: string | null
}

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options
  try {
    const caller = await requireCaller(req)
    const body = await req.json() as { session_id?: string; session_note?: string | null; students?: StudentLearningInput[] }
    if (!body.session_id || !Array.isArray(body.students)) {
      return fail('INVALID_INPUT', 'Thiếu session_id hoặc danh sách học sinh.')
    }
    const result = await adminClient().rpc('update_session_learning', {
      p_session_id: body.session_id,
      p_actor_user_id: caller.user.id,
      p_session_note: body.session_note || null,
      p_students: body.students,
    })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
