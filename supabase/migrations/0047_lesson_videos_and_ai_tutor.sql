begin;

alter table public.sessions add column lesson_youtube_url text;

comment on column public.sessions.lesson_youtube_url is
  'Optional YouTube lesson recording link for this session.';

revoke all on public.sessions from authenticated;
grant select (id, class_id, recurrence_schedule_id, recurrence_occurrence_date,
  schedule_override, scheduled_start_at, scheduled_end_at, status, started_at, started_by, ended_at, ended_by,
  lesson_content, session_note, lesson_youtube_url, room, created_at, updated_at)
  on public.sessions to authenticated;

create or replace function public.update_session_learning(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_session_note text,
  p_lesson_youtube_url text,
  p_students jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_item record;
  v_old jsonb;
  v_new_lesson_url text;
  v_count integer := 0;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'IN_PROGRESS' then raise exception 'SESSION_LOCKED'; end if;
  if not exists (
    select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
      and s.user_id = p_actor_user_id and s.status = 'ACTIVE'
  ) then raise exception 'FORBIDDEN'; end if;

  v_new_lesson_url := case
    when p_lesson_youtube_url is null then v_session.lesson_youtube_url
    else nullif(trim(p_lesson_youtube_url), '')
  end;

  select jsonb_build_object(
    'session_note', v_session.session_note,
    'lesson_youtube_url', v_session.lesson_youtube_url,
    'attendance', coalesce(jsonb_agg(to_jsonb(a)) filter (where a.id is not null), '[]'::jsonb)
  ) into v_old
  from public.student_attendances a where a.session_id = p_session_id;

  update public.sessions
  set session_note = nullif(trim(p_session_note), ''), lesson_youtube_url = v_new_lesson_url
  where id = p_session_id;
  for v_item in
    select * from jsonb_to_recordset(coalesce(p_students, '[]'::jsonb)) as x(
      student_id uuid, status public.attendance_status, late_minutes integer,
      absence_reason text, homework_score numeric, homework_note text,
      understanding_score smallint, attitude_score smallint,
      positive_feedback_count integer, positive_feedback_raw text, comment text
    )
  loop
    if v_item.status is null then raise exception 'ATTENDANCE_STATUS_REQUIRED'; end if;
    if v_item.homework_score is not null and (v_item.homework_score < 0 or v_item.homework_score > 10) then raise exception 'INVALID_HOMEWORK_SCORE'; end if;
    if v_item.understanding_score is not null and (v_item.understanding_score < 1 or v_item.understanding_score > 5) then raise exception 'INVALID_UNDERSTANDING_SCORE'; end if;
    if v_item.attitude_score is not null and (v_item.attitude_score < 1 or v_item.attitude_score > 5) then raise exception 'INVALID_ATTITUDE_SCORE'; end if;
    if not exists (select 1 from public.session_students where session_id = p_session_id and student_id = v_item.student_id) then raise exception 'STUDENT_NOT_IN_SESSION'; end if;
    insert into public.student_attendances(
      session_id, student_id, status, late_minutes, absence_reason, homework_score,
      homework_note, understanding_score, attitude_score, positive_feedback_count,
      positive_feedback_raw, comment, updated_by
    ) values (
      p_session_id, v_item.student_id, v_item.status, v_item.late_minutes,
      nullif(trim(v_item.absence_reason), ''), v_item.homework_score,
      nullif(trim(v_item.homework_note), ''), v_item.understanding_score,
      v_item.attitude_score, v_item.positive_feedback_count,
      nullif(trim(v_item.positive_feedback_raw), ''), nullif(trim(v_item.comment), ''), p_actor_user_id
    )
    on conflict (session_id, student_id) do update set
      status = excluded.status, late_minutes = excluded.late_minutes,
      absence_reason = excluded.absence_reason, homework_score = excluded.homework_score,
      homework_note = excluded.homework_note, understanding_score = excluded.understanding_score,
      attitude_score = excluded.attitude_score, positive_feedback_count = excluded.positive_feedback_count,
      positive_feedback_raw = excluded.positive_feedback_raw, comment = excluded.comment,
      updated_by = excluded.updated_by;
    v_count := v_count + 1;
  end loop;
  perform public.write_audit(p_actor_user_id, 'SESSION_LEARNING_UPDATE', 'sessions', p_session_id,
    v_old, jsonb_build_object(
      'session_note', p_session_note,
      'lesson_youtube_url', v_new_lesson_url,
      'students', coalesce(p_students, '[]'::jsonb),
      'students_updated', v_count
    ));
  return jsonb_build_object('session_id', p_session_id, 'students_updated', v_count);
end;
$$;

-- Preserve the old service-only RPC for already-running Edge Function versions.
create or replace function public.update_session_learning(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_session_note text,
  p_students jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.update_session_learning(p_session_id, p_actor_user_id, p_session_note, null, p_students);
$$;

revoke all on function public.update_session_learning(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.update_session_learning(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_session_learning(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.update_session_learning(uuid, uuid, text, jsonb) to service_role;

commit;
