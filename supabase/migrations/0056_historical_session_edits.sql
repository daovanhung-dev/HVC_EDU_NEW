-- Allow Admin to correct historical session data without changing lifecycle
-- status, actual start/end timestamps, timesheets, or stored financial snapshots.

create or replace function public.admin_update_session_schedule(
  p_session_id uuid,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_room text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_student_ids uuid[];
  v_staff_ids uuid[];
  v_room text := nullif(btrim(p_room), '');
  v_conflict_reason text;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null or p_scheduled_start_at is null or p_scheduled_end_at is null
     or p_scheduled_end_at <= p_scheduled_start_at
     or (p_scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
        <> (p_scheduled_end_at at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status = 'CANCELLED' then raise exception 'SESSION_LOCKED'; end if;
  if v_session.status in ('IN_PROGRESS', 'COMPLETED') and p_scheduled_end_at > now() then
    raise exception 'HISTORICAL_SESSION_MUST_REMAIN_PAST';
  end if;

  select coalesce(array_agg(student_id order by student_id), '{}'::uuid[])
    into v_student_ids
  from public.session_students where session_id = p_session_id;
  select coalesce(array_agg(staff_id order by staff_id), '{}'::uuid[])
    into v_staff_ids
  from public.session_staff
  where session_id = p_session_id and assignment_role = 'TEACHER';

  if cardinality(v_staff_ids) > 0 and exists (
    select 1
    from public.sessions other
    join public.session_staff assigned on assigned.session_id = other.id
    where other.id <> p_session_id
      and other.status in ('SCHEDULED', 'IN_PROGRESS')
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

  update public.sessions
  set scheduled_start_at = p_scheduled_start_at,
      scheduled_end_at = p_scheduled_end_at,
      room = v_room,
      room_override = room_override or (v_room is distinct from room),
      schedule_override = true
  where id = p_session_id;

  perform public.write_audit(auth.uid(), 'SESSION_SCHEDULE_CORRECTION', 'sessions', p_session_id,
    jsonb_build_object('status', v_session.status,
      'scheduled_start_at', v_session.scheduled_start_at,
      'scheduled_end_at', v_session.scheduled_end_at,
      'room', v_session.room),
    jsonb_build_object('status', v_session.status,
      'scheduled_start_at', p_scheduled_start_at,
      'scheduled_end_at', p_scheduled_end_at,
      'room', v_room));
  return jsonb_build_object('session_id', p_session_id, 'status', v_session.status, 'room', v_room);
end;
$$;

revoke all on function public.admin_update_session_schedule(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_update_session_schedule(uuid, timestamptz, timestamptz, text) to authenticated;

-- Teacher reassignment follows the same CLASS_MANAGE/active-teacher rules as
-- the existing command, while allowing every non-cancelled occurrence.
create or replace function public.admin_update_session_teachers(
  p_session_id uuid,
  p_staff_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_old_staff_ids uuid[];
  v_count integer := 0;
  v_student_count integer;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null or p_staff_ids is null or cardinality(p_staff_ids) = 0 then
    raise exception 'INVALID_INPUT';
  end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status = 'CANCELLED' then raise exception 'SESSION_LOCKED'; end if;

  select count(distinct staff_id)::integer into v_count
  from unnest(p_staff_ids) as staff(staff_id);
  if v_count <> cardinality(p_staff_ids) then raise exception 'DUPLICATE_TEACHER'; end if;
  select count(*)::integer into v_count
  from public.staff
  where id = any(p_staff_ids) and status = 'ACTIVE' and staff_type = 'TEACHER';
  if v_count <> cardinality(p_staff_ids) then raise exception 'TEACHER_NOT_ACTIVE'; end if;

  if exists (
    select 1
    from public.sessions other
    where other.id <> p_session_id
      and other.status in ('SCHEDULED', 'IN_PROGRESS')
      and other.scheduled_start_at < v_session.scheduled_end_at
      and other.scheduled_end_at > v_session.scheduled_start_at
      and exists (
        select 1 from public.session_staff assigned
        where assigned.session_id = other.id and assigned.staff_id = any(p_staff_ids)
      )
  ) then
    raise exception 'SCHEDULE_CONFLICT';
  end if;

  select coalesce(array_agg(staff_id order by staff_id), '{}'::uuid[])
    into v_old_staff_ids
  from public.session_staff
  where session_id = p_session_id and assignment_role = 'TEACHER';
  select count(*)::integer into v_student_count
  from public.session_students where session_id = p_session_id;

  delete from public.session_staff where session_id = p_session_id and assignment_role = 'TEACHER';
  insert into public.session_staff(session_id, staff_id, assignment_role)
  select p_session_id, staff_id, 'TEACHER'
  from unnest(p_staff_ids) as teachers(staff_id);
  update public.sessions set staff_assignment_override = true where id = p_session_id;

  perform public.write_audit(auth.uid(), 'SESSION_TEACHERS_UPDATE', 'sessions', p_session_id,
    jsonb_build_object('staff_ids', v_old_staff_ids),
    jsonb_build_object('staff_ids', p_staff_ids, 'roster_count', v_student_count));
  return jsonb_build_object('session_id', p_session_id, 'staff_ids', p_staff_ids, 'override', true);
end;
$$;

-- Roster reconciliation continues to use membership effective on the
-- session's business date and retains rows that carry learning/financial data.
create or replace function public.apply_session_student_roster(
  p_session_id uuid,
  p_student_ids uuid[],
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_session_date date;
  v_student_id uuid;
  v_conflict_reason text;
  v_valid_count integer;
  v_added integer := 0;
  v_removed integer := 0;
  v_retained integer := 0;
  v_before uuid[];
  v_after uuid[];
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null or p_action is null or p_action not in ('MANUAL', 'SYNC')
     or (p_action = 'MANUAL' and p_student_ids is null) then
    raise exception 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.class_memberships in share mode;
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status = 'CANCELLED' then raise exception 'SESSION_LOCKED'; end if;
  v_session_date := (v_session.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date;

  if p_action = 'SYNC' then
    select coalesce(array_agg(distinct cm.student_id order by cm.student_id), '{}'::uuid[])
      into p_student_ids
    from public.class_memberships cm
    join public.students st on st.id = cm.student_id
    where cm.class_id = v_session.class_id
      and cm.status = 'ACTIVE'
      and st.status = 'ACTIVE'
      and cm.start_date <= v_session_date
      and (cm.end_date is null or cm.end_date >= v_session_date);
  end if;

  if cardinality(p_student_ids) <> (
    select count(distinct requested.student_id)::integer
    from unnest(p_student_ids) requested(student_id)
  ) then
    raise exception 'DUPLICATE_STUDENT';
  end if;
  select count(distinct requested.student_id)::integer into v_valid_count
  from unnest(p_student_ids) requested(student_id)
  join public.class_memberships cm on cm.student_id = requested.student_id
    and cm.class_id = v_session.class_id
    and cm.status = 'ACTIVE'
    and cm.start_date <= v_session_date
    and (cm.end_date is null or cm.end_date >= v_session_date)
  join public.students st on st.id = cm.student_id and st.status = 'ACTIVE';
  if v_valid_count <> cardinality(p_student_ids) then
    raise exception 'STUDENT_NOT_IN_CLASS_ON_SESSION_DATE';
  end if;

  select coalesce(array_agg(ss.student_id order by ss.student_id), '{}'::uuid[])
    into v_before from public.session_students ss where ss.session_id = p_session_id;
  for v_student_id in
    select requested.student_id from unnest(p_student_ids) requested(student_id)
    where not exists (
      select 1 from public.session_students ss
      where ss.session_id = p_session_id and ss.student_id = requested.student_id
    )
    order by requested.student_id
  loop
    v_conflict_reason := public.session_schedule_conflict_reason(
      p_session_id, v_session.class_id, v_session.scheduled_start_at,
      v_session.scheduled_end_at, v_session.room, array[v_student_id]::uuid[]
    );
    if v_conflict_reason is not null then
      raise exception using message = v_conflict_reason;
    end if;
  end loop;

  select count(*)::integer into v_retained
  from public.session_students ss
  where ss.session_id = p_session_id
    and not (ss.student_id = any(p_student_ids))
    and (
      exists (select 1 from public.student_attendances sa where sa.session_id = ss.session_id and sa.student_id = ss.student_id)
      or ss.assessment_snapshot <> '{}'::jsonb
      or ss.monthly_fee_snapshot is not null
      or ss.session_unit_value is not null
    );
  delete from public.session_students ss
  where ss.session_id = p_session_id
    and not (ss.student_id = any(p_student_ids))
    and not exists (
      select 1 from public.student_attendances sa
      where sa.session_id = ss.session_id and sa.student_id = ss.student_id
    )
    and ss.assessment_snapshot = '{}'::jsonb
    and ss.monthly_fee_snapshot is null
    and ss.session_unit_value is null;
  get diagnostics v_removed = row_count;

  insert into public.session_students(session_id, student_id)
  select p_session_id, requested.student_id
  from unnest(p_student_ids) requested(student_id)
  where not exists (
    select 1 from public.session_students ss
    where ss.session_id = p_session_id and ss.student_id = requested.student_id
  )
  on conflict (session_id, student_id) do nothing;
  get diagnostics v_added = row_count;

  select coalesce(array_agg(ss.student_id order by ss.student_id), '{}'::uuid[])
    into v_after from public.session_students ss where ss.session_id = p_session_id;
  if v_before is distinct from v_after then
    perform public.write_audit(
      auth.uid(),
      case when p_action = 'SYNC' then 'SESSION_ROSTER_SYNC' else 'SESSION_ROSTER_UPDATE' end,
      'sessions', p_session_id,
      jsonb_build_object('student_ids', v_before),
      jsonb_build_object('student_ids', v_after, 'added', v_added,
        'removed', v_removed, 'retained_with_history', v_retained)
    );
  end if;
  return jsonb_build_object('session_id', p_session_id, 'added', v_added,
    'removed', v_removed, 'retained_with_history', v_retained,
    'student_count', cardinality(v_after));
end;
$$;

comment on function public.apply_session_student_roster(uuid, uuid[], text) is
  'Admin roster update for any non-cancelled session using memberships effective on the session date; rows with learning or financial history are retained.';

create or replace function public.admin_correct_session_learning(
  p_session_id uuid,
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
  v_url text := nullif(btrim(p_lesson_youtube_url), '');
  v_video_id text;
  v_old_attendance jsonb;
  v_new_attendance jsonb;
  v_count integer := 0;
  v_note text := nullif(btrim(p_session_note), '');
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null or p_students is null or jsonb_typeof(p_students) <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status = 'CANCELLED'
     or (v_session.status = 'SCHEDULED' and v_session.scheduled_start_at > now()) then
    raise exception 'SESSION_LOCKED';
  end if;

  if v_url is not null then
    if v_url ~* '^https?://(www\.)?youtu\.be/[A-Za-z0-9_-]{11}([?#].*)?$' then
      v_video_id := 'valid';
    elsif v_url ~* '^https?://(www\.)?(youtube\.com|m\.youtube\.com|youtube-nocookie\.com)/(watch\?[^#]*v=[A-Za-z0-9_-]{11}(&[^#]*)?|embed/[A-Za-z0-9_-]{11}([?#].*)?|shorts/[A-Za-z0-9_-]{11}([?#].*)?|live/[A-Za-z0-9_-]{11}([?#].*)?)$' then
      v_video_id := 'valid';
    end if;
    if v_video_id is null then raise exception 'INVALID_YOUTUBE_URL'; end if;
  end if;

  select count(distinct x.student_id)::integer into v_count
  from jsonb_to_recordset(p_students) as x(student_id uuid);
  if v_count <> jsonb_array_length(p_students) then raise exception 'DUPLICATE_STUDENT'; end if;

  select coalesce(jsonb_agg(to_jsonb(sa) order by sa.student_id), '[]'::jsonb)
    into v_old_attendance
  from public.student_attendances sa
  join jsonb_to_recordset(p_students) as x(student_id uuid)
    on x.student_id = sa.student_id
  where sa.session_id = p_session_id;

  update public.sessions
  set session_note = v_note, lesson_youtube_url = v_url
  where id = p_session_id;

  for v_item in
    select * from jsonb_to_recordset(p_students) as x(
      student_id uuid, status public.attendance_status, late_minutes integer,
      absence_reason text, homework_score numeric, homework_note text,
      understanding_score smallint, attitude_score smallint,
      positive_feedback_count integer, positive_feedback_raw text, comment text
    )
  loop
    if v_item.student_id is null or v_item.status is null then
      raise exception 'ATTENDANCE_STATUS_REQUIRED';
    end if;
    if v_item.late_minutes is not null and v_item.late_minutes < 0 then
      raise exception 'INVALID_LATE_MINUTES';
    end if;
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
    if v_item.comment is not null and length(v_item.comment) > 2000 then
      raise exception 'INVALID_COMMENT';
    end if;
    if not exists (
      select 1 from public.session_students ss
      where ss.session_id = p_session_id and ss.student_id = v_item.student_id
    ) then
      raise exception 'STUDENT_NOT_IN_SESSION';
    end if;

    insert into public.student_attendances(
      session_id, student_id, status, late_minutes, absence_reason, homework_score,
      homework_note, understanding_score, attitude_score, positive_feedback_count,
      positive_feedback_raw, comment, updated_by
    ) values (
      p_session_id, v_item.student_id, v_item.status, v_item.late_minutes,
      nullif(btrim(v_item.absence_reason), ''), v_item.homework_score,
      nullif(btrim(v_item.homework_note), ''), v_item.understanding_score,
      v_item.attitude_score, v_item.positive_feedback_count,
      nullif(btrim(v_item.positive_feedback_raw), ''), nullif(btrim(v_item.comment), ''), auth.uid()
    )
    on conflict (session_id, student_id) do update set
      status = excluded.status,
      late_minutes = excluded.late_minutes,
      absence_reason = excluded.absence_reason,
      homework_score = excluded.homework_score,
      homework_note = excluded.homework_note,
      understanding_score = excluded.understanding_score,
      attitude_score = excluded.attitude_score,
      positive_feedback_count = excluded.positive_feedback_count,
      positive_feedback_raw = excluded.positive_feedback_raw,
      comment = excluded.comment,
      updated_by = excluded.updated_by;
    v_count := v_count + 1;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(sa) order by sa.student_id), '[]'::jsonb)
    into v_new_attendance
  from public.student_attendances sa
  join jsonb_to_recordset(p_students) as x(student_id uuid)
    on x.student_id = sa.student_id
  where sa.session_id = p_session_id;

  perform public.write_audit(auth.uid(), 'SESSION_ADMIN_LEARNING_CORRECTION', 'sessions', p_session_id,
    jsonb_build_object('session_note', v_session.session_note,
      'lesson_youtube_url', v_session.lesson_youtube_url, 'attendance', v_old_attendance),
    jsonb_build_object('session_note', v_note,
      'lesson_youtube_url', v_url, 'attendance', v_new_attendance, 'students_updated', v_count));
  return jsonb_build_object('session_id', p_session_id, 'students_updated', v_count);
end;
$$;

revoke all on function public.admin_correct_session_learning(uuid, text, text, jsonb) from public, anon;
grant execute on function public.admin_correct_session_learning(uuid, text, text, jsonb) to authenticated;
