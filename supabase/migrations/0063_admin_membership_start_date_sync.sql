create or replace function public.admin_update_membership_start_date_and_sync_future_rosters(
  p_membership_id uuid,
  p_start_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_membership public.class_memberships%rowtype;
  v_session record;
  v_roster_result jsonb;
  v_conflict_reason text;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_sessions_updated integer := 0;
  v_students_added integer := 0;
  v_students_removed integer := 0;
  v_sessions_skipped_with_attendance integer := 0;
  v_roster_rows_retained_with_history integer := 0;
  v_added integer;
  v_removed integer;
  v_retained integer;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_membership_id is null or p_start_date is null then
    raise exception 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.class_memberships in share row exclusive mode;

  select * into v_membership
  from public.class_memberships
  where id = p_membership_id
  for update;
  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;
  if v_membership.status <> 'ACTIVE'
     or (v_membership.end_date is not null and v_membership.end_date < v_today) then
    raise exception 'MEMBERSHIP_NOT_ACTIVE';
  end if;
  if v_membership.end_date is not null and p_start_date > v_membership.end_date then
    raise exception 'MEMBERSHIP_START_AFTER_END';
  end if;

  if v_membership.start_date = p_start_date then
    return jsonb_build_object(
      'membership_id', v_membership.id,
      'previous_start_date', v_membership.start_date,
      'start_date', v_membership.start_date,
      'changed', false,
      'sessions_updated', 0,
      'students_added', 0,
      'students_removed', 0,
      'sessions_skipped_with_attendance', 0,
      'roster_rows_retained_with_history', 0
    );
  end if;

  update public.class_memberships
  set start_date = p_start_date
  where id = v_membership.id;

  for v_session in
    select s.id, s.scheduled_start_at
    from public.sessions s
    where s.class_id = v_membership.class_id
      and s.status = 'SCHEDULED'
      and s.scheduled_start_at > now()
      and s.started_at is null
      and s.ended_at is null
    order by s.scheduled_start_at, s.id
    for update of s
  loop
    if exists (
      select 1 from public.student_attendances sa
      where sa.session_id = v_session.id
    ) then
      v_sessions_skipped_with_attendance := v_sessions_skipped_with_attendance + 1;
      continue;
    end if;

    begin
      v_roster_result := public.apply_session_student_roster(v_session.id, null, 'SYNC');
    exception when raise_exception then
      v_conflict_reason := sqlerrm;
      if v_conflict_reason in ('SCHEDULE_CONFLICT', 'ROOM_REQUIRED_FOR_OVERLAP', 'ROOM_ALREADY_BOOKED') then
        raise exception using
          message = 'MEMBERSHIP_ROSTER_SYNC_CONFLICT',
          detail = jsonb_build_object(
            'session_id', v_session.id,
            'session_date', (v_session.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date,
            'reason', v_conflict_reason
          )::text;
      end if;
      raise;
    end;

    v_added := coalesce((v_roster_result ->> 'added')::integer, 0);
    v_removed := coalesce((v_roster_result ->> 'removed')::integer, 0);
    v_retained := coalesce((v_roster_result ->> 'retained_with_history')::integer, 0);
    v_students_added := v_students_added + v_added;
    v_students_removed := v_students_removed + v_removed;
    v_roster_rows_retained_with_history := v_roster_rows_retained_with_history + v_retained;
    if v_added > 0 or v_removed > 0 then
      v_sessions_updated := v_sessions_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'membership_id', v_membership.id,
    'previous_start_date', v_membership.start_date,
    'start_date', p_start_date,
    'changed', true,
    'sessions_updated', v_sessions_updated,
    'students_added', v_students_added,
    'students_removed', v_students_removed,
    'sessions_skipped_with_attendance', v_sessions_skipped_with_attendance,
    'roster_rows_retained_with_history', v_roster_rows_retained_with_history
  );
end;
$$;

revoke all on function public.admin_update_membership_start_date_and_sync_future_rosters(uuid, date)
  from public, anon;
grant execute on function public.admin_update_membership_start_date_and_sync_future_rosters(uuid, date)
  to authenticated;

comment on function public.admin_update_membership_start_date_and_sync_future_rosters(uuid, date) is
  'Updates one active class membership start date and atomically synchronizes future unstarted scheduled-session rosters for that class. Sessions with attendance and roster rows with history are preserved; any schedule conflict rolls back the entire operation.';
