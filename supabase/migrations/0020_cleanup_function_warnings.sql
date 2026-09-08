create or replace function public.activate_class_month(p_class_month_id uuid, p_actor_user_id uuid, p_override_conflicts boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
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
  if not public.actor_has_permission(p_actor_user_id, 'CLASS_MONTH_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select * into v_month from public.class_months where id = p_class_month_id for update;
  if not found then raise exception 'CLASS_MONTH_NOT_FOUND'; end if;
  if v_month.status <> 'DRAFT' then raise exception 'CLASS_MONTH_NOT_DRAFT'; end if;
  v_start := make_date(v_month.year, v_month.month, 1);
  v_end := (v_start + interval '1 month - 1 day')::date;

  select count(*) into v_total
  from generate_series(v_start, v_end, interval '1 day') d(day)
  join public.class_month_schedules cs on cs.class_month_id = p_class_month_id and cs.status = 'ACTIVE'
  where extract(isodow from d.day)::int = cs.day_of_week;
  if v_total = 0 then raise exception 'CLASS_MONTH_NO_SCHEDULE'; end if;
  if not exists (select 1 from public.class_month_students where class_month_id = p_class_month_id) then raise exception 'CLASS_MONTH_NO_STUDENTS'; end if;

  for v_schedule in select * from public.class_month_schedules where class_month_id = p_class_month_id and status = 'ACTIVE' loop
    for v_date in select d::date from generate_series(v_start, v_end, interval '1 day') d where extract(isodow from d)::int = v_schedule.day_of_week loop
      if not exists (select 1 from public.sessions where class_month_id = p_class_month_id and scheduled_start_at = ((v_date + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh')) then
        insert into public.sessions(class_month_id, schedule_id, scheduled_start_at, scheduled_end_at)
        values (p_class_month_id, v_schedule.id, (v_date + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh', (v_date + v_schedule.end_time) at time zone 'Asia/Ho_Chi_Minh')
        returning id into v_session_id;
        v_sessions := v_sessions + 1;
        insert into public.session_students(session_id, student_id, monthly_fee_snapshot, session_unit_value)
        select v_session_id, cms.student_id, cms.monthly_fee_snapshot, round(cms.monthly_fee_snapshot::numeric / v_total)::bigint
        from public.class_month_students cms where cms.class_month_id = p_class_month_id;
        insert into public.session_staff(session_id, staff_id, assignment_role)
        select v_session_id, cms.staff_id, cms.assignment_role
        from public.class_month_staff cms where cms.class_month_id = p_class_month_id;
      end if;
    end loop;
  end loop;

  insert into public.tuition_records(class_month_id, student_id, monthly_fee_snapshot, amount_due)
  select p_class_month_id, cms.student_id, cms.monthly_fee_snapshot,
         round(cms.monthly_fee_snapshot::numeric * (
           select count(*) from public.sessions s join public.session_students ss on ss.session_id = s.id
           where s.class_month_id = p_class_month_id and ss.student_id = cms.student_id
             and s.scheduled_start_at::date >= cms.membership_start_date
             and s.scheduled_start_at::date <= coalesce(cms.membership_end_date, v_end)
         ) / v_total)::bigint
  from public.class_month_students cms
  where cms.class_month_id = p_class_month_id
  on conflict (class_month_id, student_id) do nothing;
  get diagnostics v_tuition = row_count;

  update public.class_months set status = 'ACTIVE', confirmed_at = now(), confirmed_by = p_actor_user_id where id = p_class_month_id;
  perform public.write_audit(p_actor_user_id, 'CLASS_MONTH_ACTIVATE', 'class_months', p_class_month_id, null, jsonb_build_object('status', 'ACTIVE', 'sessions_created', v_sessions, 'override_conflicts', p_override_conflicts));
  return jsonb_build_object('class_month_id', p_class_month_id, 'sessions_created', v_sessions, 'tuition_created', v_tuition);
end;
$$;

create or replace function public.approve_timesheet(p_timesheet_id uuid, p_actor_user_id uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_status public.timesheet_status;
begin
  if not public.actor_has_permission(p_actor_user_id, 'TIMESHEET_APPROVE') then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.timesheets where id = p_timesheet_id) then raise exception 'TIMESHEET_NOT_FOUND'; end if;
  v_status := case when p_approve then 'APPROVED'::public.timesheet_status else 'REJECTED'::public.timesheet_status end;
  if not p_approve and nullif(trim(p_reason), '') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  update public.timesheets set status = v_status, approved_at = case when p_approve then now() else null end, approved_by = case when p_approve then p_actor_user_id else null end, rejection_reason = case when p_approve then null else p_reason end where id = p_timesheet_id;
  perform public.write_audit(p_actor_user_id, case when p_approve then 'TIMESHEET_APPROVE' else 'TIMESHEET_REJECT' end, 'timesheets', p_timesheet_id, null, jsonb_build_object('status', v_status), p_reason);
  return jsonb_build_object('timesheet_id', p_timesheet_id, 'status', v_status);
end;
$$;
