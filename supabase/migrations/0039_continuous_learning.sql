-- Replace month-scoped class operation with persistent class schedules and dated sessions.
-- Historical ClassMonth and financial tables remain in place, but the app can no longer access them.

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  room text,
  status public.entity_status not null default 'INACTIVE',
  legacy_class_month_id uuid references public.class_months(id) on delete set null,
  legacy_schedule_id uuid references public.class_month_schedules(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (class_id, day_of_week, start_time)
);

create table public.class_schedule_staff (
  schedule_id uuid not null references public.class_schedules(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (schedule_id, staff_id)
);

create trigger class_schedules_set_updated_at before update on public.class_schedules
for each row execute function public.set_updated_at();

alter table public.sessions add column class_id uuid references public.classes(id) on delete restrict;
alter table public.sessions add column recurrence_schedule_id uuid references public.class_schedules(id) on delete set null;
alter table public.sessions add column recurrence_occurrence_date date;
alter table public.sessions add column schedule_override boolean not null default false;
alter table public.sessions alter column revenue_snapshot drop not null;
alter table public.sessions alter column revenue_snapshot drop default;
alter table public.session_students alter column monthly_fee_snapshot drop not null;
alter table public.session_students alter column monthly_fee_snapshot drop default;
alter table public.session_students alter column session_unit_value drop not null;
alter table public.session_students alter column session_unit_value drop default;
alter table public.classes alter column default_monthly_fee drop not null;
alter table public.classes alter column default_monthly_fee drop default;
alter table public.classes alter column default_session_fee drop not null;
alter table public.classes alter column default_session_fee drop default;
update public.sessions s
set class_id = cm.class_id
from public.class_months cm
where s.class_month_id = cm.id;

alter table public.sessions alter column class_id set not null;
alter table public.sessions alter column class_month_id drop not null;
create index sessions_class_start_idx on public.sessions(class_id, scheduled_start_at desc);
create index sessions_recurrence_date_idx on public.sessions(recurrence_schedule_id, recurrence_occurrence_date);
create unique index sessions_recurrence_occurrence_uidx
  on public.sessions(recurrence_schedule_id, recurrence_occurrence_date)
  where recurrence_schedule_id is not null and recurrence_occurrence_date is not null;

-- Import the latest active month configuration per class, falling back to its latest draft.
-- All imported schedules are inactive until an admin reviews the class roster and confirms them.
with ranked_months as (
  select cm.id, cm.class_id,
         row_number() over (
           partition by cm.class_id
           order by (cm.status = 'ACTIVE') desc, cm.year desc, cm.month desc, cm.created_at desc
         ) as position
  from public.class_months cm
  where cm.status in ('ACTIVE', 'DRAFT')
    and exists (select 1 from public.class_month_schedules cs where cs.class_month_id = cm.id)
), source_schedules as (
  select cm.class_id, cm.id as class_month_id, cs.id as legacy_schedule_id,
         cs.day_of_week, cs.start_time, cs.end_time, cs.room
  from ranked_months rm
  join public.class_months cm on cm.id = rm.id
  join public.class_month_schedules cs on cs.class_month_id = cm.id
  where rm.position = 1
)
insert into public.class_schedules(
  class_id, day_of_week, start_time, end_time, room, status,
  legacy_class_month_id, legacy_schedule_id
)
select class_id, day_of_week, start_time, end_time, room, 'INACTIVE', class_month_id, legacy_schedule_id
from source_schedules
on conflict (class_id, day_of_week, start_time) do nothing;

insert into public.class_schedule_staff(schedule_id, staff_id)
select cs.id, cmss.staff_id
from public.class_schedules cs
join public.class_month_schedule_staff cmss on cmss.schedule_id = cs.legacy_schedule_id
on conflict do nothing;

insert into public.class_schedule_staff(schedule_id, staff_id)
select cs.id, cms.staff_id
from public.class_schedules cs
join public.class_month_staff cms on cms.class_month_id = cs.legacy_class_month_id
where not exists (
  select 1 from public.class_month_schedule_staff mapped where mapped.schedule_id = cs.legacy_schedule_id
)
on conflict do nothing;

-- Attach existing future sessions to matching recurring occurrences where possible.
with matches as (
  select s.id as session_id, cs.id as schedule_id,
         (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date as occurrence_date,
         row_number() over (
           partition by s.id
           order by (cs.legacy_schedule_id = s.schedule_id) desc,
             (cs.start_time = (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time) desc,
             abs(extract(epoch from (cs.start_time - (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time))), cs.id
         ) as session_position,
         row_number() over (
           partition by cs.id, (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
           order by (cs.legacy_schedule_id = s.schedule_id) desc,
             (cs.start_time = (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time) desc,
             abs(extract(epoch from (cs.start_time - (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time))),
             s.created_at, s.id
         ) as occurrence_position
  from public.sessions s
  join public.class_schedules cs on cs.class_id = s.class_id
  where s.status = 'SCHEDULED'
    and s.scheduled_start_at > now()
    and extract(isodow from (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh'))::int = cs.day_of_week
)
update public.sessions s
set recurrence_schedule_id = m.schedule_id,
    recurrence_occurrence_date = m.occurrence_date
from matches m
where s.id = m.session_id and m.session_position = 1 and m.occurrence_position = 1
  and not exists (
    select 1 from public.sessions other
    where other.recurrence_schedule_id = m.schedule_id
      and other.recurrence_occurrence_date = m.occurrence_date
      and other.id <> s.id
  );

-- Assistant identities become teacher identities without replacing auth users or learning history.
update public.profiles set role = 'TEACHER' where role = 'ASSISTANT';
update public.staff set staff_type = 'TEACHER' where staff_type = 'ASSISTANT';
update public.session_staff set assignment_role = 'TEACHER' where assignment_role = 'ASSISTANT';
update public.class_month_staff set assignment_role = 'TEACHER' where assignment_role = 'ASSISTANT';
update public.class_month_schedule_staff set assignment_role = 'TEACHER' where assignment_role = 'ASSISTANT';

alter table public.staff drop constraint if exists staff_staff_type_check;
alter table public.staff add constraint staff_staff_type_check check (staff_type = 'TEACHER');
alter table public.session_staff drop constraint if exists session_staff_assignment_role_check;
alter table public.session_staff add constraint session_staff_assignment_role_check check (assignment_role = 'TEACHER');

-- Admin access is fixed by role; permission groups are retained only as inaccessible legacy data.
create or replace function public.actor_has_permission(p_user_id uuid, p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = p_user_id
      and status = 'ACTIVE'
      and role in ('ROOT_ADMIN', 'ADMIN')
  ) and (
    auth.uid() is null
    or auth.uid() = p_user_id
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );
$$;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.actor_has_permission(auth.uid(), 'STUDENTS_VIEW')
    or public.is_student_owner(p_student_id)
    or exists (
      select 1 from public.session_students ss
      join public.sessions s on s.id = ss.session_id
      where ss.student_id = p_student_id and public.is_session_staff(s.id)
    );
$$;

create or replace function public.can_view_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
    or public.is_session_staff(p_session_id)
    or exists (
      select 1 from public.session_students ss
      where ss.session_id = p_session_id and public.is_student_owner(ss.student_id)
    );
$$;

create or replace function public.can_view_session_student(p_session_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
    or public.is_session_staff(p_session_id)
    or public.is_student_owner(p_student_id);
$$;

revoke all on function public.can_view_student(uuid) from public, anon;
revoke all on function public.can_view_session(uuid) from public, anon;
revoke all on function public.can_view_session_student(uuid, uuid) from public, anon;
grant execute on function public.can_view_student(uuid) to authenticated, service_role;
grant execute on function public.can_view_session(uuid) to authenticated, service_role;
grant execute on function public.can_view_session_student(uuid, uuid) to authenticated, service_role;

create or replace function public.start_session(p_session_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status public.session_status;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and auth.uid() is distinct from p_actor_user_id then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.sessions where id = p_session_id for update;
  if v_status is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status <> 'SCHEDULED' then raise exception 'SESSION_NOT_SCHEDULED'; end if;
  if not exists (
    select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
      and s.user_id = p_actor_user_id and s.status = 'ACTIVE'
  ) then raise exception 'SESSION_TEACHER_REQUIRED'; end if;
  update public.sessions set status = 'IN_PROGRESS', started_at = now(), started_by = p_actor_user_id where id = p_session_id;
  perform public.write_audit(p_actor_user_id, 'SESSION_START', 'sessions', p_session_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'IN_PROGRESS'));
  return jsonb_build_object('session_id', p_session_id, 'status', 'IN_PROGRESS');
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.sessions%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and auth.uid() is distinct from p_actor_user_id then raise exception 'FORBIDDEN'; end if;
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'IN_PROGRESS' then raise exception 'SESSION_NOT_IN_PROGRESS'; end if;
  if not exists (
    select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
      and s.user_id = p_actor_user_id and s.status = 'ACTIVE'
  ) then raise exception 'SESSION_TEACHER_REQUIRED'; end if;
  if exists (
    select 1 from public.session_students ss left join public.student_attendances sa
      on sa.session_id = ss.session_id and sa.student_id = ss.student_id
    where ss.session_id = p_session_id and sa.id is null
  ) then raise exception 'SESSION_NOT_COMPLETEABLE'; end if;
  update public.sessions set status = 'COMPLETED', ended_at = now(), ended_by = p_actor_user_id where id = p_session_id;
  perform public.write_audit(p_actor_user_id, 'SESSION_COMPLETE', 'sessions', p_session_id,
    jsonb_build_object('status', v_session.status), jsonb_build_object('status', 'COMPLETED'));
  return jsonb_build_object('session_id', p_session_id, 'status', 'COMPLETED');
end;
$$;

create or replace function public.update_session_learning(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_session_note text,
  p_students jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_item record;
  v_old jsonb;
  v_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and auth.uid() is distinct from p_actor_user_id then raise exception 'FORBIDDEN'; end if;
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'IN_PROGRESS' then raise exception 'SESSION_LOCKED'; end if;
  if not exists (
    select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
      and s.user_id = p_actor_user_id and s.status = 'ACTIVE'
  ) then raise exception 'FORBIDDEN'; end if;

  select jsonb_build_object(
    'session_note', v_session.session_note,
    'attendance', coalesce(jsonb_agg(to_jsonb(a)) filter (where a.id is not null), '[]'::jsonb)
  ) into v_old
  from public.student_attendances a where a.session_id = p_session_id;

  update public.sessions set session_note = nullif(trim(p_session_note), '') where id = p_session_id;
  for v_item in
    select * from jsonb_to_recordset(coalesce(p_students, '[]'::jsonb)) as x(
      student_id uuid, status public.attendance_status, late_minutes integer,
      absence_reason text, homework_score numeric, homework_note text,
      understanding_score smallint, attitude_score smallint,
      positive_feedback_count integer, positive_feedback_raw text, comment text
    )
  loop
    if v_item.status is null then raise exception 'ATTENDANCE_STATUS_REQUIRED'; end if;
    if v_item.homework_score is not null and (v_item.homework_score < 0 or v_item.homework_score > 10) then raise exception 'INVALID_HOMEWORK_SCORE'; end if;
    if v_item.understanding_score is not null and (v_item.understanding_score < 1 or v_item.understanding_score > 5) then raise exception 'INVALID_UNDERSTANDING_SCORE'; end if;
    if v_item.attitude_score is not null and (v_item.attitude_score < 1 or v_item.attitude_score > 5) then raise exception 'INVALID_ATTITUDE_SCORE'; end if;
    if not exists (select 1 from public.session_students where session_id = p_session_id and student_id = v_item.student_id) then raise exception 'STUDENT_NOT_IN_SESSION'; end if;
    insert into public.student_attendances(
      session_id, student_id, status, late_minutes, absence_reason, homework_score,
      homework_note, understanding_score, attitude_score, positive_feedback_count,
      positive_feedback_raw, comment, updated_by
    ) values (
      p_session_id, v_item.student_id, v_item.status, v_item.late_minutes,
      nullif(trim(v_item.absence_reason), ''), v_item.homework_score,
      nullif(trim(v_item.homework_note), ''), v_item.understanding_score,
      v_item.attitude_score, v_item.positive_feedback_count,
      nullif(trim(v_item.positive_feedback_raw), ''), nullif(trim(v_item.comment), ''), p_actor_user_id
    )
    on conflict (session_id, student_id) do update set
      status = excluded.status, late_minutes = excluded.late_minutes,
      absence_reason = excluded.absence_reason, homework_score = excluded.homework_score,
      homework_note = excluded.homework_note, understanding_score = excluded.understanding_score,
      attitude_score = excluded.attitude_score, positive_feedback_count = excluded.positive_feedback_count,
      positive_feedback_raw = excluded.positive_feedback_raw, comment = excluded.comment,
      updated_by = excluded.updated_by;
    v_count := v_count + 1;
  end loop;
  perform public.write_audit(p_actor_user_id, 'SESSION_LEARNING_UPDATE', 'sessions', p_session_id,
    v_old, jsonb_build_object('session_note', p_session_note, 'students', coalesce(p_students, '[]'::jsonb), 'students_updated', v_count));
  return jsonb_build_object('session_id', p_session_id, 'students_updated', v_count);
end;
$$;

create or replace function public.update_my_staff_profile(
  p_full_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_staff public.staff%rowtype;
begin
  select * into v_staff from public.staff where user_id = auth.uid() and status = 'ACTIVE' for update;
  if not found then raise exception 'STAFF_NOT_FOUND'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and role = 'TEACHER' and status = 'ACTIVE') then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'INVALID_INPUT'; end if;
  update public.staff set full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''), email = nullif(trim(p_email), ''), address = nullif(trim(p_address), '') where id = v_staff.id;
  update public.profiles set display_name = trim(p_full_name), phone = nullif(trim(p_phone), ''), email = nullif(trim(p_email), '') where user_id = auth.uid();
  return jsonb_build_object('staff_id', v_staff.id, 'full_name', trim(p_full_name));
end;
$$;

revoke all on function public.update_my_staff_profile(text, text, text, text) from public, anon;
grant execute on function public.update_my_staff_profile(text, text, text, text) to authenticated;

create or replace function public.audit_learning_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if v_actor is null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    v_id := (to_jsonb(new)->>'id')::uuid;
    v_new := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_id := (to_jsonb(old)->>'id')::uuid;
    v_old := to_jsonb(old);
  else
    v_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;
  perform public.write_audit(v_actor, tg_op || '_' || upper(tg_table_name), tg_table_name, v_id, v_old, v_new, null);
  return null;
end;
$$;

revoke all on function public.audit_learning_change() from public, anon, authenticated;
create trigger students_learning_audit after update on public.students
for each row execute function public.audit_learning_change();
create trigger staff_learning_audit after update on public.staff
for each row execute function public.audit_learning_change();
create trigger memberships_learning_audit after insert or update or delete on public.class_memberships
for each row execute function public.audit_learning_change();
create trigger schedules_learning_audit after insert or update or delete on public.class_schedules
for each row execute function public.audit_learning_change();
create trigger schedule_staff_learning_audit after insert or update or delete on public.class_schedule_staff
for each row execute function public.audit_learning_change();

create or replace function public.admin_update_session_occurrence(
  p_session_id uuid,
  p_scheduled_start_at timestamptz default null,
  p_scheduled_end_at timestamptz default null,
  p_cancel boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.sessions%rowtype;
begin
  if not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'SCHEDULED' or v_session.scheduled_start_at <= now() then raise exception 'SESSION_LOCKED'; end if;
  if p_cancel then
    update public.sessions set status = 'CANCELLED', schedule_override = true where id = p_session_id;
    perform public.write_audit(auth.uid(), 'SESSION_CANCEL', 'sessions', p_session_id,
      jsonb_build_object('status', v_session.status), jsonb_build_object('status', 'CANCELLED'));
    return jsonb_build_object('session_id', p_session_id, 'status', 'CANCELLED');
  end if;
  if p_scheduled_start_at is null or p_scheduled_end_at is null or p_scheduled_end_at <= p_scheduled_start_at or p_scheduled_start_at <= now() then raise exception 'INVALID_INPUT'; end if;
  if exists (
    select 1 from public.sessions other
    where other.id <> p_session_id and other.status in ('SCHEDULED', 'IN_PROGRESS')
      and other.scheduled_start_at < p_scheduled_end_at and other.scheduled_end_at > p_scheduled_start_at
      and (
        other.class_id = v_session.class_id
        or exists (select 1 from public.session_staff a join public.session_staff b on b.staff_id = a.staff_id where a.session_id = p_session_id and b.session_id = other.id)
        or exists (select 1 from public.session_students a join public.session_students b on b.student_id = a.student_id where a.session_id = p_session_id and b.session_id = other.id)
      )
  ) then raise exception 'SCHEDULE_CONFLICT'; end if;
  update public.sessions set scheduled_start_at = p_scheduled_start_at, scheduled_end_at = p_scheduled_end_at, schedule_override = true where id = p_session_id;
  perform public.write_audit(auth.uid(), 'SESSION_RESCHEDULE', 'sessions', p_session_id,
    jsonb_build_object('scheduled_start_at', v_session.scheduled_start_at, 'scheduled_end_at', v_session.scheduled_end_at),
    jsonb_build_object('scheduled_start_at', p_scheduled_start_at, 'scheduled_end_at', p_scheduled_end_at));
  return jsonb_build_object('session_id', p_session_id, 'status', 'SCHEDULED');
end;
$$;

revoke all on function public.admin_update_session_occurrence(uuid, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_update_session_occurrence(uuid, timestamptz, timestamptz, boolean) to authenticated;

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
  v_students uuid[];
  v_teachers uuid[];
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
      select s.id, s.status, s.schedule_override into v_session_id, v_status, v_schedule_override
      from public.sessions s
      where s.recurrence_schedule_id = v_schedule.id and s.recurrence_occurrence_date = v_day
      for update;
      if v_session_id is null then
        select s.id, s.status, s.schedule_override into v_session_id, v_status, v_schedule_override
        from public.sessions s
        where s.class_id = v_schedule.class_id and s.scheduled_start_at = v_start
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

      delete from public.session_staff where session_id = v_session_id;
      delete from public.session_students where session_id = v_session_id
        and not exists (select 1 from public.student_attendances sa where sa.session_id = v_session_id);
      insert into public.session_students(session_id, student_id)
      select v_session_id, student.student_id from unnest(v_students) as student(student_id)
      where not exists (select 1 from public.session_students ss where ss.session_id = v_session_id and ss.student_id = student.student_id);
      insert into public.session_staff(session_id, staff_id, assignment_role)
      select v_session_id, staff_id, 'TEACHER' from unnest(v_teachers) as staff_id
      on conflict (session_id, staff_id) do update set assignment_role = 'TEACHER';
    end loop;
  end loop;

  update public.sessions s
  set status = 'CANCELLED'
  where s.status = 'SCHEDULED' and not s.schedule_override
    and s.scheduled_start_at > now()
    and (s.recurrence_occurrence_date is null or s.recurrence_occurrence_date between v_today and v_today + (p_days - 1))
    and (
      not exists (select 1 from public.classes c where c.id = s.class_id and c.status = 'ACTIVE')
      or
      (s.recurrence_schedule_id is null and exists (
        select 1 from public.class_schedules cs join public.classes c on c.id = cs.class_id
        where cs.class_id = s.class_id and cs.status = 'ACTIVE' and cs.reviewed_at is not null and c.status = 'ACTIVE'
      ))
      or (s.recurrence_schedule_id is not null and not exists (
        select 1 from public.class_schedules cs join public.classes c on c.id = cs.class_id
        where cs.id = s.recurrence_schedule_id and cs.status = 'ACTIVE' and cs.reviewed_at is not null and c.status = 'ACTIVE'
          and extract(isodow from s.recurrence_occurrence_date)::int = cs.day_of_week
      ))
    );
  get diagnostics v_row_count = row_count;
  v_cancelled := v_cancelled + v_row_count;
  return jsonb_build_object('created', v_created, 'refreshed', v_refreshed, 'cancelled', v_cancelled, 'through', v_today + (p_days - 1));
end;
$$;

revoke all on function public.generate_upcoming_sessions(integer) from public, anon;
grant execute on function public.generate_upcoming_sessions(integer) to authenticated, service_role;

-- Restrict future occurrence edits to admins; schedule templates remain class-scoped.
drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
create policy students_select on public.students for select using (public.can_view_student(id));
create policy students_insert on public.students for insert with check (public.actor_has_permission(auth.uid(), 'STUDENTS_MANAGE'));
create policy students_update on public.students for update using (public.actor_has_permission(auth.uid(), 'STUDENTS_MANAGE')) with check (public.actor_has_permission(auth.uid(), 'STUDENTS_MANAGE'));

drop policy if exists staff_select on public.staff;
drop policy if exists staff_insert on public.staff;
drop policy if exists staff_update on public.staff;
create policy staff_select on public.staff for select using (
  public.actor_has_permission(auth.uid(), 'STAFF_VIEW') or user_id = auth.uid()
  or exists (
    select 1 from public.session_staff ss
    join public.session_students own on own.session_id = ss.session_id
    where ss.staff_id = staff.id and public.is_student_owner(own.student_id)
  )
);
create policy staff_insert on public.staff for insert with check (public.actor_has_permission(auth.uid(), 'STAFF_MANAGE'));
create policy staff_update on public.staff for update using (public.actor_has_permission(auth.uid(), 'STAFF_MANAGE')) with check (public.actor_has_permission(auth.uid(), 'STAFF_MANAGE'));

drop policy if exists classes_select on public.classes;
drop policy if exists classes_manage on public.classes;
create policy classes_select on public.classes for select using (
  public.actor_has_permission(auth.uid(), 'CLASS_VIEW')
  or exists (select 1 from public.class_memberships cm where cm.class_id = classes.id and public.is_student_owner(cm.student_id))
  or exists (select 1 from public.class_schedules cs join public.class_schedule_staff css on css.schedule_id = cs.id join public.staff st on st.id = css.staff_id where cs.class_id = classes.id and st.user_id = auth.uid())
  or exists (select 1 from public.sessions s where s.class_id = classes.id and public.is_session_staff(s.id))
);
create policy classes_manage on public.classes for all using (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE')) with check (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE'));

drop policy if exists memberships_select on public.class_memberships;
drop policy if exists memberships_manage on public.class_memberships;
create policy memberships_select on public.class_memberships for select using (
  public.actor_has_permission(auth.uid(), 'STUDENTS_VIEW') or public.is_student_owner(student_id)
  or exists (select 1 from public.sessions s join public.session_staff ss on ss.session_id = s.id join public.staff st on st.id = ss.staff_id where s.class_id = class_memberships.class_id and st.user_id = auth.uid())
);
create policy memberships_manage on public.class_memberships for all using (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE')) with check (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE'));

alter table public.class_schedules enable row level security;
alter table public.class_schedule_staff enable row level security;
grant select, insert, update, delete on public.class_schedules, public.class_schedule_staff to authenticated;
grant all on public.class_schedules, public.class_schedule_staff to service_role;
revoke all on public.class_schedules from authenticated;
grant select (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at, reviewed_by, created_by, created_at, updated_at)
  on public.class_schedules to authenticated;
grant insert (class_id, day_of_week, start_time, end_time, room, status, created_by)
  on public.class_schedules to authenticated;
grant update (day_of_week, start_time, end_time, room, status, reviewed_at, reviewed_by)
  on public.class_schedules to authenticated;
create policy class_schedules_select on public.class_schedules for select using (
  public.actor_has_permission(auth.uid(), 'CLASS_VIEW')
  or exists (select 1 from public.class_schedule_staff css join public.staff st on st.id = css.staff_id where css.schedule_id = class_schedules.id and st.user_id = auth.uid())
  or exists (select 1 from public.class_memberships cm where cm.class_id = class_schedules.class_id and public.is_student_owner(cm.student_id))
);
create policy class_schedules_manage on public.class_schedules for all using (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE')) with check (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE'));
create policy class_schedule_staff_select on public.class_schedule_staff for select using (
  public.actor_has_permission(auth.uid(), 'CLASS_VIEW')
  or exists (select 1 from public.staff st where st.id = staff_id and st.user_id = auth.uid())
);
create policy class_schedule_staff_manage on public.class_schedule_staff for all using (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE')) with check (public.actor_has_permission(auth.uid(), 'CLASS_MANAGE'));

drop policy if exists sessions_select on public.sessions;
drop policy if exists sessions_update_staff on public.sessions;
create policy sessions_select on public.sessions for select using (
  public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
  or public.is_session_staff(id)
  or exists (select 1 from public.session_students ss where ss.session_id = sessions.id and public.is_student_owner(ss.student_id))
);

 drop policy if exists session_students_select on public.session_students;
create policy session_students_select on public.session_students for select using (
  public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW') or public.is_session_staff(session_id) or public.is_student_owner(student_id)
);
drop policy if exists session_staff_select on public.session_staff;
create policy session_staff_select on public.session_staff for select using (
  public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
  or exists (select 1 from public.staff st where st.id = staff_id and st.user_id = auth.uid())
  or exists (select 1 from public.session_students ss where ss.session_id = session_staff.session_id and public.is_student_owner(ss.student_id))
);
drop policy if exists attendances_select on public.student_attendances;
drop policy if exists attendances_insert on public.student_attendances;
drop policy if exists attendances_update on public.student_attendances;
create policy attendances_select on public.student_attendances for select using (
  public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW') or public.is_session_staff(session_id) or public.is_student_owner(student_id)
);

-- Archived features and month snapshots are inaccessible to app users; service_role retains backup access.
revoke all on public.class_months, public.class_month_students, public.class_month_staff,
  public.class_month_schedules, public.class_month_schedule_staff, public.parent_students,
  public.timesheets, public.tuition_records, public.payroll_periods, public.payroll_items,
  public.salary_adjustments, public.accounting_categories, public.accounting_transactions,
  public.notifications, public.permission_groups, public.permissions,
  public.permission_group_permissions, public.admin_permission_groups from authenticated;
revoke all on public.audit_logs, public.staff_replacements from authenticated;

-- Financial snapshot columns remain available to service_role for preservation, but are hidden from the app.
revoke all on public.classes from authenticated;
grant select (id, code, name, subject_id, grade_id, max_students, capacity_policy, status, notes, created_by, created_at, updated_at)
  on public.classes to authenticated;
grant insert (code, name, subject_id, grade_id, max_students, capacity_policy, status, notes, created_by)
  on public.classes to authenticated;
grant update (code, name, subject_id, grade_id, max_students, capacity_policy, status, notes)
  on public.classes to authenticated;
revoke delete on public.classes from authenticated;

revoke all on public.sessions from authenticated;
grant select (id, class_id, recurrence_schedule_id, recurrence_occurrence_date,
  schedule_override, scheduled_start_at, scheduled_end_at, status, started_at, started_by, ended_at, ended_by,
  lesson_content, session_note, created_at, updated_at)
  on public.sessions to authenticated;
revoke insert, update, delete on public.sessions from authenticated;

revoke all on public.session_students from authenticated;
grant select (id, session_id, student_id, assessment_snapshot, created_at) on public.session_students to authenticated;
revoke insert, update, delete on public.session_students from authenticated;
revoke all on public.session_staff from authenticated;
grant select (id, session_id, staff_id, assignment_role, created_at) on public.session_staff to authenticated;
revoke insert, update, delete on public.session_staff from authenticated;

drop policy if exists attendances_select on public.student_attendances;
create policy attendances_select on public.student_attendances for select using (
  public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
  or public.is_session_staff(session_id)
  or (public.is_student_owner(student_id) and exists (
    select 1 from public.sessions s where s.id = student_attendances.session_id and s.status = 'COMPLETED'
  ))
);

revoke all on function public.actor_has_permission(uuid, text) from public, anon;
grant execute on function public.actor_has_permission(uuid, text) to authenticated, service_role;
revoke all on function public.start_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_session_learning(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.start_session(uuid, uuid) to service_role;
grant execute on function public.complete_session(uuid, uuid) to service_role;
grant execute on function public.update_session_learning(uuid, uuid, text, jsonb) to service_role;
revoke all on function public.set_account_status(uuid, public.account_status, uuid) from public, anon, authenticated;
grant execute on function public.set_account_status(uuid, public.account_status, uuid) to service_role;
revoke all on function public.write_audit(uuid, text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, text, text, uuid, jsonb, jsonb, text) to service_role;

revoke execute on function public.activate_class_month(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.activate_class_month_unchecked(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.copy_class_month(uuid, smallint, smallint, uuid) from public, anon, authenticated;
revoke execute on function public.create_payroll_period(smallint, smallint, uuid) from public, anon, authenticated;
revoke execute on function public.calculate_payroll(uuid, uuid, public.salary_method, numeric, bigint) from public, anon, authenticated;
revoke execute on function public.confirm_payroll(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.pay_payroll(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.add_salary_adjustment(uuid, uuid, public.adjustment_type, bigint, text, uuid) from public, anon, authenticated;
revoke execute on function public.approve_timesheet(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.submit_timesheet(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.confirm_tuition_paid(uuid, uuid, public.payment_method) from public, anon, authenticated;
revoke execute on function public.create_manual_transaction(public.transaction_direction, uuid, bigint, date, public.payment_method, text, uuid) from public, anon, authenticated;
revoke execute on function public.set_admin_permission_groups(uuid, uuid[], uuid) from public, anon, authenticated;
revoke execute on function public.reopen_session(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.replace_session_staff(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;

-- The job invokes the same idempotent function admins can run after schedule edits.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'generate-continuous-class-sessions';
select cron.schedule(
  'generate-continuous-class-sessions',
  '0 17 * * *',
  'select public.generate_upcoming_sessions(30);'
);
