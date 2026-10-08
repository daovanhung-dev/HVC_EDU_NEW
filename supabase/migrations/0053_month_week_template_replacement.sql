create table public.class_schedule_month_overrides (
  month_start date primary key
    check (date_trunc('month', month_start)::date = month_start),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.class_schedule_month_overrides enable row level security;
revoke all on public.class_schedule_month_overrides from public, anon, authenticated;
grant all on public.class_schedule_month_overrides to service_role;

create or replace function public.admin_preview_month_week_template_replacement(
  p_month_start date,
  p_template jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_month_end date;
  v_month_start_at timestamptz;
  v_month_end_at timestamptz;
  v_session_count integer;
  v_scheduled_count integer;
  v_in_progress_count integer;
  v_completed_count integer;
  v_cancelled_count integer;
  v_session_student_count integer;
  v_assessment_count integer;
  v_session_staff_count integer;
  v_staff_replacement_count integer;
  v_attendance_count integer;
  v_timesheet_count integer;
  v_payroll_item_count integer;
  v_new_session_count integer := 0;
  v_occurrence_count integer;
  v_slot record;
  v_day integer;
  v_template_count integer := 0;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start
     or coalesce(jsonb_typeof(p_template), '') <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;

  v_month_end := (p_month_start + interval '1 month')::date;
  v_month_start_at := p_month_start::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_month_end_at := v_month_end::timestamp at time zone 'Asia/Ho_Chi_Minh';

  for v_slot in select value from jsonb_array_elements(p_template)
  loop
    v_template_count := v_template_count + 1;
    if v_template_count > 100 or jsonb_typeof(v_slot.value) <> 'object'
       or coalesce(v_slot.value->>'day_of_week', '') !~ '^[1-7]$' then
      raise exception 'INVALID_TEMPLATE';
    end if;
    v_day := (v_slot.value->>'day_of_week')::integer;
    select count(*)::integer into v_occurrence_count
    from generate_series(p_month_start, v_month_end - 1, interval '1 day') d
    where extract(isodow from d)::integer = v_day;
    v_new_session_count := v_new_session_count + v_occurrence_count;
  end loop;

  if v_template_count = 0 then raise exception 'EMPTY_TEMPLATE'; end if;

  select
    count(*)::integer,
    count(*) filter (where s.status = 'SCHEDULED')::integer,
    count(*) filter (where s.status = 'IN_PROGRESS')::integer,
    count(*) filter (where s.status = 'COMPLETED')::integer,
    count(*) filter (where s.status = 'CANCELLED')::integer
  into v_session_count, v_scheduled_count, v_in_progress_count, v_completed_count, v_cancelled_count
  from public.sessions s
  where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer, count(*) filter (where ss.assessment_snapshot <> '{}'::jsonb)::integer
  into v_session_student_count, v_assessment_count
  from public.session_students ss
  join public.sessions s on s.id = ss.session_id
  where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_session_staff_count
  from public.session_staff ss join public.sessions s on s.id = ss.session_id
  where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_staff_replacement_count
  from public.staff_replacements r join public.sessions s on s.id = r.session_id
  where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_attendance_count
  from public.student_attendances a join public.sessions s on s.id = a.session_id
  where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_timesheet_count
  from public.timesheets t join public.sessions s on s.id = t.session_id
  where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_payroll_item_count
  from public.payroll_items p
  where p.session_id in (
    select s.id from public.sessions s
    where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at
  ) or p.timesheet_id in (
    select t.id from public.timesheets t join public.sessions s on s.id = t.session_id
    where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at
  );

  return jsonb_build_object(
    'month_start', p_month_start,
    'session_count', v_session_count,
    'status_counts', jsonb_build_object(
      'SCHEDULED', v_scheduled_count,
      'IN_PROGRESS', v_in_progress_count,
      'COMPLETED', v_completed_count,
      'CANCELLED', v_cancelled_count
    ),
    'session_student_count', v_session_student_count,
    'assessment_count', v_assessment_count,
    'session_staff_count', v_session_staff_count,
    'staff_replacement_count', v_staff_replacement_count,
    'attendance_count', v_attendance_count,
    'timesheet_count', v_timesheet_count,
    'payroll_item_count', v_payroll_item_count,
    'new_session_count', v_new_session_count
  );
end;
$$;

create or replace function public.admin_replace_month_with_week_template(
  p_month_start date,
  p_template jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_month_end date;
  v_month_start_at timestamptz;
  v_month_end_at timestamptz;
  v_session_ids uuid[] := array[]::uuid[];
  v_session public.sessions%rowtype;
  v_old_session_id uuid;
  v_slot record;
  v_occurrence_date date;
  v_target_start timestamptz;
  v_target_end timestamptz;
  v_day integer;
  v_class_id uuid;
  v_start_time time;
  v_end_time time;
  v_room text;
  v_staff_ids uuid[];
  v_students uuid[];
  v_session_id uuid;
  v_conflict_reason text;
  v_slot_count integer := 0;
  v_deleted_sessions integer := 0;
  v_deleted_session_students integer := 0;
  v_deleted_session_staff integer := 0;
  v_deleted_staff_replacements integer := 0;
  v_deleted_attendances integer := 0;
  v_deleted_timesheets integer := 0;
  v_deleted_payroll_items integer := 0;
  v_created_sessions integer := 0;
  v_status_counts jsonb;
  v_distinct_teachers integer;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start
     or coalesce(jsonb_typeof(p_template), '') <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.class_schedules in share row exclusive mode;
  lock table public.class_schedule_staff in share row exclusive mode;
  lock table public.sessions in share row exclusive mode;

  v_month_end := (p_month_start + interval '1 month')::date;
  v_month_start_at := p_month_start::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_month_end_at := v_month_end::timestamp at time zone 'Asia/Ho_Chi_Minh';

  for v_slot in select value from jsonb_array_elements(p_template)
  loop
    v_slot_count := v_slot_count + 1;
    if v_slot_count > 100 or jsonb_typeof(v_slot.value) <> 'object'
       or coalesce(v_slot.value->>'day_of_week', '') !~ '^[1-7]$'
       or jsonb_typeof(v_slot.value->'class_id') <> 'string'
       or jsonb_typeof(v_slot.value->'start_time') <> 'string'
       or jsonb_typeof(v_slot.value->'end_time') <> 'string'
       or jsonb_typeof(v_slot.value->'staff_ids') <> 'array' then
      raise exception 'INVALID_TEMPLATE';
    end if;

    v_day := (v_slot.value->>'day_of_week')::integer;
    v_class_id := (v_slot.value->>'class_id')::uuid;
    v_start_time := (v_slot.value->>'start_time')::time;
    v_end_time := (v_slot.value->>'end_time')::time;
    v_room := nullif(btrim(v_slot.value->>'room'), '');
    select coalesce(array_agg(value::uuid order by ordinal), '{}'::uuid[])
    into v_staff_ids
    from jsonb_array_elements_text(v_slot.value->'staff_ids') with ordinality staff(value, ordinal);

    if v_start_time is null or v_end_time is null or v_end_time <= v_start_time
       or cardinality(v_staff_ids) = 0 or cardinality(v_staff_ids) > 5 then
      raise exception 'INVALID_TEMPLATE';
    end if;
    select count(distinct staff_id)::integer into v_distinct_teachers from unnest(v_staff_ids) staff(staff_id);
    if v_distinct_teachers <> cardinality(v_staff_ids) then raise exception 'DUPLICATE_TEACHER'; end if;
    if not exists (select 1 from public.classes c where c.id = v_class_id) then
      raise exception 'CLASS_NOT_FOUND';
    end if;
    if (select count(*)::integer from public.staff st
        where st.id = any(v_staff_ids) and st.status = 'ACTIVE' and st.staff_type = 'TEACHER')
       <> cardinality(v_staff_ids) then
      raise exception 'TEACHER_NOT_ACTIVE';
    end if;
  end loop;
  if v_slot_count = 0 then raise exception 'EMPTY_TEMPLATE'; end if;

  select coalesce(array_agg(s.id order by s.id), '{}'::uuid[]),
         jsonb_build_object(
           'SCHEDULED', count(*) filter (where s.status = 'SCHEDULED'),
           'IN_PROGRESS', count(*) filter (where s.status = 'IN_PROGRESS'),
           'COMPLETED', count(*) filter (where s.status = 'COMPLETED'),
           'CANCELLED', count(*) filter (where s.status = 'CANCELLED')
         )
  into v_session_ids, v_status_counts
  from public.sessions s
  where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at;

  foreach v_old_session_id in array v_session_ids
  loop
    select * into v_session from public.sessions s where s.id = v_old_session_id;
    perform public.write_audit(
      v_actor,
      'SESSION_MONTH_TEMPLATE_REPLACE_DELETE',
      'sessions',
      v_session.id,
      jsonb_build_object(
        'class_id', v_session.class_id,
        'scheduled_start_at', v_session.scheduled_start_at,
        'scheduled_end_at', v_session.scheduled_end_at,
        'status', v_session.status,
        'manual_schedule', v_session.manual_schedule,
        'recurrence_schedule_id', v_session.recurrence_schedule_id,
        'session_students', (select count(*) from public.session_students ss where ss.session_id = v_session.id),
        'session_staff', (select count(*) from public.session_staff ss where ss.session_id = v_session.id),
        'staff_replacements', (select count(*) from public.staff_replacements r where r.session_id = v_session.id),
        'attendances', (select count(*) from public.student_attendances a where a.session_id = v_session.id),
        'timesheets', (select count(*) from public.timesheets t where t.session_id = v_session.id),
        'payroll_items', (
          select count(*) from public.payroll_items p
          where p.session_id = v_session.id or p.timesheet_id in (
            select t.id from public.timesheets t where t.session_id = v_session.id
          )
        )
      ),
      null,
      'Admin replaced every session in month ' || p_month_start::text
    );
  end loop;

  delete from public.payroll_items p
  where p.session_id = any(v_session_ids)
     or p.timesheet_id in (select t.id from public.timesheets t where t.session_id = any(v_session_ids));
  get diagnostics v_deleted_payroll_items = row_count;

  delete from public.timesheets t where t.session_id = any(v_session_ids);
  get diagnostics v_deleted_timesheets = row_count;
  delete from public.student_attendances a where a.session_id = any(v_session_ids);
  get diagnostics v_deleted_attendances = row_count;
  delete from public.staff_replacements r where r.session_id = any(v_session_ids);
  get diagnostics v_deleted_staff_replacements = row_count;
  delete from public.session_staff ss where ss.session_id = any(v_session_ids);
  get diagnostics v_deleted_session_staff = row_count;
  delete from public.session_students ss where ss.session_id = any(v_session_ids);
  get diagnostics v_deleted_session_students = row_count;
  delete from public.sessions s where s.id = any(v_session_ids);
  get diagnostics v_deleted_sessions = row_count;
  if v_deleted_sessions <> cardinality(v_session_ids) then raise exception 'DELETE_COUNT_MISMATCH'; end if;

  insert into public.class_schedule_month_overrides(month_start, created_by)
  values (p_month_start, v_actor)
  on conflict (month_start) do update set created_by = excluded.created_by, created_at = now();

  perform public.write_audit(
    v_actor,
    'SESSION_MONTH_TEMPLATE_REPLACE',
    'class_schedule_month_overrides',
    null,
    jsonb_build_object('month_start', p_month_start, 'deleted_sessions', v_deleted_sessions,
      'status_counts', v_status_counts),
    jsonb_build_object('template_slot_count', v_slot_count),
    'Admin replaced all center sessions in the selected month'
  );

  for v_slot in select value from jsonb_array_elements(p_template)
  loop
    v_day := (v_slot.value->>'day_of_week')::integer;
    v_class_id := (v_slot.value->>'class_id')::uuid;
    v_start_time := (v_slot.value->>'start_time')::time;
    v_end_time := (v_slot.value->>'end_time')::time;
    v_room := nullif(btrim(v_slot.value->>'room'), '');
    select coalesce(array_agg(value::uuid order by ordinal), '{}'::uuid[])
    into v_staff_ids
    from jsonb_array_elements_text(v_slot.value->'staff_ids') with ordinality staff(value, ordinal);

    for v_occurrence_date in
      select d::date
      from generate_series(p_month_start, v_month_end - 1, interval '1 day') d
      where extract(isodow from d)::integer = v_day
    loop
      v_target_start := (v_occurrence_date + v_start_time) at time zone 'Asia/Ho_Chi_Minh';
      v_target_end := (v_occurrence_date + v_end_time) at time zone 'Asia/Ho_Chi_Minh';
      if v_target_start > now() and not exists (
        select 1 from public.classes c where c.id = v_class_id and c.status = 'ACTIVE'
      ) then
        raise exception 'CLASS_NOT_ACTIVE';
      end if;

      if v_target_start <= now() then
        select coalesce(array_agg(distinct cm.student_id order by cm.student_id), '{}'::uuid[])
        into v_students
        from public.class_memberships cm
        where cm.class_id = v_class_id and cm.start_date <= v_occurrence_date
          and coalesce(cm.end_date, 'infinity'::date) >= v_occurrence_date;
      else
        select coalesce(array_agg(distinct cm.student_id order by cm.student_id), '{}'::uuid[])
        into v_students
        from public.class_memberships cm
        join public.students st on st.id = cm.student_id
        where cm.class_id = v_class_id and cm.status = 'ACTIVE' and st.status = 'ACTIVE'
          and cm.start_date <= v_occurrence_date
          and coalesce(cm.end_date, 'infinity'::date) >= v_occurrence_date;
      end if;
      if cardinality(v_students) = 0 then
        raise exception using message = 'NO_ACTIVE_STUDENTS', detail = v_occurrence_date::text;
      end if;

      v_conflict_reason := public.session_schedule_conflict_reason(
        null, v_class_id, v_target_start, v_target_end, v_room, v_students
      );
      if v_conflict_reason is not null then
        raise exception using message = v_conflict_reason, detail = v_occurrence_date::text;
      end if;

      insert into public.sessions(class_id, scheduled_start_at, scheduled_end_at, room, manual_schedule)
      values (v_class_id, v_target_start, v_target_end, v_room, true)
      returning id into v_session_id;
      insert into public.session_students(session_id, student_id)
      select v_session_id, student_id from unnest(v_students) roster(student_id);
      insert into public.session_staff(session_id, staff_id, assignment_role)
      select v_session_id, staff_id, 'TEACHER' from unnest(v_staff_ids) teachers(staff_id);
      perform public.write_audit(
        v_actor,
        'SESSION_MONTH_TEMPLATE_CREATE',
        'sessions',
        v_session_id,
        null,
        jsonb_build_object('month_start', p_month_start, 'day_of_week', v_day,
          'class_id', v_class_id, 'scheduled_start_at', v_target_start,
          'scheduled_end_at', v_target_end, 'room', v_room,
          'staff_ids', v_staff_ids, 'roster_count', cardinality(v_students)),
        null
      );
      v_created_sessions := v_created_sessions + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'month_start', p_month_start,
    'deleted_sessions', v_deleted_sessions,
    'deleted_status_counts', v_status_counts,
    'deleted_session_students', v_deleted_session_students,
    'deleted_session_staff', v_deleted_session_staff,
    'deleted_staff_replacements', v_deleted_staff_replacements,
    'deleted_attendances', v_deleted_attendances,
    'deleted_timesheets', v_deleted_timesheets,
    'deleted_payroll_items', v_deleted_payroll_items,
    'created_sessions', v_created_sessions
  );
end;
$$;

revoke all on function public.admin_preview_month_week_template_replacement(date, jsonb) from public, anon, authenticated;
grant execute on function public.admin_preview_month_week_template_replacement(date, jsonb) to authenticated;
revoke all on function public.admin_replace_month_with_week_template(date, jsonb) from public, anon, authenticated;
grant execute on function public.admin_replace_month_with_week_template(date, jsonb) to authenticated;


-- Recurring generation must skip months explicitly replaced by a one-time weekly template.
create or replace function public.generate_upcoming_sessions(p_days integer default 30)
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
        and not exists (select 1 from public.student_attendances sa where sa.session_id = v_session_id);
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
