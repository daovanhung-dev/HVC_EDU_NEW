-- Limit each class to five distinct teachers across non-archived schedules
-- and sessions that have not been completed or cancelled.

create or replace function public.class_teacher_assignments(
  p_class_id uuid,
  p_exclude_schedule_id uuid default null,
  p_exclude_staff_id uuid default null,
  p_exclude_session_staff_id uuid default null
)
returns table(staff_id uuid)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct assignments.staff_id
  from (
    select css.staff_id
    from public.class_schedules cs
    join public.class_schedule_staff css on css.schedule_id = cs.id
    where cs.class_id = p_class_id
      and cs.status <> 'ARCHIVED'
      and not (
        cs.id is not distinct from p_exclude_schedule_id
        and css.staff_id is not distinct from p_exclude_staff_id
      )

    union all

    select ss.staff_id
    from public.sessions s
    join public.session_staff ss on ss.session_id = s.id
    where s.class_id = p_class_id
      and s.status in ('SCHEDULED', 'IN_PROGRESS')
      and ss.assignment_role = 'TEACHER'
      and ss.id is distinct from p_exclude_session_staff_id
  ) as assignments;
$$;

create or replace function public.enforce_class_teacher_assignment_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_class_id uuid;
  v_new_class_id uuid;
  v_staff_id uuid;
  v_assignment_is_counted boolean := false;
  v_exclude_schedule_id uuid;
  v_exclude_staff_id uuid;
  v_exclude_session_staff_id uuid;
  v_existing_count integer;
  v_teacher_already_assigned boolean;
begin
  if tg_table_name = 'class_schedule_staff' then
    if tg_op <> 'INSERT' then
      select cs.class_id into v_old_class_id
      from public.class_schedules cs
      where cs.id = old.schedule_id;
    end if;

    if tg_op <> 'DELETE' then
      select cs.class_id, cs.status <> 'ARCHIVED'
      into v_new_class_id, v_assignment_is_counted
      from public.class_schedules cs
      where cs.id = new.schedule_id;
      v_staff_id := new.staff_id;
    end if;
  elsif tg_table_name = 'session_staff' then
    if tg_op <> 'INSERT' then
      select s.class_id into v_old_class_id
      from public.sessions s
      where s.id = old.session_id;
    end if;

    if tg_op <> 'DELETE' then
      select s.class_id, s.status in ('SCHEDULED', 'IN_PROGRESS')
      into v_new_class_id, v_assignment_is_counted
      from public.sessions s
      where s.id = new.session_id;
      v_staff_id := new.staff_id;
      v_assignment_is_counted := v_assignment_is_counted and new.assignment_role = 'TEACHER';
    end if;
  else
    raise exception 'UNSUPPORTED_TEACHER_ASSIGNMENT_TABLE';
  end if;

  -- Lock the class row so concurrent schedule/session assignments for one class
  -- serialize before checking the distinct-teacher count.
  perform c.id
  from public.classes c
  where c.id = v_old_class_id or c.id = v_new_class_id
  order by c.id
  for update;

  if tg_op = 'DELETE' or not coalesce(v_assignment_is_counted, false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'class_schedule_staff' and v_old_class_id = v_new_class_id then
      v_exclude_schedule_id := old.schedule_id;
      v_exclude_staff_id := old.staff_id;
    elsif tg_table_name = 'session_staff' and v_old_class_id = v_new_class_id then
      v_exclude_session_staff_id := old.id;
    end if;
  end if;

  select count(*)::integer,
         coalesce(bool_or(assignments.staff_id = v_staff_id), false)
  into v_existing_count, v_teacher_already_assigned
  from public.class_teacher_assignments(
    v_new_class_id,
    v_exclude_schedule_id,
    v_exclude_staff_id,
    v_exclude_session_staff_id
  ) as assignments;

  if not v_teacher_already_assigned and v_existing_count >= 5 then
    raise exception using
      message = 'CLASS_TEACHER_LIMIT',
      detail = 'A class can have at most five currently assigned teachers.';
  end if;

  return new;
end;
$$;

create trigger class_schedule_staff_teacher_limit
before insert or update or delete on public.class_schedule_staff
for each row execute function public.enforce_class_teacher_assignment_limit();

create trigger session_staff_teacher_limit
before insert or update or delete on public.session_staff
for each row execute function public.enforce_class_teacher_assignment_limit();

create or replace function public.enforce_class_teacher_limit_on_schedule_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before_count integer;
  v_after_count integer;
begin
  if old.status <> 'ARCHIVED' or new.status = 'ARCHIVED' then return new; end if;

  perform c.id from public.classes c where c.id = new.class_id for update;
  select count(*)::integer into v_before_count
  from public.class_teacher_assignments(new.class_id) assignments;

  select count(distinct assignments.staff_id)::integer into v_after_count
  from (
    select staff_id from public.class_teacher_assignments(new.class_id)
    union
    select css.staff_id from public.class_schedule_staff css where css.schedule_id = new.id
  ) assignments;

  if v_after_count > 5 and v_after_count > v_before_count then
    raise exception using
      message = 'CLASS_TEACHER_LIMIT',
      detail = 'Reactivating this schedule would add more than five distinct teachers to the class.';
  end if;

  return new;
end;
$$;

create trigger class_schedules_teacher_limit
before update of status on public.class_schedules
for each row execute function public.enforce_class_teacher_limit_on_schedule_status();

create or replace function public.enforce_class_teacher_limit_on_session_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before_count integer;
  v_after_count integer;
begin
  if old.status in ('SCHEDULED', 'IN_PROGRESS') or new.status not in ('SCHEDULED', 'IN_PROGRESS') then return new; end if;

  perform c.id from public.classes c where c.id = new.class_id for update;
  select count(*)::integer into v_before_count
  from public.class_teacher_assignments(new.class_id) assignments;

  select count(distinct assignments.staff_id)::integer into v_after_count
  from (
    select staff_id from public.class_teacher_assignments(new.class_id)
    union
    select ss.staff_id from public.session_staff ss
    where ss.session_id = new.id and ss.assignment_role = 'TEACHER'
  ) assignments;

  if v_after_count > 5 and v_after_count > v_before_count then
    raise exception using
      message = 'CLASS_TEACHER_LIMIT',
      detail = 'Reactivating this session would add more than five distinct teachers to the class.';
  end if;

  return new;
end;
$$;

create trigger sessions_teacher_limit
before update of status on public.sessions
for each row execute function public.enforce_class_teacher_limit_on_session_status();

revoke all on function public.class_teacher_assignments(uuid, uuid, uuid, uuid) from public, anon, authenticated;
