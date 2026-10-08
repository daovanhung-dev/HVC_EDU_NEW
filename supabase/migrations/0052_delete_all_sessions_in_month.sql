create or replace function public.admin_preview_delete_sessions_for_month(p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_month_end date;
  v_month_start_at timestamptz;
  v_month_end_at timestamptz;
  v_schedule_count integer;
  v_schedule_staff_count integer;
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
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start then
    raise exception 'INVALID_INPUT';
  end if;

  v_month_end := (p_month_start + interval '1 month')::date;
  v_month_start_at := p_month_start::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_month_end_at := v_month_end::timestamp at time zone 'Asia/Ho_Chi_Minh';

  select count(*)::integer into v_schedule_count
  from public.class_schedules;

  select count(*)::integer into v_schedule_staff_count
  from public.class_schedule_staff;

  select
    count(*)::integer,
    count(*) filter (where s.status = 'SCHEDULED')::integer,
    count(*) filter (where s.status = 'IN_PROGRESS')::integer,
    count(*) filter (where s.status = 'COMPLETED')::integer,
    count(*) filter (where s.status = 'CANCELLED')::integer
  into v_session_count, v_scheduled_count, v_in_progress_count, v_completed_count, v_cancelled_count
  from public.sessions s
  where s.scheduled_start_at >= v_month_start_at
    and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer, count(*) filter (where ss.assessment_snapshot <> '{}'::jsonb)::integer
  into v_session_student_count, v_assessment_count
  from public.session_students ss
  join public.sessions s on s.id = ss.session_id
  where s.scheduled_start_at >= v_month_start_at
    and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_session_staff_count
  from public.session_staff ss
  join public.sessions s on s.id = ss.session_id
  where s.scheduled_start_at >= v_month_start_at
    and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_staff_replacement_count
  from public.staff_replacements r
  join public.sessions s on s.id = r.session_id
  where s.scheduled_start_at >= v_month_start_at
    and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_attendance_count
  from public.student_attendances a
  join public.sessions s on s.id = a.session_id
  where s.scheduled_start_at >= v_month_start_at
    and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_timesheet_count
  from public.timesheets t
  join public.sessions s on s.id = t.session_id
  where s.scheduled_start_at >= v_month_start_at
    and s.scheduled_start_at < v_month_end_at;

  select count(*)::integer into v_payroll_item_count
  from public.payroll_items p
  where p.session_id in (
      select s.id from public.sessions s
      where s.scheduled_start_at >= v_month_start_at
        and s.scheduled_start_at < v_month_end_at
    )
    or p.timesheet_id in (
      select t.id
      from public.timesheets t
      join public.sessions s on s.id = t.session_id
      where s.scheduled_start_at >= v_month_start_at
        and s.scheduled_start_at < v_month_end_at
    );

  return jsonb_build_object(
    'month_start', p_month_start,
    'schedule_count', v_schedule_count,
    'schedule_staff_count', v_schedule_staff_count,
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
    'payroll_item_count', v_payroll_item_count
  );
end;
$$;

create or replace function public.admin_delete_sessions_for_month(p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_month_end date;
  v_month_start_at timestamptz;
  v_month_end_at timestamptz;
  v_session_ids uuid[] := array[]::uuid[];
  v_session public.sessions%rowtype;
  v_schedule record;
  v_snapshot record;
  v_session_count integer := 0;
  v_deleted_sessions integer := 0;
  v_deleted_schedules integer := 0;
  v_deleted_schedule_staff integer := 0;
  v_deleted_session_students integer := 0;
  v_deleted_session_staff integer := 0;
  v_deleted_staff_replacements integer := 0;
  v_deleted_attendances integer := 0;
  v_deleted_timesheets integer := 0;
  v_deleted_payroll_items integer := 0;
  v_status_counts jsonb;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start then
    raise exception 'INVALID_INPUT';
  end if;

  -- Serialize with recurring-session generation and other calendar writers.
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.class_schedules in share row exclusive mode;
  lock table public.class_schedule_staff in share row exclusive mode;
  lock table public.sessions in share row exclusive mode;

  v_month_end := (p_month_start + interval '1 month')::date;
  v_month_start_at := p_month_start::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_month_end_at := v_month_end::timestamp at time zone 'Asia/Ho_Chi_Minh';

  select
    count(*)::integer,
    jsonb_build_object(
      'SCHEDULED', count(*) filter (where s.status = 'SCHEDULED'),
      'IN_PROGRESS', count(*) filter (where s.status = 'IN_PROGRESS'),
      'COMPLETED', count(*) filter (where s.status = 'COMPLETED'),
      'CANCELLED', count(*) filter (where s.status = 'CANCELLED')
    )
  into v_session_count, v_status_counts
  from public.sessions s
  where s.scheduled_start_at >= v_month_start_at
    and s.scheduled_start_at < v_month_end_at;

  for v_session in
    select s.*
    from public.sessions s
    where s.scheduled_start_at >= v_month_start_at
      and s.scheduled_start_at < v_month_end_at
    order by s.id
    for update
  loop
    v_session_ids := array_append(v_session_ids, v_session.id);
    perform public.write_audit(
      v_actor,
      'SESSION_MONTH_BULK_DELETE',
      'sessions',
      v_session.id,
      jsonb_build_object(
        'class_id', v_session.class_id,
        'scheduled_start_at', v_session.scheduled_start_at,
        'scheduled_end_at', v_session.scheduled_end_at,
        'status', v_session.status,
        'manual_schedule', v_session.manual_schedule,
        'recurrence_schedule_id', v_session.recurrence_schedule_id,
        'session_students', (
          select count(*) from public.session_students ss where ss.session_id = v_session.id
        ),
        'session_staff', (
          select count(*) from public.session_staff ss where ss.session_id = v_session.id
        ),
        'staff_replacements', (
          select count(*) from public.staff_replacements r where r.session_id = v_session.id
        ),
        'attendances', (
          select count(*) from public.student_attendances a where a.session_id = v_session.id
        ),
        'timesheets', (
          select count(*) from public.timesheets t where t.session_id = v_session.id
        ),
        'payroll_items', (
          select count(*) from public.payroll_items p
          where p.session_id = v_session.id
             or p.timesheet_id in (
               select t.id from public.timesheets t where t.session_id = v_session.id
             )
        )
      ),
      null,
      'Admin permanently deleted session from month ' || p_month_start::text
    );
  end loop;

  -- Keep provenance on surviving sessions before their template FK is cleared.
  for v_snapshot in
    select s.id, s.recurrence_schedule_id,
      cs.class_id, cs.day_of_week, cs.start_time, cs.end_time, cs.room, cs.status
    from public.sessions s
    join public.class_schedules cs on cs.id = s.recurrence_schedule_id
    where s.recurrence_schedule_snapshot = '{}'::jsonb
      and not (s.id = any(v_session_ids))
    order by s.id
    for update of s
  loop
    perform public.write_audit(
      v_actor,
      'SESSION_RECURRENCE_SNAPSHOT_PRESERVE',
      'sessions',
      v_snapshot.id,
      jsonb_build_object('recurrence_schedule_id', v_snapshot.recurrence_schedule_id),
      jsonb_build_object(
        'recurrence_schedule_snapshot',
        jsonb_build_object(
          'schedule_id', v_snapshot.recurrence_schedule_id,
          'class_id', v_snapshot.class_id,
          'day_of_week', v_snapshot.day_of_week,
          'start_time', v_snapshot.start_time,
          'end_time', v_snapshot.end_time,
          'room', v_snapshot.room,
          'status', v_snapshot.status
        )
      ),
      'Preserved recurring schedule details before deleting templates'
    );
    update public.sessions
    set recurrence_schedule_snapshot = jsonb_build_object(
      'schedule_id', v_snapshot.recurrence_schedule_id,
      'class_id', v_snapshot.class_id,
      'day_of_week', v_snapshot.day_of_week,
      'start_time', v_snapshot.start_time,
      'end_time', v_snapshot.end_time,
      'room', v_snapshot.room,
      'status', v_snapshot.status
    )
    where id = v_snapshot.id;
  end loop;

  -- Capture schedule details before deleting every recurring template globally.
  for v_schedule in
    select cs.* from public.class_schedules cs order by cs.id for update
  loop
    perform public.write_audit(
      v_actor,
      'CLASS_SCHEDULE_BULK_DELETE',
      'class_schedules',
      v_schedule.id,
      jsonb_build_object(
        'class_id', v_schedule.class_id,
        'day_of_week', v_schedule.day_of_week,
        'start_time', v_schedule.start_time,
        'end_time', v_schedule.end_time,
        'room', v_schedule.room,
        'status', v_schedule.status,
        'staff_ids', coalesce((
          select jsonb_agg(css.staff_id order by css.staff_id)
          from public.class_schedule_staff css
          where css.schedule_id = v_schedule.id
        ), '[]'::jsonb)
      ),
      null,
      'Admin deleted all recurring templates while clearing month ' || p_month_start::text
    );
  end loop;

  select count(*)::integer into v_deleted_schedule_staff
  from public.class_schedule_staff;

  delete from public.payroll_items p
  where p.session_id = any(v_session_ids)
     or p.timesheet_id in (
       select t.id from public.timesheets t where t.session_id = any(v_session_ids)
     );
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
  if v_deleted_sessions <> cardinality(v_session_ids) then
    raise exception 'DELETE_COUNT_MISMATCH';
  end if;

  delete from public.class_schedule_staff;
  delete from public.class_schedules;
  get diagnostics v_deleted_schedules = row_count;

  return jsonb_build_object(
    'month_start', p_month_start,
    'deleted_sessions', v_deleted_sessions,
    'deleted_schedules', v_deleted_schedules,
    'deleted_schedule_staff', v_deleted_schedule_staff,
    'deleted_status_counts', v_status_counts,
    'deleted_session_students', v_deleted_session_students,
    'deleted_session_staff', v_deleted_session_staff,
    'deleted_staff_replacements', v_deleted_staff_replacements,
    'deleted_attendances', v_deleted_attendances,
    'deleted_timesheets', v_deleted_timesheets,
    'deleted_payroll_items', v_deleted_payroll_items
  );
end;
$$;

-- Prevent old clients from invoking reset behavior with a destructive control.
revoke all on function public.admin_preview_schedule_reset_for_month(date) from public, anon, authenticated;
revoke all on function public.admin_delete_schedule_reset_for_month(date) from public, anon, authenticated;
revoke all on function public.admin_preview_all_schedules_reset() from public, anon, authenticated;
revoke all on function public.admin_reset_all_schedules() from public, anon, authenticated;

revoke all on function public.admin_preview_delete_sessions_for_month(date) from public, anon, authenticated;
revoke all on function public.admin_delete_sessions_for_month(date) from public, anon, authenticated;
grant execute on function public.admin_preview_delete_sessions_for_month(date) to authenticated;
grant execute on function public.admin_delete_sessions_for_month(date) to authenticated;
