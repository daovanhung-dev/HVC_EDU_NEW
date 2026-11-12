-- Monthly room rentals can include elapsed dates and may overlap a matching
-- class taught by the renter only after the Admin confirms the conflict list.
create or replace function public.room_rental_conflict_reason_for_write(
  p_room_rental_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_room text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room text := nullif(lower(btrim(p_room)), '');
  v_date date;
  v_start_time time;
  v_end_time time;
  v_other record;
  v_allow_past boolean := coalesce(current_setting('hvc.room_rental_allow_past', true) = 'true', false);
  v_allow_class_overlap boolean := coalesce(current_setting('hvc.room_rental_allow_class_overlap', true) = 'true', false);
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at
     or (not v_allow_past and p_starts_at <= now())
     or (not v_allow_past and (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date <
        (now() at time zone 'Asia/Ho_Chi_Minh')::date)
     or (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date <>
        (p_ends_at at time zone 'Asia/Ho_Chi_Minh')::date
     or v_room is null then
    return 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  v_date := (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_start_time := (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::time;
  v_end_time := (p_ends_at at time zone 'Asia/Ho_Chi_Minh')::time;

  for v_other in
    select s.id, s.class_id, s.room
    from public.sessions s
    where (
        s.status in ('SCHEDULED', 'IN_PROGRESS')
        or (v_allow_past and p_starts_at <= now() and s.status = 'COMPLETED')
      )
      and s.scheduled_start_at < p_ends_at
      and s.scheduled_end_at > p_starts_at
    order by s.scheduled_start_at, s.id
  loop
    if nullif(lower(btrim(v_other.room)), '') is null then
      return 'ROOM_REQUIRED_FOR_OVERLAP';
    end if;
    if v_room = nullif(lower(btrim(v_other.room)), '') then
      if v_allow_class_overlap and exists (
        select 1
        from public.session_staff ss
        where ss.session_id = v_other.id
          and ss.staff_id = p_staff_id
          and ss.assignment_role = 'TEACHER'
      ) then
        continue;
      end if;
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  for v_other in
    select cs.id, cs.class_id, cs.room
    from public.class_schedules cs
    join public.classes c on c.id = cs.class_id
    where cs.status = 'ACTIVE'
      and cs.reviewed_at is not null
      and c.status = 'ACTIVE'
      and cs.day_of_week = extract(isodow from v_date)::integer
      and cs.start_time < v_end_time
      and cs.end_time > v_start_time
      and not exists (
        select 1 from public.class_schedule_month_overrides mo
        where mo.month_start = date_trunc('month', v_date)::date
      )
      and not exists (
        select 1 from public.deleted_session_occurrences dso
        where dso.class_schedule_id = cs.id
          and dso.occurrence_date = v_date
      )
      and not exists (
        select 1 from public.sessions occurrence
        where occurrence.recurrence_schedule_id = cs.id
          and occurrence.recurrence_occurrence_date = v_date
      )
    order by cs.id
  loop
    if nullif(lower(btrim(v_other.room)), '') is null then
      return 'ROOM_REQUIRED_FOR_OVERLAP';
    end if;
    if v_room = nullif(lower(btrim(v_other.room)), '') then
      if v_allow_class_overlap and exists (
        select 1
        from public.class_schedule_staff css
        where css.schedule_id = v_other.id
          and css.staff_id = p_staff_id
      ) then
        continue;
      end if;
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  for v_other in
    select r.id, r.room
    from public.room_rentals r
    where r.id is distinct from p_room_rental_id
      and r.status = 'BOOKED'
      and r.starts_at < p_ends_at
      and r.ends_at > p_starts_at
    order by r.starts_at, r.id
  loop
    if v_room = nullif(lower(btrim(v_other.room)), '') then
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.room_rental_conflict_reason_for_write(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;

create or replace function public.guard_room_rental_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text;
begin
  if new.status <> 'BOOKED' then
    return new;
  end if;

  new.room := btrim(new.room);
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  v_reason := public.room_rental_conflict_reason_for_write(
    new.id, new.staff_id, new.starts_at, new.ends_at, new.room
  );
  if v_reason is not null then
    raise exception using message = v_reason;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_room_rental_conflicts() from public, anon, authenticated;
