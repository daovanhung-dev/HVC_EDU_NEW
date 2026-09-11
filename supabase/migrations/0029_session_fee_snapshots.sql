alter table public.classes
  add column if not exists default_session_fee bigint not null default 0;

alter table public.class_month_students
  add column if not exists session_fee_snapshot bigint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_default_session_fee_check'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_default_session_fee_check check (default_session_fee >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_month_students_session_fee_snapshot_check'
      and conrelid = 'public.class_month_students'::regclass
  ) then
    alter table public.class_month_students
      add constraint class_month_students_session_fee_snapshot_check check (session_fee_snapshot >= 0);
  end if;
end;
$$;

-- Preserve the existing monthly-fee revenue model when no per-session
-- snapshot was configured, while allowing classes with an explicit fee per
-- lesson to carry that value into future sessions.
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
  v_tuition integer := 0;
  v_date date;
  v_schedule record;
  v_session_id uuid;
begin
  if not public.actor_has_permission(p_actor_user_id, 'CLASS_MONTH_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_month
  from public.class_months
  where id = p_class_month_id
  for update;

  if not found then raise exception 'CLASS_MONTH_NOT_FOUND'; end if;
  if v_month.status <> 'DRAFT' then raise exception 'CLASS_MONTH_NOT_DRAFT'; end if;

  v_start := make_date(v_month.year, v_month.month, 1);
  v_end := (v_start + interval '1 month - 1 day')::date;

  select count(*) into v_total
  from generate_series(v_start, v_end, interval '1 day') d(day)
  join public.class_month_schedules cs
    on cs.class_month_id = p_class_month_id
   and cs.status = 'ACTIVE'
  where extract(isodow from d.day)::int = cs.day_of_week;

  if v_total = 0 then raise exception 'CLASS_MONTH_NO_SCHEDULE'; end if;
  if not exists (
    select 1 from public.class_month_students where class_month_id = p_class_month_id
  ) then
    raise exception 'CLASS_MONTH_NO_STUDENTS';
  end if;

  for v_schedule in
    select *
    from public.class_month_schedules
    where class_month_id = p_class_month_id
      and status = 'ACTIVE'
  loop
    for v_date in
      select d::date
      from generate_series(v_start, v_end, interval '1 day') d
      where extract(isodow from d)::int = v_schedule.day_of_week
    loop
      if not exists (
        select 1
        from public.sessions
        where class_month_id = p_class_month_id
          and scheduled_start_at = ((v_date + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh')
      ) then
        insert into public.sessions(
          class_month_id,
          schedule_id,
          scheduled_start_at,
          scheduled_end_at
        )
        values (
          p_class_month_id,
          v_schedule.id,
          (v_date + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh',
          (v_date + v_schedule.end_time) at time zone 'Asia/Ho_Chi_Minh'
        )
        returning id into v_session_id;

        v_sessions := v_sessions + 1;

        insert into public.session_students(
          session_id,
          student_id,
          monthly_fee_snapshot,
          session_unit_value
        )
        select
          v_session_id,
          cms.student_id,
          cms.monthly_fee_snapshot,
          case
            when cms.session_fee_snapshot > 0 then cms.session_fee_snapshot
            else round(cms.monthly_fee_snapshot::numeric / v_total)::bigint
          end
        from public.class_month_students cms
        where cms.class_month_id = p_class_month_id;

        insert into public.session_staff(session_id, staff_id, assignment_role)
        select v_session_id, cms.staff_id, cms.assignment_role
        from public.class_month_staff cms
        where cms.class_month_id = p_class_month_id;
      end if;
    end loop;
  end loop;

  insert into public.tuition_records(
    class_month_id,
    student_id,
    monthly_fee_snapshot,
    amount_due
  )
  select
    p_class_month_id,
    cms.student_id,
    cms.monthly_fee_snapshot,
    round(cms.monthly_fee_snapshot::numeric * (
      select count(*)
      from public.sessions s
      join public.session_students ss on ss.session_id = s.id
      where s.class_month_id = p_class_month_id
        and ss.student_id = cms.student_id
        and s.scheduled_start_at::date >= cms.membership_start_date
        and s.scheduled_start_at::date <= coalesce(cms.membership_end_date, v_end)
    ) / v_total)::bigint
  from public.class_month_students cms
  where cms.class_month_id = p_class_month_id
  on conflict (class_month_id, student_id) do nothing;

  get diagnostics v_tuition = row_count;

  update public.class_months
  set status = 'ACTIVE', confirmed_at = now(), confirmed_by = p_actor_user_id
  where id = p_class_month_id;

  perform public.write_audit(
    p_actor_user_id,
    'CLASS_MONTH_ACTIVATE',
    'class_months',
    p_class_month_id,
    null,
    jsonb_build_object(
      'status', 'ACTIVE',
      'sessions_created', v_sessions,
      'override_conflicts', p_override_conflicts
    )
  );

  return jsonb_build_object(
    'class_month_id', p_class_month_id,
    'sessions_created', v_sessions,
    'tuition_created', v_tuition
  );
end;
$$;

grant execute on function public.activate_class_month_unchecked(uuid, uuid, boolean)
  to authenticated, service_role;
