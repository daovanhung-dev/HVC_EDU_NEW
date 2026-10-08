-- Keep manually planned future sessions in sync with effective class memberships.
-- These sessions include Admin-created occurrences and one-time month templates.

create index if not exists sessions_manual_scheduled_start_idx
  on public.sessions (scheduled_start_at, class_id)
  where manual_schedule and status = 'SCHEDULED';

create or replace function public.sync_future_manual_session_student_rosters(
  p_class_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session record;
  v_candidate record;
  v_session_date date;
  v_conflict_reason text;
  v_added integer := 0;
  v_conflicts integer := 0;
  v_row_count integer := 0;
begin
  if auth.uid() is not null and not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  for v_session in
    select s.id, s.class_id, s.scheduled_start_at, s.scheduled_end_at, s.room
    from public.sessions s
    join public.classes c on c.id = s.class_id
    where s.manual_schedule
      and s.status = 'SCHEDULED'
      and s.scheduled_start_at > now()
      and c.status = 'ACTIVE'
      and (p_class_id is null or s.class_id = p_class_id)
    order by s.scheduled_start_at, s.id
    for update of s
  loop
    v_session_date := (v_session.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date;

    for v_candidate in
      select distinct cm.student_id
      from public.class_memberships cm
      join public.students st on st.id = cm.student_id
      where cm.class_id = v_session.class_id
        and cm.status = 'ACTIVE'
        and st.status = 'ACTIVE'
        and cm.start_date <= v_session_date
        and (cm.end_date is null or cm.end_date >= v_session_date)
        and not exists (
          select 1
          from public.session_students existing
          where existing.session_id = v_session.id
            and existing.student_id = cm.student_id
        )
      order by cm.student_id
    loop
      v_conflict_reason := public.session_schedule_conflict_reason(
        v_session.id,
        v_session.class_id,
        v_session.scheduled_start_at,
        v_session.scheduled_end_at,
        v_session.room,
        array[v_candidate.student_id]::uuid[]
      );

      if v_conflict_reason is not null then
        v_conflicts := v_conflicts + 1;
        continue;
      end if;

      insert into public.session_students(session_id, student_id)
      values (v_session.id, v_candidate.student_id)
      on conflict (session_id, student_id) do nothing;
      get diagnostics v_row_count = row_count;
      v_added := v_added + v_row_count;
    end loop;
  end loop;

  return jsonb_build_object(
    'manual_rosters_added', v_added,
    'manual_roster_conflicts', v_conflicts
  );
end;
$$;

revoke all on function public.sync_future_manual_session_student_rosters(uuid)
  from public, anon, authenticated, service_role;
comment on function public.sync_future_manual_session_student_rosters(uuid) is
  'Internal roster synchronization for future manually scheduled sessions; callable only by the database owner through controlled workflows.';

-- Preserve the established recurring generator and expose a compatible wrapper
-- that also reconciles manually scheduled future sessions.
alter function public.generate_upcoming_sessions(integer)
  rename to generate_upcoming_sessions_before_manual_roster_sync;
revoke all on function public.generate_upcoming_sessions_before_manual_roster_sync(integer)
  from public, anon, authenticated, service_role;

create function public.generate_upcoming_sessions(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_generation jsonb;
  v_manual_rosters jsonb;
begin
  if auth.uid() is not null and not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  v_generation := public.generate_upcoming_sessions_before_manual_roster_sync(p_days);
  v_manual_rosters := public.sync_future_manual_session_student_rosters(null);

  return v_generation || v_manual_rosters;
end;
$$;

revoke all on function public.generate_upcoming_sessions(integer) from public, anon;
grant execute on function public.generate_upcoming_sessions(integer) to authenticated, service_role;
comment on function public.generate_upcoming_sessions(integer) is
  'Generate recurring sessions and synchronize active student memberships into future manually scheduled sessions.';

-- Repair existing future manual sessions once when this migration is applied.
select public.sync_future_manual_session_student_rosters(null);
