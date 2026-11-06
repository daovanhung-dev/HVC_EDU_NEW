begin;

create or replace function public.admin_correct_completed_session(
  p_session_id uuid,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_room text,
  p_session_note text,
  p_lesson_youtube_url text,
  p_students jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_item record;
  v_student_ids uuid[];
  v_staff_ids uuid[];
  v_room text := nullif(btrim(p_room), '');
  v_note text := nullif(btrim(p_session_note), '');
  v_url text := nullif(btrim(p_lesson_youtube_url), '');
  v_video_valid boolean := false;
  v_roster_count integer;
  v_attendance_count integer;
  v_input_count integer;
  v_distinct_input_count integer;
  v_updated_count integer := 0;
  v_conflict_reason text;
  v_old_attendance jsonb;
  v_new_attendance jsonb;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null
     or p_scheduled_start_at is null
     or p_scheduled_end_at is null
     or p_scheduled_end_at <= p_scheduled_start_at
     or (p_scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
        <> (p_scheduled_end_at at time zone 'Asia/Ho_Chi_Minh')::date
     or p_scheduled_end_at > now()
     or p_students is null
     or jsonb_typeof(p_students) <> 'array'
     or length(coalesce(p_session_note, '')) > 10000 then
    raise exception 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  select * into v_session
  from public.sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'COMPLETED' then raise exception 'SESSION_NOT_COMPLETED'; end if;

  if v_url is not null then
    if v_url ~* '^https?://(www\.)?youtu\.be/[A-Za-z0-9_-]{11}([?#].*)?$' then
      v_video_valid := true;
    elsif v_url ~* '^https?://(www\.)?(youtube\.com|m\.youtube\.com|youtube-nocookie\.com)/(watch\?[^#]*v=[A-Za-z0-9_-]{11}(&[^#]*)?|embed/[A-Za-z0-9_-]{11}([?#].*)?|shorts/[A-Za-z0-9_-]{11}([?#].*)?|live/[A-Za-z0-9_-]{11}([?#].*)?)$' then
      v_video_valid := true;
    end if;
    if not v_video_valid then raise exception 'INVALID_YOUTUBE_URL'; end if;
  end if;

  select count(*)::integer,
         coalesce(array_agg(ss.student_id order by ss.student_id), '{}'::uuid[])
    into v_roster_count, v_student_ids
  from public.session_students ss
  where ss.session_id = p_session_id;
  select count(*)::integer into v_attendance_count
  from public.student_attendances sa
  where sa.session_id = p_session_id;
  if v_roster_count = 0 or v_attendance_count <> v_roster_count then
    raise exception 'SESSION_ATTENDANCE_INCOMPLETE';
  end if;

  v_input_count := jsonb_array_length(p_students);
  select count(distinct x.student_id)::integer
    into v_distinct_input_count
  from jsonb_to_recordset(p_students) as x(student_id uuid);
  if v_distinct_input_count <> v_input_count then raise exception 'DUPLICATE_STUDENT'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_students) as x(student_id uuid)
    where x.student_id is null
  ) or v_input_count <> v_roster_count
     or exists (
       select 1 from jsonb_to_recordset(p_students) as x(student_id uuid)
       where not (x.student_id = any(v_student_ids))
     )
     or exists (
       select 1 from unnest(v_student_ids) roster(student_id)
       where not exists (
         select 1 from jsonb_to_recordset(p_students) as x(student_id uuid)
         where x.student_id = roster.student_id
       )
     ) then
    raise exception 'SESSION_ROSTER_MISMATCH';
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_students) as x(
      student_id uuid, status public.attendance_status, late_minutes integer,
      absence_reason text, homework_score numeric, homework_note text,
      understanding_score smallint, attitude_score smallint,
      positive_feedback_count integer, positive_feedback_raw text, comment text
    )
  loop
    if v_item.status is null then raise exception 'ATTENDANCE_STATUS_REQUIRED'; end if;
    if v_item.late_minutes is not null and v_item.late_minutes < 0 then raise exception 'INVALID_LATE_MINUTES'; end if;
    if v_item.homework_score is not null and (v_item.homework_score < 0 or v_item.homework_score > 10) then
      raise exception 'INVALID_HOMEWORK_SCORE';
    end if;
    if v_item.understanding_score is not null and (v_item.understanding_score < 1 or v_item.understanding_score > 5) then
      raise exception 'INVALID_UNDERSTANDING_SCORE';
    end if;
    if v_item.attitude_score is not null and (v_item.attitude_score < 1 or v_item.attitude_score > 5) then
      raise exception 'INVALID_ATTITUDE_SCORE';
    end if;
    if v_item.positive_feedback_count is not null and v_item.positive_feedback_count < 0 then
      raise exception 'INVALID_FEEDBACK_COUNT';
    end if;
    if v_item.comment is not null and length(v_item.comment) > 2000 then raise exception 'INVALID_COMMENT'; end if;
  end loop;

  select coalesce(array_agg(ss.staff_id order by ss.staff_id), '{}'::uuid[])
    into v_staff_ids
  from public.session_staff ss
  where ss.session_id = p_session_id;
  if cardinality(v_staff_ids) > 0 and exists (
    select 1
    from public.sessions other
    join public.session_staff assigned on assigned.session_id = other.id
    where other.id <> p_session_id
      and (
        other.status in ('SCHEDULED', 'IN_PROGRESS')
        or (p_scheduled_start_at <= now() and other.status = 'COMPLETED')
      )
      and other.scheduled_start_at < p_scheduled_end_at
      and other.scheduled_end_at > p_scheduled_start_at
      and assigned.staff_id = any(v_staff_ids)
  ) then
    raise exception 'SCHEDULE_CONFLICT';
  end if;

  v_conflict_reason := public.session_schedule_conflict_reason(
    p_session_id, v_session.class_id, p_scheduled_start_at, p_scheduled_end_at, v_room, v_student_ids
  );
  if v_conflict_reason is not null then
    raise exception using message = v_conflict_reason;
  end if;

  select coalesce(jsonb_agg(to_jsonb(sa) order by sa.student_id), '[]'::jsonb)
    into v_old_attendance
  from public.student_attendances sa
  where sa.session_id = p_session_id;

  update public.sessions
  set scheduled_start_at = p_scheduled_start_at,
      scheduled_end_at = p_scheduled_end_at,
      room = v_room,
      room_override = room_override or (v_room is distinct from room),
      schedule_override = true,
      session_note = v_note,
      lesson_youtube_url = v_url
  where id = p_session_id;

  for v_item in
    select * from jsonb_to_recordset(p_students) as x(
      student_id uuid, status public.attendance_status, late_minutes integer,
      absence_reason text, homework_score numeric, homework_note text,
      understanding_score smallint, attitude_score smallint,
      positive_feedback_count integer, positive_feedback_raw text, comment text
    )
  loop
    update public.student_attendances
    set status = v_item.status,
        late_minutes = v_item.late_minutes,
        absence_reason = nullif(btrim(v_item.absence_reason), ''),
        homework_score = v_item.homework_score,
        homework_note = nullif(btrim(v_item.homework_note), ''),
        understanding_score = v_item.understanding_score,
        attitude_score = v_item.attitude_score,
        positive_feedback_count = v_item.positive_feedback_count,
        positive_feedback_raw = nullif(btrim(v_item.positive_feedback_raw), ''),
        comment = nullif(btrim(v_item.comment), ''),
        updated_by = auth.uid()
    where session_id = p_session_id and student_id = v_item.student_id;
    get diagnostics v_input_count = row_count;
    if v_input_count <> 1 then raise exception 'ATTENDANCE_RECORD_NOT_FOUND'; end if;
    v_updated_count := v_updated_count + 1;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(sa) order by sa.student_id), '[]'::jsonb)
    into v_new_attendance
  from public.student_attendances sa
  where sa.session_id = p_session_id;

  perform public.write_audit(auth.uid(), 'SESSION_COMPLETED_CORRECTION', 'sessions', p_session_id,
    jsonb_build_object(
      'status', v_session.status,
      'scheduled_start_at', v_session.scheduled_start_at,
      'scheduled_end_at', v_session.scheduled_end_at,
      'room', v_session.room,
      'session_note', v_session.session_note,
      'lesson_youtube_url', v_session.lesson_youtube_url,
      'attendance', v_old_attendance
    ),
    jsonb_build_object(
      'status', v_session.status,
      'scheduled_start_at', p_scheduled_start_at,
      'scheduled_end_at', p_scheduled_end_at,
      'room', v_room,
      'session_note', v_note,
      'lesson_youtube_url', v_url,
      'attendance', v_new_attendance,
      'students_updated', v_updated_count
    ));

  return jsonb_build_object(
    'session_id', p_session_id,
    'status', 'COMPLETED',
    'students_updated', v_updated_count
  );
end;
$$;

revoke all on function public.admin_correct_completed_session(uuid, timestamptz, timestamptz, text, text, text, jsonb)
  from public, anon;
grant execute on function public.admin_correct_completed_session(uuid, timestamptz, timestamptz, text, text, text, jsonb)
  to authenticated;

comment on function public.admin_correct_completed_session(uuid, timestamptz, timestamptz, text, text, text, jsonb)
  is 'Atomically corrects schedule, learning notes, and attendance data for a fully attended completed session without changing roster, teachers, timesheets, or financial snapshots.';

commit;
