create table public.room_rentals (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  room text not null check (length(btrim(room)) between 1 and 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'BOOKED' check (status in ('BOOKED', 'CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (starts_at at time zone 'Asia/Ho_Chi_Minh')::date =
    (ends_at at time zone 'Asia/Ho_Chi_Minh')::date
  ),
  check (
    (status = 'BOOKED' and cancelled_at is null and cancelled_by is null)
    or (status = 'CANCELLED' and cancelled_at is not null)
  )
);

create index room_rentals_starts_at_idx
  on public.room_rentals(starts_at, ends_at)
  where status = 'BOOKED';
create index room_rentals_staff_starts_at_idx
  on public.room_rentals(staff_id, starts_at);

create trigger room_rentals_set_updated_at
  before update on public.room_rentals
  for each row execute function public.set_updated_at();

alter table public.room_rentals enable row level security;
revoke all on public.room_rentals from public, anon, authenticated;
grant select on public.room_rentals to authenticated;
grant all on public.room_rentals to service_role;
create policy room_rentals_admin_select on public.room_rentals
  for select using (exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'ACTIVE'
      and p.role in ('ADMIN', 'ROOT_ADMIN')
  ));

comment on table public.room_rentals is
  'Concrete room-rental bookings managed by Admin; no class attendance or learning records are attached.';

create or replace function public.room_rental_conflict_reason(
  p_room_rental_id uuid,
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
  v_other_room text;
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at
     or p_starts_at <= now()
     or (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date <
        (now() at time zone 'Asia/Ho_Chi_Minh')::date
     or (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date <>
        (p_ends_at at time zone 'Asia/Ho_Chi_Minh')::date
     or v_room is null then
    return 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  v_date := (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_start_time := (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::time;
  v_end_time := (p_ends_at at time zone 'Asia/Ho_Chi_Minh')::time;

  for v_other_room in
    select s.room
    from public.sessions s
    where s.status in ('SCHEDULED', 'IN_PROGRESS')
      and s.scheduled_start_at < p_ends_at
      and s.scheduled_end_at > p_starts_at
    order by s.scheduled_start_at, s.id
  loop
    if nullif(lower(btrim(v_other_room)), '') is null then
      return 'ROOM_REQUIRED_FOR_OVERLAP';
    end if;
    if v_room = nullif(lower(btrim(v_other_room)), '') then
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  for v_other_room in
    select cs.room
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
    if nullif(lower(btrim(v_other_room)), '') is null then
      return 'ROOM_REQUIRED_FOR_OVERLAP';
    end if;
    if v_room = nullif(lower(btrim(v_other_room)), '') then
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  for v_other_room in
    select r.room
    from public.room_rentals r
    where r.id is distinct from p_room_rental_id
      and r.status = 'BOOKED'
      and r.starts_at < p_ends_at
      and r.ends_at > p_starts_at
    order by r.starts_at, r.id
  loop
    if v_room = nullif(lower(btrim(v_other_room)), '') then
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.room_rental_conflict_reason(uuid, timestamptz, timestamptz, text)
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
  v_reason := public.room_rental_conflict_reason(
    new.id, new.starts_at, new.ends_at, new.room
  );
  if v_reason is not null then
    raise exception using message = v_reason;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_room_rental_conflicts() from public, anon, authenticated;
create trigger room_rentals_guard_conflicts
  before insert or update of staff_id, room, starts_at, ends_at, status
  on public.room_rentals
  for each row execute function public.guard_room_rental_conflicts();

create or replace function public.guard_class_schedule_room_rentals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rental record;
  v_occurrence record;
  v_occurrence_date date;
  v_effective_date date;
  v_effective_start time;
  v_effective_end time;
  v_effective_room text;
  v_rental_room text;
  v_effective_room_normalized text;
begin
  if new.status <> 'ACTIVE' or new.reviewed_at is null or not exists (
    select 1 from public.classes c where c.id = new.class_id and c.status = 'ACTIVE'
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  for v_rental in
    select r.*
    from public.room_rentals r
    where r.status = 'BOOKED'
      and r.ends_at > now()
      and extract(isodow from (r.starts_at at time zone 'Asia/Ho_Chi_Minh'))::integer = new.day_of_week
      and not exists (
        select 1 from public.class_schedule_month_overrides mo
        where mo.month_start = date_trunc(
          'month', (r.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
        )::date
      )
      and not exists (
        select 1 from public.deleted_session_occurrences dso
        where dso.class_schedule_id = new.id
          and dso.occurrence_date = (r.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
      )
    order by r.starts_at, r.id
  loop
    v_occurrence_date := (v_rental.starts_at at time zone 'Asia/Ho_Chi_Minh')::date;
    v_effective_date := v_occurrence_date;
    v_effective_start := new.start_time;
    v_effective_end := new.end_time;
    v_effective_room := new.room;

    select s.* into v_occurrence
    from public.sessions s
    where s.recurrence_schedule_id = new.id
      and s.recurrence_occurrence_date = v_occurrence_date
    limit 1;

    if found then
      if v_occurrence.status = 'CANCELLED' then
        continue;
      end if;
      if v_occurrence.schedule_override then
        v_effective_date := (v_occurrence.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date;
        v_effective_start := (v_occurrence.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time;
        v_effective_end := (v_occurrence.scheduled_end_at at time zone 'Asia/Ho_Chi_Minh')::time;
      end if;
      if v_occurrence.room_override then
        v_effective_room := v_occurrence.room;
      end if;
    end if;

    v_rental_room := nullif(lower(btrim(v_rental.room)), '');
    v_effective_room_normalized := nullif(lower(btrim(v_effective_room)), '');

    if v_effective_date = v_occurrence_date
       and v_effective_start < (v_rental.ends_at at time zone 'Asia/Ho_Chi_Minh')::time
       and v_effective_end > (v_rental.starts_at at time zone 'Asia/Ho_Chi_Minh')::time then
      if v_effective_room_normalized is null then
        raise exception using message = 'ROOM_REQUIRED_FOR_OVERLAP';
      end if;
      if v_effective_room_normalized = v_rental_room then
        raise exception using message = 'ROOM_ALREADY_BOOKED';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.guard_class_schedule_room_rentals() from public, anon, authenticated;
create trigger class_schedules_guard_room_rentals
  before insert or update of day_of_week, start_time, end_time, room, status, reviewed_at
  on public.class_schedules
  for each row execute function public.guard_class_schedule_room_rentals();

create or replace function public.session_schedule_conflict_reason(
  p_session_id uuid,
  p_class_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_room text,
  p_student_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_other record;
  v_room text := nullif(lower(btrim(p_room)), '');
begin
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));

  for v_other in
    select s.id, s.class_id, s.room
    from public.sessions s
    where s.id is distinct from p_session_id
      and (
        s.status in ('SCHEDULED', 'IN_PROGRESS')
        or (p_start_at <= now() and s.status = 'COMPLETED')
      )
      and s.scheduled_start_at < p_end_at
      and s.scheduled_end_at > p_start_at
    order by s.scheduled_start_at, s.id
  loop
    if v_other.class_id = p_class_id
       or exists (
         select 1
         from public.session_students existing_student
         where existing_student.session_id = v_other.id
           and existing_student.student_id = any(coalesce(p_student_ids, '{}'::uuid[]))
       ) then
      return 'SCHEDULE_CONFLICT';
    end if;

    if v_room is null or nullif(lower(btrim(v_other.room)), '') is null then
      return 'ROOM_REQUIRED_FOR_OVERLAP';
    end if;
    if v_room = nullif(lower(btrim(v_other.room)), '') then
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  if exists (
    select 1
    from public.room_rentals r
    where r.status = 'BOOKED'
      and r.starts_at < p_end_at
      and r.ends_at > p_start_at
      and (v_room is null or v_room = nullif(lower(btrim(r.room)), ''))
  ) then
    if v_room is null then
      return 'ROOM_REQUIRED_FOR_OVERLAP';
    end if;
    return 'ROOM_ALREADY_BOOKED';
  end if;

  return null;
end;
$$;

revoke all on function public.session_schedule_conflict_reason(uuid, uuid, timestamptz, timestamptz, text, uuid[])
  from public, anon, authenticated;
