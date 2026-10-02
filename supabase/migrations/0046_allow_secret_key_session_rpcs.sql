begin;

-- The Edge Functions authenticate callers before invoking these service-only RPCs.
-- Supabase secret keys map to service_role without carrying a JWT role claim, so
-- the service_role-only EXECUTE grant is the database boundary for this path.
create or replace function public.start_session(p_session_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status public.session_status;
begin
  select status into v_status from public.sessions where id = p_session_id for update;
  if v_status is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status <> 'SCHEDULED' then raise exception 'SESSION_NOT_SCHEDULED'; end if;
  if not exists (
    select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
      and s.user_id = p_actor_user_id and s.status = 'ACTIVE'
  ) then raise exception 'SESSION_TEACHER_REQUIRED'; end if;
  update public.sessions set status = 'IN_PROGRESS', started_at = now(), started_by = p_actor_user_id where id = p_session_id;
  perform public.write_audit(p_actor_user_id, 'SESSION_START', 'sessions', p_session_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'IN_PROGRESS'));
  return jsonb_build_object('session_id', p_session_id, 'status', 'IN_PROGRESS');
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.sessions%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'IN_PROGRESS' then raise exception 'SESSION_NOT_IN_PROGRESS'; end if;
  if not exists (
    select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
      and s.user_id = p_actor_user_id and s.status = 'ACTIVE'
  ) then raise exception 'SESSION_TEACHER_REQUIRED'; end if;
  if exists (
    select 1 from public.session_students ss left join public.student_attendances sa
      on sa.session_id = ss.session_id and sa.student_id = ss.student_id
    where ss.session_id = p_session_id and sa.id is null
  ) then raise exception 'SESSION_NOT_COMPLETEABLE'; end if;
  update public.sessions set status = 'COMPLETED', ended_at = now(), ended_by = p_actor_user_id where id = p_session_id;
  perform public.write_audit(p_actor_user_id, 'SESSION_COMPLETE', 'sessions', p_session_id,
    jsonb_build_object('status', v_session.status), jsonb_build_object('status', 'COMPLETED'));
  return jsonb_build_object('session_id', p_session_id, 'status', 'COMPLETED');
end;
$$;

create or replace function public.update_session_learning(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_session_note text,
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

  select jsonb_build_object(
    'session_note', v_session.session_note,
    'attendance', coalesce(jsonb_agg(to_jsonb(a)) filter (where a.id is not null), '[]'::jsonb)
  ) into v_old
  from public.student_attendances a where a.session_id = p_session_id;

  update public.sessions set session_note = nullif(trim(p_session_note), '') where id = p_session_id;
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
    v_old, jsonb_build_object('session_note', p_session_note, 'students', coalesce(p_students, '[]'::jsonb), 'students_updated', v_count));
  return jsonb_build_object('session_id', p_session_id, 'students_updated', v_count);
end;
$$;

-- Keep all three RPCs private to the trusted Edge Function service client.
revoke all on function public.start_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_session_learning(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.start_session(uuid, uuid) to service_role;
grant execute on function public.complete_session(uuid, uuid) to service_role;
grant execute on function public.update_session_learning(uuid, uuid, text, jsonb) to service_role;

commit;
