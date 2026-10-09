-- Per-session administration: safe roster reconciliation, hard delete for empty future
-- occurrences, and tombstones that prevent deleted recurring occurrences from returning.

create table public.deleted_session_occurrences (
  class_schedule_id uuid not null references public.class_schedules(id) on delete cascade,
  occurrence_date date not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  primary key (class_schedule_id, occurrence_date)
);

revoke all on public.deleted_session_occurrences from public, anon, authenticated, service_role;

comment on table public.deleted_session_occurrences is
  'Internal tombstones for future recurring occurrences that Admin deleted before any learning or attendance data existed.';

-- Keep migration 0054's public wrapper and roster sync. Replace only its private
-- recurring generator so it skips the deleted occurrence dates.
create or replace function public.generate_upcoming_sessions_before_manual_roster_sync(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_schedule record;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_session_id uuid;
  v_status public.session_status;
  v_schedule_override boolean;
  v_staff_override boolean;
  v_room_override boolean;
  v_was_cancelled boolean;
  v_room text;
  v_students uuid[];
  v_teachers uuid[];
  v_archived_session record;
  v_created integer := 0;
  v_refreshed integer := 0;
  v_cancelled integer := 0;
  v_room_conflicts integer := 0;
  v_missing_room_conflicts integer := 0;
  v_conflict_reason text;
  v_row_count integer := 0;
begin
  if auth.uid() is not null and not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_days < 1 or p_days > 90 then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  for v_schedule in
    select cs.*, c.status as class_status
    from public.class_schedules cs join public.classes c on c.id = cs.class_id
    where cs.status = 'ACTIVE' and cs.reviewed_at is not null and c.status = 'ACTIVE'
    order by cs.id
  loop
    for v_day in
      select d::date from generate_series(v_today, v_today + (p_days - 1), interval '1 day') d
      where extract(isodow from d)::int = v_schedule.day_of_week
        and not exists (
          select 1 from public.deleted_session_occurrences excluded
          where excluded.class_schedule_id = v_schedule.id
            and excluded.occurrence_date = d::date
        )
        and not exists (
          select 1 from public.class_schedule_month_overrides month_override
          where month_override.month_start = date_trunc('month', d::date)::date
        )
    loop
      select array_agg(distinct cm.student_id order by cm.student_id)
      into v_students
      from public.class_memberships cm join public.students st on st.id = cm.student_id
      where cm.class_id = v_schedule.class_id and cm.status = 'ACTIVE' and st.status = 'ACTIVE'
        and cm.start_date <= v_day and coalesce(cm.end_date, 'infinity'::date) >= v_day;
      select array_agg(css.staff_id order by css.staff_id)
      into v_teachers
      from public.class_schedule_staff css join public.staff st on st.id = css.staff_id
      where css.schedule_id = v_schedule.id and st.status = 'ACTIVE' and st.staff_type = 'TEACHER';
      v_start := ((v_day + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh');
      v_end := ((v_day + v_schedule.end_time) at time zone 'Asia/Ho_Chi_Minh');
      v_room := nullif(btrim(v_schedule.room), '');
      v_session_id := null;
      v_status := null;
      v_schedule_override := false;
      v_staff_override := false;
      v_room_override := false;
      v_was_cancelled := false;
      select s.id, s.status, s.schedule_override, s.staff_assignment_override, s.room_override
      into v_session_id, v_status, v_schedule_override, v_staff_override, v_room_override
      from public.sessions s
      where s.recurrence_schedule_id = v_schedule.id and s.recurrence_occurrence_date = v_day
      for update;
      if v_session_id is null then
        select s.id, s.status, s.schedule_override, s.staff_assignment_override, s.room_override
        into v_session_id, v_status, v_schedule_override, v_staff_override, v_room_override
        from public.sessions s
        where s.class_id = v_schedule.class_id and s.scheduled_start_at = v_start
          and not s.manual_schedule
          and s.status in ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')
        order by s.created_at limit 1 for update;
        if v_session_id is not null and v_status = 'SCHEDULED' then
          update public.sessions set recurrence_schedule_id = v_schedule.id, recurrence_occurrence_date = v_day where id = v_session_id;
        end if;
      end if;
      v_was_cancelled := coalesce(v_status = 'CANCELLED', false);
      if v_session_id is not null and v_room_override then
        select s.room into v_room from public.sessions s where s.id = v_session_id;
      end if;

      if v_session_id is not null and v_status = 'SCHEDULED' and v_schedule_override then
        select s.scheduled_start_at, s.scheduled_end_at into v_start, v_end
        from public.sessions s where s.id = v_session_id;
      end if;
      if v_session_id is not null and v_status = 'SCHEDULED' and v_staff_override then
        select array_agg(ss.staff_id order by ss.staff_id) into v_teachers
        from public.session_staff ss join public.staff st on st.id = ss.staff_id
        where ss.session_id = v_session_id and ss.assignment_role = 'TEACHER'
          and st.status = 'ACTIVE' and st.staff_type = 'TEACHER';
      end if;
      if v_start <= now() then continue; end if;

      if coalesce(array_length(v_students, 1), 0) = 0 or coalesce(array_length(v_teachers, 1), 0) = 0 then
        if v_session_id is not null and v_status = 'SCHEDULED' then
          update public.sessions set status = 'CANCELLED' where id = v_session_id;
          v_cancelled := v_cancelled + 1;
        end if;
        continue;
      end if;

      if v_session_id is null then
        insert into public.sessions(class_id, recurrence_schedule_id, recurrence_occurrence_date,
          scheduled_start_at, scheduled_end_at, room)
        values (v_schedule.class_id, v_schedule.id, v_day, v_start, v_end, v_room)
        returning id into v_session_id;
        v_created := v_created + 1;
      elsif v_status = 'CANCELLED' and not v_schedule_override then
        update public.sessions set status = 'SCHEDULED', scheduled_start_at = v_start,
          scheduled_end_at = v_end, room = case when v_room_override then room else v_room end
        where id = v_session_id;
        v_status := 'SCHEDULED';
      elsif v_status <> 'SCHEDULED' then
        continue;
      elsif v_schedule_override then
        select s.scheduled_start_at, s.scheduled_end_at into v_start, v_end from public.sessions s where s.id = v_session_id;
        if not v_room_override then update public.sessions set room = v_room where id = v_session_id; end if;
      else
        update public.sessions
        set scheduled_start_at = v_start, scheduled_end_at = v_end,
            room = case when v_room_override then room else v_room end
        where id = v_session_id;
        v_refreshed := v_refreshed + 1;
      end if;

      v_conflict_reason := public.session_schedule_conflict_reason(
        v_session_id, v_schedule.class_id, v_start, v_end, v_room, v_students
      );
      if v_conflict_reason is not null then
        update public.sessions
        set status = 'CANCELLED',
            schedule_override = case when v_conflict_reason in ('ROOM_REQUIRED_FOR_OVERLAP', 'ROOM_ALREADY_BOOKED') then false else true end
        where id = v_session_id;
        v_cancelled := v_cancelled + 1;
        if v_conflict_reason = 'ROOM_REQUIRED_FOR_OVERLAP' then v_missing_room_conflicts := v_missing_room_conflicts + 1; end if;
        if v_conflict_reason = 'ROOM_ALREADY_BOOKED' then v_room_conflicts := v_room_conflicts + 1; end if;
        if not v_was_cancelled then
          perform public.write_audit(null, 'SESSION_GENERATION_CONFLICT', 'sessions', v_session_id, null,
            jsonb_build_object('class_id', v_schedule.class_id, 'schedule_id', v_schedule.id,
              'occurrence_date', v_day, 'conflict_reason', v_conflict_reason, 'room', v_room));
        end if;
        continue;
      end if;

      if not v_staff_override then
        delete from public.session_staff where session_id = v_session_id;
      end if;
      delete from public.session_students where session_id = v_session_id
        and not exists (select 1 from public.student_attendances sa where sa.session_id = v_session_id and sa.student_id = session_students.student_id)
        and assessment_snapshot = '{}'::jsonb
        and monthly_fee_snapshot is null
        and session_unit_value is null;
      insert into public.session_students(session_id, student_id)
      select v_session_id, student.student_id from unnest(v_students) as student(student_id)
      where not exists (select 1 from public.session_students ss where ss.session_id = v_session_id and ss.student_id = student.student_id);
      if not v_staff_override then
        insert into public.session_staff(session_id, staff_id, assignment_role)
        select v_session_id, staff_id, 'TEACHER' from unnest(v_teachers) as staff_id
        on conflict (session_id, staff_id) do update set assignment_role = 'TEACHER';
      end if;
    end loop;
  end loop;

  for v_archived_session in
    select s.id, s.scheduled_start_at, s.scheduled_end_at, s.recurrence_schedule_id
    from public.sessions s
    join public.class_schedules cs on cs.id = s.recurrence_schedule_id
    where cs.status = 'ARCHIVED' and s.status = 'SCHEDULED'
      and not s.manual_schedule and s.scheduled_start_at > now()
    for update of s
  loop
    update public.sessions set status = 'CANCELLED' where id = v_archived_session.id;
    v_cancelled := v_cancelled + 1;
    perform public.write_audit(auth.uid(), 'SESSION_ARCHIVE_CANCEL', 'sessions', v_archived_session.id,
      jsonb_build_object('status', 'SCHEDULED', 'recurrence_schedule_id', v_archived_session.recurrence_schedule_id),
      jsonb_build_object('status', 'CANCELLED', 'scheduled_start_at', v_archived_session.scheduled_start_at,
        'scheduled_end_at', v_archived_session.scheduled_end_at));
  end loop;

  update public.sessions s
  set status = 'CANCELLED'
  where s.status = 'SCHEDULED' and not s.manual_schedule
    and s.scheduled_start_at > now()
    and (s.recurrence_occurrence_date is null or s.recurrence_occurrence_date between v_today and v_today + (p_days - 1))
    and (
      (
        not s.schedule_override and (
          not exists (select 1 from public.classes c where c.id = s.class_id and c.status = 'ACTIVE')
          or (s.recurrence_schedule_id is null and exists (
            select 1 from public.class_schedules cs join public.classes c on c.id = cs.class_id
            where cs.class_id = s.class_id and cs.status = 'ACTIVE' and cs.reviewed_at is not null and c.status = 'ACTIVE'
          ))
          or (s.recurrence_schedule_id is not null and not exists (
            select 1 from public.class_schedules cs join public.classes c on c.id = cs.class_id
            where cs.id = s.recurrence_schedule_id and cs.status = 'ACTIVE' and cs.reviewed_at is not null and c.status = 'ACTIVE'
              and extract(isodow from s.recurrence_occurrence_date)::int = cs.day_of_week
          ))
        )
      )
      or exists (
        select 1 from public.class_schedules cs
        where cs.id = s.recurrence_schedule_id and cs.status = 'ARCHIVED'
      )
    );
  get diagnostics v_row_count = row_count;
  v_cancelled := v_cancelled + v_row_count;
  return jsonb_build_object('created', v_created, 'refreshed', v_refreshed,
    'cancelled', v_cancelled, 'room_conflicts', v_room_conflicts,
    'missing_room_conflicts', v_missing_room_conflicts, 'through', v_today + (p_days - 1));
end;
$$;

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
  if v_session.status <> 'SCHEDULED' or v_session.scheduled_start_at <= now() then
    raise exception 'SESSION_LOCKED';
  end if;
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

  if cardinality(p_student_ids) <> (select count(distinct requested.student_id)::integer from unnest(p_student_ids) requested(student_id)) then
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
      jsonb_build_object('student_ids', v_after, 'added', v_added, 'removed', v_removed, 'retained_with_history', v_retained)
    );
  end if;

  return jsonb_build_object(
    'session_id', p_session_id,
    'added', v_added,
    'removed', v_removed,
    'retained_with_history', v_retained,
    'student_count', cardinality(v_after)
  );
end;
$$;

revoke all on function public.apply_session_student_roster(uuid, uuid[], text)
  from public, anon, authenticated, service_role;

create or replace function public.admin_update_session_student_roster(
  p_session_id uuid,
  p_student_ids uuid[]
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.apply_session_student_roster(p_session_id, p_student_ids, 'MANUAL');
$$;

create or replace function public.admin_sync_session_student_roster(p_session_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.apply_session_student_roster(p_session_id, null, 'SYNC');
$$;

create or replace function public.admin_delete_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_excluded_date date;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'SCHEDULED' or v_session.scheduled_start_at <= now()
     or v_session.started_at is not null or v_session.ended_at is not null then
    raise exception 'SESSION_DELETE_NOT_ALLOWED';
  end if;
  if exists (select 1 from public.student_attendances where session_id = p_session_id)
     or exists (select 1 from public.timesheets where session_id = p_session_id)
     or exists (select 1 from public.staff_replacements where session_id = p_session_id)
     or exists (select 1 from public.payroll_items where session_id = p_session_id)
     or exists (
       select 1 from public.session_students ss
       where ss.session_id = p_session_id
         and (ss.assessment_snapshot <> '{}'::jsonb
           or ss.monthly_fee_snapshot is not null
           or ss.session_unit_value is not null)
     )
     or nullif(btrim(v_session.lesson_content), '') is not null
     or nullif(btrim(v_session.session_note), '') is not null
     or nullif(btrim(v_session.lesson_youtube_url), '') is not null
     or v_session.import_metadata <> '{}'::jsonb
     or coalesce(v_session.revenue_snapshot, 0) <> 0 then
    raise exception 'SESSION_HAS_HISTORY';
  end if;

  if v_session.recurrence_schedule_id is not null then
    v_excluded_date := coalesce(
      v_session.recurrence_occurrence_date,
      (v_session.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
    );
    insert into public.deleted_session_occurrences(class_schedule_id, occurrence_date, deleted_by)
    values (v_session.recurrence_schedule_id, v_excluded_date, v_actor)
    on conflict (class_schedule_id, occurrence_date) do update
      set deleted_by = excluded.deleted_by, deleted_at = now();
  end if;

  perform public.write_audit(v_actor, 'SESSION_DELETE', 'sessions', p_session_id,
    jsonb_build_object('class_id', v_session.class_id,
      'recurrence_schedule_id', v_session.recurrence_schedule_id,
      'recurrence_occurrence_date', v_session.recurrence_occurrence_date,
      'scheduled_start_at', v_session.scheduled_start_at,
      'scheduled_end_at', v_session.scheduled_end_at,
      'room', v_session.room,
      'session_students_count', (select count(*) from public.session_students where session_id = p_session_id),
      'session_staff_count', (select count(*) from public.session_staff where session_id = p_session_id)),
    null);

  delete from public.session_students where session_id = p_session_id;
  delete from public.session_staff where session_id = p_session_id;
  delete from public.sessions where id = p_session_id;
  return jsonb_build_object('session_id', p_session_id, 'deleted', true,
    'excluded_occurrence', v_session.recurrence_schedule_id is not null);
end;
$$;

revoke all on function public.admin_update_session_student_roster(uuid, uuid[]) from public, anon;
grant execute on function public.admin_update_session_student_roster(uuid, uuid[]) to authenticated;
revoke all on function public.admin_sync_session_student_roster(uuid) from public, anon;
grant execute on function public.admin_sync_session_student_roster(uuid) to authenticated;
revoke all on function public.admin_delete_session(uuid) from public, anon;
grant execute on function public.admin_delete_session(uuid) to authenticated;

comment on function public.admin_update_session_student_roster(uuid, uuid[]) is
  'Set a future scheduled session roster from active class memberships effective on the session date; rows with attendance or assessment history are retained.';
comment on function public.admin_sync_session_student_roster(uuid) is
  'Reconcile a future scheduled session roster to active class memberships effective on the session date, preserving rows with history.';
comment on function public.admin_delete_session(uuid) is
  'Delete only an empty future scheduled session; recurring occurrences receive an internal exclusion tombstone.';
