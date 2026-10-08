alter table public.sessions
  add column recurrence_schedule_snapshot jsonb not null default '{}'::jsonb;

comment on column public.sessions.recurrence_schedule_snapshot is
  'Immutable schedule-template snapshot retained when a recurring schedule is deleted while its session history remains.';

create or replace function public.admin_preview_schedule_reset_for_month(p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_month_end date;
  v_schedule_count integer;
  v_recurring_session_count integer;
  v_month_manual_session_count integer;
  v_protected_session_count integer;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start then
    raise exception 'INVALID_INPUT';
  end if;

  v_month_end := (p_month_start + interval '1 month')::date;

  select count(*)::integer into v_schedule_count
  from public.class_schedules;

  select count(*)::integer into v_recurring_session_count
  from public.sessions s
  where s.status = 'SCHEDULED' and not s.manual_schedule;

  select count(*)::integer into v_month_manual_session_count
  from public.sessions s
  where s.status = 'SCHEDULED' and s.manual_schedule
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end;

  with candidates as (
    select s.id
    from public.sessions s
    where s.status = 'SCHEDULED'
      and (not s.manual_schedule or (
        (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
        and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
      ))
  )
  select count(*)::integer into v_protected_session_count
  from candidates c
  where exists (select 1 from public.student_attendances a where a.session_id = c.id)
     or exists (select 1 from public.timesheets t where t.session_id = c.id)
     or exists (select 1 from public.staff_replacements r where r.session_id = c.id)
     or exists (select 1 from public.payroll_items p where p.session_id = c.id)
     or exists (
       select 1 from public.session_students ss
       where ss.session_id = c.id and ss.assessment_snapshot <> '{}'::jsonb
     )
     or exists (
       select 1 from public.sessions s
       where s.id = c.id
         and (nullif(btrim(s.lesson_content), '') is not null
           or nullif(btrim(s.session_note), '') is not null
           or s.import_metadata <> '{}'::jsonb)
     );

  return jsonb_build_object(
    'schedule_count', v_schedule_count,
    'recurring_session_count', v_recurring_session_count,
    'month_manual_session_count', v_month_manual_session_count,
    'protected_session_count', v_protected_session_count
  );
end;
$$;

create or replace function public.admin_delete_schedule_reset_for_month(p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_month_end date;
  v_protected_session_count integer;
  v_deleted_schedules integer := 0;
  v_deleted_recurring_sessions integer := 0;
  v_deleted_month_manual_sessions integer := 0;
  v_deleted_sessions_total integer := 0;
  v_schedule record;
  v_session record;
  v_schedule_snapshot jsonb;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start then
    raise exception 'INVALID_INPUT';
  end if;

  -- Keep the generator and Admin writes from creating or changing rows mid-delete.
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.class_schedules in share row exclusive mode;
  lock table public.class_schedule_staff in share row exclusive mode;
  lock table public.sessions in share row exclusive mode;

  v_month_end := (p_month_start + interval '1 month')::date;

  with candidates as (
    select s.id
    from public.sessions s
    where s.status = 'SCHEDULED'
      and (not s.manual_schedule or (
        (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
        and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
      ))
  )
  select count(*)::integer into v_protected_session_count
  from candidates c
  where exists (select 1 from public.student_attendances a where a.session_id = c.id)
     or exists (select 1 from public.timesheets t where t.session_id = c.id)
     or exists (select 1 from public.staff_replacements r where r.session_id = c.id)
     or exists (select 1 from public.payroll_items p where p.session_id = c.id)
     or exists (
       select 1 from public.session_students ss
       where ss.session_id = c.id and ss.assessment_snapshot <> '{}'::jsonb
     )
     or exists (
       select 1 from public.sessions s
       where s.id = c.id
         and (nullif(btrim(s.lesson_content), '') is not null
           or nullif(btrim(s.session_note), '') is not null
           or s.import_metadata <> '{}'::jsonb)
     );

  if v_protected_session_count > 0 then
    raise exception 'RESET_PROTECTED_HISTORY';
  end if;

  for v_schedule in
    select cs.* from public.class_schedules cs order by cs.id for update
  loop
    perform public.write_audit(
      v_actor,
      'CLASS_SCHEDULE_BULK_RESET_DELETE',
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
      'Admin deleted all recurring schedules and reset sessions for month ' || p_month_start::text
    );
  end loop;

  -- The sessions FK uses ON DELETE SET NULL. Preserve the linked template data
  -- on every surviving occurrence before deleting all recurring templates.
  for v_session in
    select s.id, s.recurrence_schedule_id,
      cs.class_id, cs.day_of_week, cs.start_time, cs.end_time, cs.room, cs.status
    from public.sessions s
    join public.class_schedules cs on cs.id = s.recurrence_schedule_id
    where s.recurrence_schedule_snapshot = '{}'::jsonb
      and not (
        s.status = 'SCHEDULED'
        and (not s.manual_schedule or (
          (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
          and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
        ))
      )
    order by s.id
    for update of s
  loop
    v_schedule_snapshot := jsonb_build_object(
      'schedule_id', v_session.recurrence_schedule_id,
      'class_id', v_session.class_id,
      'day_of_week', v_session.day_of_week,
      'start_time', v_session.start_time,
      'end_time', v_session.end_time,
      'room', v_session.room,
      'status', v_session.status
    );
    perform public.write_audit(
      v_actor,
      'SESSION_RECURRENCE_SNAPSHOT_PRESERVE',
      'sessions',
      v_session.id,
      jsonb_build_object('recurrence_schedule_id', v_session.recurrence_schedule_id),
      jsonb_build_object('recurrence_schedule_snapshot', v_schedule_snapshot),
      'Preserved recurring schedule details before deleting schedule templates'
    );
    update public.sessions
    set recurrence_schedule_snapshot = v_schedule_snapshot
    where id = v_session.id;
  end loop;

  for v_session in
    select s.*
    from public.sessions s
    where s.status = 'SCHEDULED'
      and (not s.manual_schedule or (
        (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
        and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
      ))
    order by s.id
    for update
  loop
    perform public.write_audit(
      v_actor,
      'SESSION_BULK_RESET_DELETE',
      'sessions',
      v_session.id,
      jsonb_build_object(
        'class_id', v_session.class_id,
        'recurrence_schedule_id', v_session.recurrence_schedule_id,
        'recurrence_occurrence_date', v_session.recurrence_occurrence_date,
        'scheduled_start_at', v_session.scheduled_start_at,
        'scheduled_end_at', v_session.scheduled_end_at,
        'status', v_session.status,
        'manual_schedule', v_session.manual_schedule
      ),
      null,
      'Admin deleted scheduled session as part of reset for month ' || p_month_start::text
    );
    if v_session.manual_schedule then
      v_deleted_month_manual_sessions := v_deleted_month_manual_sessions + 1;
    else
      v_deleted_recurring_sessions := v_deleted_recurring_sessions + 1;
    end if;
  end loop;

  delete from public.session_students ss
  using public.sessions s
  where ss.session_id = s.id
    and s.status = 'SCHEDULED'
    and (not s.manual_schedule or (
      (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
      and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
    ));

  delete from public.session_staff ss
  using public.sessions s
  where ss.session_id = s.id
    and s.status = 'SCHEDULED'
    and (not s.manual_schedule or (
      (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
      and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
    ));

  delete from public.sessions s
  where s.status = 'SCHEDULED'
    and (not s.manual_schedule or (
      (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month_start
      and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
    ));

  get diagnostics v_deleted_sessions_total = row_count;

  if v_deleted_sessions_total <> v_deleted_recurring_sessions + v_deleted_month_manual_sessions then
    raise exception 'RESET_DELETE_COUNT_MISMATCH';
  end if;

  delete from public.class_schedules;
  get diagnostics v_deleted_schedules = row_count;

  return jsonb_build_object(
    'deleted_schedules', v_deleted_schedules,
    'deleted_recurring_sessions', v_deleted_recurring_sessions,
    'deleted_month_manual_sessions', v_deleted_month_manual_sessions
  );
end;
$$;

-- Old clients must fail safely rather than continuing to archive schedules and cancel all sessions.
revoke all on function public.admin_preview_all_schedules_reset() from public, anon, authenticated;
revoke all on function public.admin_reset_all_schedules() from public, anon, authenticated;

revoke all on function public.admin_preview_schedule_reset_for_month(date) from public, anon, authenticated;
revoke all on function public.admin_delete_schedule_reset_for_month(date) from public, anon, authenticated;
grant execute on function public.admin_preview_schedule_reset_for_month(date) to authenticated;
grant execute on function public.admin_delete_schedule_reset_for_month(date) to authenticated;
