update public.sessions
set session_note = lesson_content
where session_note is null
  and nullif(trim(lesson_content), '') is not null;

create or replace function public.sync_session_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.session_note is null then
      new.session_note := new.lesson_content;
    else
      new.lesson_content := new.session_note;
    end if;
  elsif new.session_note is null and new.lesson_content is not null then
    new.session_note := new.lesson_content;
  elsif new.session_note is distinct from old.session_note then
    new.lesson_content := new.session_note;
  elsif new.lesson_content is distinct from old.lesson_content then
    new.session_note := new.lesson_content;
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_sync_content on public.sessions;
create trigger sessions_sync_content
before insert or update on public.sessions
for each row execute function public.sync_session_content();

create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  status public.entity_status not null default 'ACTIVE',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_user_id, student_id)
);

create index if not exists parent_students_parent_idx on public.parent_students(parent_user_id);
create index if not exists parent_students_student_idx on public.parent_students(student_id);
create trigger parent_students_set_updated_at before update on public.parent_students
for each row execute function public.set_updated_at();

alter table public.parent_students enable row level security;
revoke all on public.parent_students from anon;
grant select, insert, update, delete on public.parent_students to authenticated;
grant all on public.parent_students to service_role;

create or replace function public.is_parent_owner(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_students ps
    join public.profiles p on p.user_id = ps.parent_user_id
    where ps.parent_user_id = auth.uid()
      and ps.student_id = p_student_id
      and ps.status = 'ACTIVE'
      and p.role = 'PARENT'
      and p.status = 'ACTIVE'
  );
$$;

revoke all on function public.is_parent_owner(uuid) from public, anon;
grant execute on function public.is_parent_owner(uuid) to authenticated, service_role;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('STUDENTS_VIEW')
    or public.is_student_owner(p_student_id)
    or public.is_parent_owner(p_student_id)
    or exists (
      select 1
      from public.session_students ss
      join public.sessions s on s.id = ss.session_id
      where ss.student_id = p_student_id
        and public.is_session_staff(s.id)
    );
$$;

create or replace function public.can_view_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('ACADEMIC_VIEW')
    or public.is_session_staff(p_session_id)
    or exists (
      select 1
      from public.session_students ss
      where ss.session_id = p_session_id
        and public.can_view_student(ss.student_id)
    );
$$;

