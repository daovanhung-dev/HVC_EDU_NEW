import { adminClient, requireCaller } from '../_shared/auth.ts'
import { handleOptions } from '../_shared/cors.ts'
import { fail, fromError, ok } from '../_shared/response.ts'
import { isYouTubeLink } from './youtube.ts'

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
    const body = await req.json() as { session_id?: string; session_note?: string | null; lesson_youtube_url?: string | null; students?: StudentLearningInput[] }
    if (!body.session_id || !Array.isArray(body.students)) {
      return fail('INVALID_INPUT', 'Thiếu session_id hoặc danh sách học sinh.')
    }
    if (body.lesson_youtube_url !== undefined && body.lesson_youtube_url !== null && typeof body.lesson_youtube_url !== 'string') {
      return fail('INVALID_INPUT', 'Link video không hợp lệ.')
    }
    const lessonUrl = typeof body.lesson_youtube_url === 'string' ? body.lesson_youtube_url.trim() : null
    if (lessonUrl && !isYouTubeLink(lessonUrl)) return fail('INVALID_INPUT', 'Chỉ chấp nhận link video YouTube hợp lệ.')
    const result = await adminClient().rpc('update_session_learning', {
      p_session_id: body.session_id,
      p_actor_user_id: caller.user.id,
      p_session_note: body.session_note || null,
      p_lesson_youtube_url: lessonUrl,
      p_students: body.students,
    })
    if (result.error) throw new Error(result.error.message)
    return ok(result.data)
  } catch (error) { return fromError(error) }
})
