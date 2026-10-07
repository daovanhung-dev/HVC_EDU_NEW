-- Archived schedule rows remain historical records and must not block a replacement slot.
alter table public.class_schedules
  drop constraint if exists class_schedules_class_id_day_of_week_start_time_key;

create unique index class_schedules_unarchived_slot_uidx
  on public.class_schedules (class_id, day_of_week, start_time)
  where status <> 'ARCHIVED';

create or replace function public.admin_preview_all_schedules_reset()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_schedule_count integer;
  v_session_count integer;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;

  select count(*)::integer into v_schedule_count
  from public.class_schedules
  where status <> 'ARCHIVED';

  select count(*)::integer into v_session_count
  from public.sessions
  where status = 'SCHEDULED';

  return jsonb_build_object(
    'schedule_count', v_schedule_count,
    'session_count', v_session_count
  );
end;
$$;

create or replace function public.admin_reset_all_schedules()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_archived_schedules integer := 0;
  v_cancelled_sessions integer := 0;
  v_session record;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;

  -- Serialize with automatic generation so no recurring session is created mid-reset.
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  update public.class_schedules
  set status = 'ARCHIVED', reviewed_at = null, reviewed_by = null
  where status <> 'ARCHIVED';
  get diagnostics v_archived_schedules = row_count;

  for v_session in
    with cancelled as (
      update public.sessions
      set status = 'CANCELLED'
      where status = 'SCHEDULED'
      returning id, scheduled_start_at, scheduled_end_at, recurrence_schedule_id, manual_schedule
    )
    select * from cancelled
  loop
    perform public.write_audit(
      v_actor,
      'SESSION_BULK_RESET_CANCEL',
      'sessions',
      v_session.id,
      jsonb_build_object(
        'status', 'SCHEDULED',
        'scheduled_start_at', v_session.scheduled_start_at,
        'scheduled_end_at', v_session.scheduled_end_at,
        'recurrence_schedule_id', v_session.recurrence_schedule_id,
        'manual_schedule', v_session.manual_schedule
      ),
      jsonb_build_object(
        'status', 'CANCELLED',
        'scheduled_start_at', v_session.scheduled_start_at,
        'scheduled_end_at', v_session.scheduled_end_at,
        'recurrence_schedule_id', v_session.recurrence_schedule_id,
        'manual_schedule', v_session.manual_schedule
      )
    );
    v_cancelled_sessions := v_cancelled_sessions + 1;
  end loop;

  return jsonb_build_object(
    'archived_schedules', v_archived_schedules,
    'cancelled_sessions', v_cancelled_sessions
  );
end;
$$;

revoke all on function public.admin_preview_all_schedules_reset() from public, anon;
revoke all on function public.admin_reset_all_schedules() from public, anon;
grant execute on function public.admin_preview_all_schedules_reset() to authenticated;
grant execute on function public.admin_reset_all_schedules() to authenticated;
