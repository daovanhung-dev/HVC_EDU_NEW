alter table public.sessions
  add column manual_schedule boolean not null default false,
  add column staff_assignment_override boolean not null default false;

comment on column public.sessions.manual_schedule is
  'True for date-specific sessions managed directly by Admin; the recurring generator must leave them unchanged.';
comment on column public.sessions.staff_assignment_override is
  'True when Admin assigned teachers for this occurrence instead of inheriting the recurring schedule mapping.';

create or replace function public.generate_upcoming_sessions(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  v_students uuid[];
  v_teachers uuid[];
  v_archived_session record;
  v_created integer := 0;
  v_refreshed integer := 0;
  v_cancelled integer := 0;
  v_row_count integer := 0;
begin
  if auth.uid() is not null and not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_days < 1 or p_days > 90 then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  for v_schedule in
    select cs.*, c.status as class_status
    from public.class_schedules cs join public.classes c on c.id = cs.class_id
    where cs.status = 'ACTIVE' and cs.reviewed_at is not null and c.status = 'ACTIVE'
  loop
    for v_day in
      select d::date from generate_series(v_today, v_today + (p_days - 1), interval '1 day') d
      where extract(isodow from d)::int = v_schedule.day_of_week
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
      v_session_id := null;
      v_status := null;
      v_schedule_override := false;
      v_staff_override := false;
      select s.id, s.status, s.schedule_override, s.staff_assignment_override
      into v_session_id, v_status, v_schedule_override, v_staff_override
      from public.sessions s
      where s.recurrence_schedule_id = v_schedule.id and s.recurrence_occurrence_date = v_day
      for update;
      if v_session_id is null then
        select s.id, s.status, s.schedule_override, s.staff_assignment_override
        into v_session_id, v_status, v_schedule_override, v_staff_override
        from public.sessions s
        where s.class_id = v_schedule.class_id and s.scheduled_start_at = v_start
          and not s.manual_schedule
          and s.status in ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')
        order by s.created_at limit 1 for update;
        if v_session_id is not null and v_status = 'SCHEDULED' then
          update public.sessions set recurrence_schedule_id = v_schedule.id, recurrence_occurrence_date = v_day where id = v_session_id;
        end if;
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
        insert into public.sessions(class_id, recurrence_schedule_id, recurrence_occurrence_date, scheduled_start_at, scheduled_end_at)
        values (v_schedule.class_id, v_schedule.id, v_day, v_start, v_end)
        returning id into v_session_id;
        v_created := v_created + 1;
      elsif v_status = 'CANCELLED' and not v_schedule_override then
        update public.sessions set status = 'SCHEDULED', scheduled_start_at = v_start, scheduled_end_at = v_end where id = v_session_id;
        v_status := 'SCHEDULED';
      elsif v_status <> 'SCHEDULED' then
        continue;
      elsif v_schedule_override then
        select s.scheduled_start_at, s.scheduled_end_at into v_start, v_end from public.sessions s where s.id = v_session_id;
      else
        update public.sessions set scheduled_start_at = v_start, scheduled_end_at = v_end where id = v_session_id;
        v_refreshed := v_refreshed + 1;
      end if;

      if exists (
        select 1 from public.sessions other
        where other.id <> v_session_id and other.status in ('SCHEDULED', 'IN_PROGRESS')
          and other.scheduled_start_at < v_end and other.scheduled_end_at > v_start
          and (
            other.class_id = v_schedule.class_id
            or exists (select 1 from public.session_staff b where b.session_id = other.id and b.staff_id = any(v_teachers))
            or exists (select 1 from public.session_students b where b.session_id = other.id and b.student_id = any(v_students))
          )
      ) then
        update public.sessions set status = 'CANCELLED', schedule_override = true where id = v_session_id;
        v_cancelled := v_cancelled + 1;
        perform public.write_audit(null, 'SESSION_GENERATION_CONFLICT', 'sessions', v_session_id, null,
          jsonb_build_object('class_id', v_schedule.class_id, 'schedule_id', v_schedule.id, 'occurrence_date', v_day));
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
  return jsonb_build_object('created', v_created, 'refreshed', v_refreshed, 'cancelled', v_cancelled, 'through', v_today + (p_days - 1));
end;
$$;

create or replace function public.admin_create_session(
  p_class_id uuid,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_staff_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_day date;
  v_students uuid[];
  v_count integer;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_class_id is null or p_scheduled_start_at is null or p_scheduled_end_at is null
     or p_scheduled_end_at <= p_scheduled_start_at or p_scheduled_start_at <= now()
     or (p_scheduled_end_at at time zone 'Asia/Ho_Chi_Minh')::date <> (p_scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
     or p_staff_ids is null or cardinality(p_staff_ids) = 0 then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  if not exists (select 1 from public.classes where id = p_class_id and status = 'ACTIVE') then raise exception 'CLASS_NOT_ACTIVE'; end if;

  select count(distinct staff_id)::integer into v_count from unnest(p_staff_ids) as staff(staff_id);
  if v_count <> cardinality(p_staff_ids) then raise exception 'DUPLICATE_TEACHER'; end if;
  select count(*)::integer into v_count from public.staff
  where id = any(p_staff_ids) and status = 'ACTIVE' and staff_type = 'TEACHER';
  if v_count <> cardinality(p_staff_ids) then raise exception 'TEACHER_NOT_ACTIVE'; end if;

  v_day := (p_scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date;
  select array_agg(cm.student_id order by cm.student_id) into v_students
  from public.class_memberships cm join public.students st on st.id = cm.student_id
  where cm.class_id = p_class_id and cm.status = 'ACTIVE' and st.status = 'ACTIVE'
    and cm.start_date <= v_day and coalesce(cm.end_date, 'infinity'::date) >= v_day;
  if coalesce(cardinality(v_students), 0) = 0 then raise exception 'NO_ACTIVE_STUDENTS'; end if;

  if exists (
    select 1 from public.sessions other
    where other.status in ('SCHEDULED', 'IN_PROGRESS')
      and other.scheduled_start_at < p_scheduled_end_at and other.scheduled_end_at > p_scheduled_start_at
      and (
        other.class_id = p_class_id
        or exists (select 1 from public.session_staff a where a.session_id = other.id and a.staff_id = any(p_staff_ids))
        or exists (select 1 from public.session_students a where a.session_id = other.id and a.student_id = any(v_students))
      )
  ) then raise exception 'SCHEDULE_CONFLICT'; end if;

  insert into public.sessions(class_id, scheduled_start_at, scheduled_end_at, manual_schedule)
  values (p_class_id, p_scheduled_start_at, p_scheduled_end_at, true)
  returning id into v_session_id;
  insert into public.session_students(session_id, student_id)
  select v_session_id, student_id from unnest(v_students) as roster(student_id);
  insert into public.session_staff(session_id, staff_id, assignment_role)
  select v_session_id, staff_id, 'TEACHER' from unnest(p_staff_ids) as teachers(staff_id);
  perform public.write_audit(auth.uid(), 'SESSION_MANUAL_CREATE', 'sessions', v_session_id, null,
    jsonb_build_object('class_id', p_class_id, 'scheduled_start_at', p_scheduled_start_at,
      'scheduled_end_at', p_scheduled_end_at, 'staff_ids', p_staff_ids, 'roster_count', cardinality(v_students)));
  return jsonb_build_object('session_id', v_session_id, 'status', 'SCHEDULED', 'students_count', cardinality(v_students));
end;
$$;

create or replace function public.admin_apply_week_to_month(
  p_source_session_ids uuid[],
  p_month_start date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.sessions%rowtype;
  v_source_week_start date;
  v_current_week_start date;
  v_source_local_start timestamp;
  v_source_local_end timestamp;
  v_source_day date;
  v_weekday integer;
  v_start_time time;
  v_end_time time;
  v_target_date date;
  v_month_end date;
  v_target_start timestamptz;
  v_target_end timestamptz;
  v_students uuid[];
  v_staff_ids uuid[];
  v_source_count integer;
  v_created integer := 0;
  v_session_id uuid;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_source_session_ids is null or cardinality(p_source_session_ids) = 0 or cardinality(p_source_session_ids) > 100
     or p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  if p_month_start < date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))::date then raise exception 'MONTH_IN_PAST'; end if;
  select count(distinct session_id)::integer into v_source_count from unnest(p_source_session_ids) as ids(session_id);
  if v_source_count <> cardinality(p_source_session_ids) then raise exception 'DUPLICATE_SOURCE_SESSION'; end if;
  if (select count(*) from public.sessions where id = any(p_source_session_ids)) <> cardinality(p_source_session_ids) then raise exception 'SOURCE_SESSION_NOT_FOUND'; end if;
  v_month_end := (p_month_start + interval '1 month - 1 day')::date;

  for v_source in
    select s.* from public.sessions s where s.id = any(p_source_session_ids) order by s.scheduled_start_at
  loop
    if v_source.status <> 'SCHEDULED' or v_source.scheduled_start_at <= now() then raise exception 'SOURCE_SESSION_NOT_SCHEDULED'; end if;
    if not exists (select 1 from public.classes c where c.id = v_source.class_id and c.status = 'ACTIVE') then raise exception 'CLASS_NOT_ACTIVE'; end if;
    v_source_local_start := v_source.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh';
    v_source_local_end := v_source.scheduled_end_at at time zone 'Asia/Ho_Chi_Minh';
    v_source_day := v_source_local_start::date;
    v_current_week_start := v_source_day - extract(isodow from v_source_day)::integer + 1;
    if v_source_week_start is null then v_source_week_start := v_current_week_start;
    elsif v_current_week_start <> v_source_week_start then raise exception 'SOURCE_SESSIONS_NOT_IN_ONE_WEEK'; end if;
    if v_source_local_end::date <> v_source_day or v_source_local_end::time <= v_source_local_start::time then raise exception 'INVALID_SOURCE_SESSION_TIME'; end if;

    v_weekday := extract(isodow from v_source_day)::integer;
    v_start_time := v_source_local_start::time;
    v_end_time := v_source_local_end::time;
    select array_agg(ss.staff_id order by ss.staff_id) into v_staff_ids
    from public.session_staff ss join public.staff st on st.id = ss.staff_id
    where ss.session_id = v_source.id and ss.assignment_role = 'TEACHER'
      and st.status = 'ACTIVE' and st.staff_type = 'TEACHER';
    if coalesce(cardinality(v_staff_ids), 0) = 0 then raise exception 'SOURCE_TEACHER_REQUIRED'; end if;

    for v_target_date in
      select d::date from generate_series(p_month_start, v_month_end, interval '1 day') d
      where extract(isodow from d)::integer = v_weekday
        and d::date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
        and d::date <> v_source_day
    loop
      v_target_start := (v_target_date + v_start_time) at time zone 'Asia/Ho_Chi_Minh';
      v_target_end := (v_target_date + v_end_time) at time zone 'Asia/Ho_Chi_Minh';
      if v_target_start <= now() then continue; end if;

      select array_agg(cm.student_id order by cm.student_id) into v_students
      from public.class_memberships cm join public.students st on st.id = cm.student_id
      where cm.class_id = v_source.class_id and cm.status = 'ACTIVE' and st.status = 'ACTIVE'
        and cm.start_date <= v_target_date and coalesce(cm.end_date, 'infinity'::date) >= v_target_date;
      if coalesce(cardinality(v_students), 0) = 0 then raise exception 'NO_ACTIVE_STUDENTS'; end if;

      if exists (
        select 1 from public.sessions other
        where other.status in ('SCHEDULED', 'IN_PROGRESS')
          and other.scheduled_start_at < v_target_end and other.scheduled_end_at > v_target_start
          and (
            other.class_id = v_source.class_id
            or exists (select 1 from public.session_staff a where a.session_id = other.id and a.staff_id = any(v_staff_ids))
            or exists (select 1 from public.session_students a where a.session_id = other.id and a.student_id = any(v_students))
          )
      ) then raise exception 'SCHEDULE_CONFLICT: %', v_target_date; end if;

      insert into public.sessions(class_id, scheduled_start_at, scheduled_end_at, manual_schedule)
      values (v_source.class_id, v_target_start, v_target_end, true)
      returning id into v_session_id;
      insert into public.session_students(session_id, student_id)
      select v_session_id, student_id from unnest(v_students) as roster(student_id);
      insert into public.session_staff(session_id, staff_id, assignment_role)
      select v_session_id, staff_id, 'TEACHER' from unnest(v_staff_ids) as teachers(staff_id);
      perform public.write_audit(auth.uid(), 'SESSION_MONTH_COPY', 'sessions', v_session_id, null,
        jsonb_build_object('source_session_id', v_source.id, 'class_id', v_source.class_id,
          'scheduled_start_at', v_target_start, 'scheduled_end_at', v_target_end, 'staff_ids', v_staff_ids,
          'roster_count', cardinality(v_students)));
      v_created := v_created + 1;
    end loop;
  end loop;

  if v_created = 0 then raise exception 'NO_FUTURE_OCCURRENCES'; end if;
  return jsonb_build_object('created', v_created, 'month_start', p_month_start, 'month_end', v_month_end);
end;
$$;

create or replace function public.admin_update_session_teachers(
  p_session_id uuid,
  p_staff_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_old_staff_ids uuid[];
  v_student_count integer;
  v_count integer;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_session_id is null or p_staff_ids is null or cardinality(p_staff_ids) = 0 then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'SCHEDULED' or v_session.scheduled_start_at <= now() then raise exception 'SESSION_LOCKED'; end if;

  select count(distinct staff_id)::integer into v_count from unnest(p_staff_ids) as staff(staff_id);
  if v_count <> cardinality(p_staff_ids) then raise exception 'DUPLICATE_TEACHER'; end if;
  select count(*)::integer into v_count from public.staff
  where id = any(p_staff_ids) and status = 'ACTIVE' and staff_type = 'TEACHER';
  if v_count <> cardinality(p_staff_ids) then raise exception 'TEACHER_NOT_ACTIVE'; end if;
  select array_agg(ss.staff_id order by ss.staff_id) into v_old_staff_ids from public.session_staff ss where ss.session_id = p_session_id;
  select count(*)::integer into v_student_count from public.session_students ss where ss.session_id = p_session_id;

  if exists (
    select 1 from public.sessions other
    where other.id <> p_session_id and other.status in ('SCHEDULED', 'IN_PROGRESS')
      and other.scheduled_start_at < v_session.scheduled_end_at and other.scheduled_end_at > v_session.scheduled_start_at
      and exists (select 1 from public.session_staff a where a.session_id = other.id and a.staff_id = any(p_staff_ids))
  ) then raise exception 'SCHEDULE_CONFLICT'; end if;

  delete from public.session_staff where session_id = p_session_id;
  insert into public.session_staff(session_id, staff_id, assignment_role)
  select p_session_id, staff_id, 'TEACHER' from unnest(p_staff_ids) as teachers(staff_id);
  update public.sessions set staff_assignment_override = true where id = p_session_id;
  perform public.write_audit(auth.uid(), 'SESSION_TEACHERS_UPDATE', 'sessions', p_session_id,
    jsonb_build_object('staff_ids', coalesce(v_old_staff_ids, '{}'::uuid[])),
    jsonb_build_object('staff_ids', p_staff_ids, 'roster_count', v_student_count));
  return jsonb_build_object('session_id', p_session_id, 'staff_ids', p_staff_ids, 'override', true);
end;
$$;

revoke all on function public.generate_upcoming_sessions(integer) from public, anon;
grant execute on function public.generate_upcoming_sessions(integer) to authenticated, service_role;
revoke all on function public.admin_create_session(uuid, timestamptz, timestamptz, uuid[]) from public, anon;
revoke all on function public.admin_apply_week_to_month(uuid[], date) from public, anon;
revoke all on function public.admin_update_session_teachers(uuid, uuid[]) from public, anon;
grant execute on function public.admin_create_session(uuid, timestamptz, timestamptz, uuid[]) to authenticated;
grant execute on function public.admin_apply_week_to_month(uuid[], date) to authenticated;
grant execute on function public.admin_update_session_teachers(uuid, uuid[]) to authenticated;