create or replace function public.can_view_session_student(p_session_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('ACADEMIC_VIEW')
    or public.is_session_staff(p_session_id)
    or public.can_view_student(p_student_id);
$$;

revoke all on function public.can_view_session(uuid) from public, anon;
revoke all on function public.can_view_session_student(uuid, uuid) from public, anon;
grant execute on function public.can_view_session(uuid) to authenticated, service_role;
grant execute on function public.can_view_session_student(uuid, uuid) to authenticated, service_role;

drop policy if exists parent_students_select on public.parent_students;
create policy parent_students_select on public.parent_students
for select using (
  parent_user_id = auth.uid()
  or public.is_root()
  or public.has_permission('STUDENTS_VIEW')
);

drop policy if exists parent_students_manage on public.parent_students;
create policy parent_students_manage on public.parent_students
for all using (
  public.is_root() or public.has_permission('STUDENTS_MANAGE')
) with check (
  public.is_root() or public.has_permission('STUDENTS_MANAGE')
);

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select using (
  public.is_root() or public.has_permission('CLASS_VIEW')
  or exists (
    select 1
    from public.class_months cm
    join public.class_month_staff cms on cms.class_month_id = cm.id
    join public.staff s on s.id = cms.staff_id
    where cm.class_id = classes.id and s.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.class_months cm
    join public.class_month_students cms on cms.class_month_id = cm.id
    where cm.class_id = classes.id and public.can_view_student(cms.student_id)
  )
);

drop policy if exists class_months_select on public.class_months;
create policy class_months_select on public.class_months for select using (
  public.is_root() or public.has_permission('CLASS_VIEW')
  or exists (
    select 1 from public.class_month_students cms
    where cms.class_month_id = class_months.id and public.can_view_student(cms.student_id)
  )
  or exists (
    select 1 from public.class_month_staff cms
    join public.staff s on s.id = cms.staff_id
    where cms.class_month_id = class_months.id and s.user_id = auth.uid()
  )
);

drop policy if exists class_month_students_select on public.class_month_students;
create policy class_month_students_select on public.class_month_students for select using (
  public.is_root() or public.has_permission('CLASS_VIEW')
  or public.can_view_student(student_id)
  or exists (
    select 1 from public.class_month_staff cms
    join public.staff s on s.id = cms.staff_id
    where cms.class_month_id = class_month_students.class_month_id and s.user_id = auth.uid()
  )
);

drop policy if exists class_month_schedules_select on public.class_month_schedules;
create policy class_month_schedules_select on public.class_month_schedules for select using (
  public.is_root() or public.has_permission('CLASS_VIEW')
  or exists (
    select 1
    from public.class_month_students cms
    where cms.class_month_id = class_month_schedules.class_month_id
      and public.can_view_student(cms.student_id)
  )
  or exists (
    select 1
    from public.class_month_staff cms
    join public.staff s on s.id = cms.staff_id
    where cms.class_month_id = class_month_schedules.class_month_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists tuition_select on public.tuition_records;
create policy tuition_select on public.tuition_records for select using (public.is_root());
drop policy if exists payroll_periods_select on public.payroll_periods;
create policy payroll_periods_select on public.payroll_periods for select using (public.is_root());
drop policy if exists payroll_items_select on public.payroll_items;
create policy payroll_items_select on public.payroll_items for select using (public.is_root());
drop policy if exists adjustments_select on public.salary_adjustments;
create policy adjustments_select on public.salary_adjustments for select using (public.is_root());
drop policy if exists categories_select on public.accounting_categories;
create policy categories_select on public.accounting_categories for select using (public.is_root());
drop policy if exists transactions_select on public.accounting_transactions;
create policy transactions_select on public.accounting_transactions for select using (public.is_root());

create or replace function public.copy_class_month(
  p_source_class_month_id uuid,
  p_year smallint,
  p_month smallint,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.class_months%rowtype;
  v_target_id uuid;
  v_start date;
  v_schedule record;
begin
  if not public.actor_has_permission(p_actor_user_id, 'CLASS_MONTH_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_year not between 2000 and 2200 or p_month not between 1 and 12 then
    raise exception 'INVALID_CLASS_MONTH';
  end if;
  select * into v_source from public.class_months
  where id = p_source_class_month_id;
  if not found then raise exception 'CLASS_MONTH_NOT_FOUND'; end if;
  if exists (
    select 1 from public.class_months
    where class_id = v_source.class_id and year = p_year and month = p_month
  ) then raise exception 'CLASS_MONTH_ALREADY_EXISTS'; end if;

  v_start := make_date(p_year, p_month, 1);
  insert into public.class_months(class_id, year, month, status, copied_from_id, notes, created_by)
  values (v_source.class_id, p_year, p_month, 'DRAFT', p_source_class_month_id, v_source.notes, p_actor_user_id)
  returning id into v_target_id;

  insert into public.class_month_students(
    class_month_id, student_id, membership_start_date, membership_end_date,
    monthly_fee_snapshot, session_fee_snapshot
  )
  select v_target_id, student_id, v_start, null, monthly_fee_snapshot, session_fee_snapshot
  from public.class_month_students where class_month_id = p_source_class_month_id;

  insert into public.class_month_staff(class_month_id, staff_id, assignment_role)
  select v_target_id, staff_id, assignment_role
  from public.class_month_staff where class_month_id = p_source_class_month_id;

  for v_schedule in
    select id, day_of_week, start_time, end_time, room, status
    from public.class_month_schedules where class_month_id = p_source_class_month_id
  loop
    insert into public.class_month_schedules(
      class_month_id, day_of_week, start_time, end_time, room, status
    )
    values (
      v_target_id, v_schedule.day_of_week, v_schedule.start_time,
      v_schedule.end_time, v_schedule.room, v_schedule.status
    );
  end loop;

  insert into public.class_month_schedule_staff(schedule_id, staff_id, assignment_role)
  select target_schedule.id, mapping.staff_id, mapping.assignment_role
  from public.class_month_schedule_staff mapping
  join public.class_month_schedules source_schedule
    on source_schedule.id = mapping.schedule_id
  join public.class_month_schedules target_schedule
    on target_schedule.class_month_id = v_target_id
   and target_schedule.day_of_week = source_schedule.day_of_week
   and target_schedule.start_time = source_schedule.start_time
   and target_schedule.end_time = source_schedule.end_time
   and coalesce(target_schedule.room, '') = coalesce(source_schedule.room, '')
  where source_schedule.class_month_id = p_source_class_month_id;

  perform public.write_audit(
    p_actor_user_id, 'CLASS_MONTH_COPY', 'class_months', v_target_id, null,
    jsonb_build_object('copied_from_id', p_source_class_month_id, 'status', 'DRAFT')
  );
  return jsonb_build_object('class_month_id', v_target_id, 'status', 'DRAFT');
end;
$$;

grant execute on function public.copy_class_month(uuid, smallint, smallint, uuid)
  to authenticated, service_role;

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
  v_is_admin boolean := public.actor_has_permission(p_actor_user_id, 'ACADEMIC_MANAGE');
  v_old jsonb;
  v_count integer := 0;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if not v_is_admin and not exists (
    select 1 from public.session_staff ss
    join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and s.user_id = p_actor_user_id and s.status = 'ACTIVE'
  ) then raise exception 'FORBIDDEN'; end if;
  if not v_is_admin and v_session.status <> 'IN_PROGRESS' then
    raise exception 'SESSION_LOCKED';
  end if;
  if v_session.status = 'CANCELLED' then raise exception 'SESSION_LOCKED'; end if;

  select jsonb_build_object(
    'session_note', v_session.session_note,
    'attendance', coalesce(jsonb_agg(to_jsonb(a)) filter (where a.id is not null), '[]'::jsonb)
  ) into v_old
  from public.student_attendances a where a.session_id = p_session_id;

  update public.sessions set session_note = nullif(trim(p_session_note), '') where id = p_session_id;

  for v_item in
    select * from jsonb_to_recordset(coalesce(p_students, '[]'::jsonb)) as x(
      student_id uuid,
      status public.attendance_status,
      late_minutes integer,
      absence_reason text,
      homework_score numeric,
      homework_note text,
      understanding_score smallint,
      attitude_score smallint,
      positive_feedback_count integer,
      positive_feedback_raw text,
      comment text
    )
  loop
    if v_item.status is null then raise exception 'ATTENDANCE_STATUS_REQUIRED'; end if;
    if v_item.homework_score is not null and (v_item.homework_score < 0 or v_item.homework_score > 10) then
      raise exception 'INVALID_HOMEWORK_SCORE';
    end if;
    if v_item.understanding_score is not null and (v_item.understanding_score < 1 or v_item.understanding_score > 5) then
      raise exception 'INVALID_UNDERSTANDING_SCORE';
    end if;
    if v_item.attitude_score is not null and (v_item.attitude_score < 1 or v_item.attitude_score > 5) then
      raise exception 'INVALID_ATTITUDE_SCORE';
    end if;
    if not exists (
      select 1 from public.session_students
      where session_id = p_session_id and student_id = v_item.student_id
    ) then raise exception 'STUDENT_NOT_IN_SESSION'; end if;
    insert into public.student_attendances(
      session_id, student_id, status, late_minutes, absence_reason,
      homework_score, homework_note, understanding_score, attitude_score,
      positive_feedback_count, positive_feedback_raw, comment, updated_by
    ) values (
      p_session_id, v_item.student_id, v_item.status, v_item.late_minutes,
      nullif(trim(v_item.absence_reason), ''), v_item.homework_score,
      nullif(trim(v_item.homework_note), ''), v_item.understanding_score,
      v_item.attitude_score, v_item.positive_feedback_count,
      nullif(trim(v_item.positive_feedback_raw), ''),
      nullif(trim(v_item.comment), ''), p_actor_user_id
    )
    on conflict (session_id, student_id) do update set
      status = excluded.status,
      late_minutes = excluded.late_minutes,
      absence_reason = excluded.absence_reason,
      homework_score = excluded.homework_score,
      homework_note = excluded.homework_note,
      understanding_score = excluded.understanding_score,
      attitude_score = excluded.attitude_score,
      positive_feedback_count = excluded.positive_feedback_count,
      positive_feedback_raw = excluded.positive_feedback_raw,
      comment = excluded.comment,
      updated_by = excluded.updated_by;
    v_count := v_count + 1;
  end loop;

  perform public.write_audit(
    p_actor_user_id, 'SESSION_LEARNING_UPDATE', 'sessions', p_session_id,
    v_old, jsonb_build_object(
      'session_note', p_session_note,
      'students', coalesce(p_students, '[]'::jsonb),
      'students_updated', v_count
    )
  );
  return jsonb_build_object('session_id', p_session_id, 'students_updated', v_count);
end;
$$;

grant execute on function public.update_session_learning(uuid, uuid, text, jsonb)
  to authenticated, service_role;

create or replace function public.activate_class_month_unchecked(
  p_class_month_id uuid,
  p_actor_user_id uuid,
  p_override_conflicts boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month public.class_months%rowtype;
  v_start date;
  v_end date;
  v_total integer;
  v_sessions integer := 0;
  v_date date;
  v_schedule record;
  v_session_id uuid;
begin
  if not public.actor_has_permission(p_actor_user_id, 'CLASS_MONTH_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select * into v_month from public.class_months where id = p_class_month_id for update;
  if not found then raise exception 'CLASS_MONTH_NOT_FOUND'; end if;
  if v_month.status <> 'DRAFT' then raise exception 'CLASS_MONTH_NOT_DRAFT'; end if;
  v_start := make_date(v_month.year, v_month.month, 1);
  v_end := (v_start + interval '1 month - 1 day')::date;

  select count(*) into v_total
  from generate_series(v_start, v_end, interval '1 day') d(day)
  join public.class_month_schedules cs
    on cs.class_month_id = p_class_month_id and cs.status = 'ACTIVE'
   and extract(isodow from d.day)::int = cs.day_of_week;
  if v_total = 0 then raise exception 'CLASS_MONTH_NO_SCHEDULE'; end if;
  if not exists (select 1 from public.class_month_students where class_month_id = p_class_month_id) then
    raise exception 'CLASS_MONTH_NO_STUDENTS';
  end if;

  for v_schedule in select * from public.class_month_schedules
    where class_month_id = p_class_month_id and status = 'ACTIVE'
  loop
    for v_date in select d::date from generate_series(v_start, v_end, interval '1 day') d
      where extract(isodow from d)::int = v_schedule.day_of_week
    loop
      if not exists (
        select 1 from public.sessions where class_month_id = p_class_month_id
          and scheduled_start_at = ((v_date + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh')
      ) then
        insert into public.sessions(class_month_id, schedule_id, scheduled_start_at, scheduled_end_at)
        values (
          p_class_month_id, v_schedule.id,
          (v_date + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh',
          (v_date + v_schedule.end_time) at time zone 'Asia/Ho_Chi_Minh'
        ) returning id into v_session_id;
        v_sessions := v_sessions + 1;
        insert into public.session_students(session_id, student_id, monthly_fee_snapshot, session_unit_value)
        select v_session_id, cms.student_id, cms.monthly_fee_snapshot,
          case when cms.session_fee_snapshot > 0 then cms.session_fee_snapshot
               else round(cms.monthly_fee_snapshot::numeric / v_total)::bigint end
        from public.class_month_students cms where cms.class_month_id = p_class_month_id;
        insert into public.session_staff(session_id, staff_id, assignment_role)
        select v_session_id, mapping.staff_id, mapping.assignment_role
        from public.class_month_schedule_staff mapping where mapping.schedule_id = v_schedule.id
        union all
        select v_session_id, fallback.staff_id, fallback.assignment_role
        from public.class_month_staff fallback
        where fallback.class_month_id = p_class_month_id
          and not exists (select 1 from public.class_month_schedule_staff mapped where mapped.schedule_id = v_schedule.id);
      end if;
    end loop;
  end loop;

  update public.class_months set status = 'ACTIVE', confirmed_at = now(), confirmed_by = p_actor_user_id
  where id = p_class_month_id;
  perform public.write_audit(
    p_actor_user_id, 'CLASS_MONTH_ACTIVATE', 'class_months', p_class_month_id, null,
    jsonb_build_object('status', 'ACTIVE', 'sessions_created', v_sessions, 'tuition_created', 0,
      'override_conflicts', p_override_conflicts)
  );
  return jsonb_build_object('class_month_id', p_class_month_id, 'sessions_created', v_sessions, 'tuition_created', 0);
end;
$$;

grant execute on function public.activate_class_month_unchecked(uuid, uuid, boolean)
  to authenticated, service_role;
