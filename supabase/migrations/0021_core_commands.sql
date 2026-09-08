create or replace function public.start_session(p_session_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_status public.session_status;
begin
  select status into v_status from public.sessions where id = p_session_id for update;
  if v_status is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status <> 'SCHEDULED' then raise exception 'SESSION_NOT_SCHEDULED'; end if;
  if not exists (select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id where ss.session_id = p_session_id and s.user_id = p_actor_user_id and s.status = 'ACTIVE') then raise exception 'SESSION_STAFF_REQUIRED'; end if;
  update public.sessions set status = 'IN_PROGRESS', started_at = now(), started_by = p_actor_user_id where id = p_session_id;
  perform public.write_audit(p_actor_user_id, 'SESSION_START', 'sessions', p_session_id, jsonb_build_object('status', v_status), jsonb_build_object('status', 'IN_PROGRESS'));
  return jsonb_build_object('session_id', p_session_id, 'status', 'IN_PROGRESS');
end;
$$;

create or replace function public.reopen_session(p_session_id uuid, p_actor_user_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_status public.session_status;
begin
  if not public.actor_has_permission(p_actor_user_id, 'ACADEMIC_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'REASON_REQUIRED'; end if;
  select status into v_status from public.sessions where id = p_session_id for update;
  if v_status is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status <> 'COMPLETED' then raise exception 'SESSION_NOT_COMPLETED'; end if;
  update public.sessions set status = 'IN_PROGRESS', ended_at = null, ended_by = null where id = p_session_id;
  perform public.write_audit(p_actor_user_id, 'SESSION_REOPEN', 'sessions', p_session_id, jsonb_build_object('status', v_status), jsonb_build_object('status', 'IN_PROGRESS'), p_reason);
  return jsonb_build_object('session_id', p_session_id, 'status', 'IN_PROGRESS');
end;
$$;

create or replace function public.replace_session_staff(p_session_id uuid, p_original_staff_id uuid, p_replacement_staff_id uuid, p_reason text, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_status public.session_status; v_role public.user_role;
begin
  if not (public.actor_has_permission(p_actor_user_id, 'STAFF_MANAGE') or public.actor_has_permission(p_actor_user_id, 'CLASS_MONTH_MANAGE')) then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'REASON_REQUIRED'; end if;
  select status into v_status from public.sessions where id = p_session_id for update;
  if v_status is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status in ('COMPLETED', 'CANCELLED') then raise exception 'SESSION_LOCKED'; end if;
  select assignment_role into v_role from public.session_staff where session_id = p_session_id and staff_id = p_original_staff_id;
  if v_role is null then raise exception 'ORIGINAL_STAFF_NOT_ASSIGNED'; end if;
  if not exists (select 1 from public.staff where id = p_replacement_staff_id and status = 'ACTIVE') then raise exception 'REPLACEMENT_STAFF_INACTIVE'; end if;
  if exists (select 1 from public.session_staff where session_id = p_session_id and staff_id = p_replacement_staff_id) then raise exception 'REPLACEMENT_STAFF_ALREADY_ASSIGNED'; end if;
  delete from public.session_staff where session_id = p_session_id and staff_id = p_original_staff_id;
  insert into public.session_staff(session_id, staff_id, assignment_role, is_replacement, original_staff_id) values (p_session_id, p_replacement_staff_id, v_role, true, p_original_staff_id);
  insert into public.staff_replacements(session_id, original_staff_id, replacement_staff_id, reason, changed_by) values (p_session_id, p_original_staff_id, p_replacement_staff_id, p_reason, p_actor_user_id);
  perform public.write_audit(p_actor_user_id, 'SESSION_REPLACE_STAFF', 'sessions', p_session_id, jsonb_build_object('original_staff_id', p_original_staff_id), jsonb_build_object('replacement_staff_id', p_replacement_staff_id), p_reason);
  return jsonb_build_object('session_id', p_session_id, 'replacement_staff_id', p_replacement_staff_id);
end;
$$;

create or replace function public.submit_timesheet(p_session_id uuid, p_staff_id uuid, p_actor_user_id uuid, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_status public.session_status; v_existing public.timesheets%rowtype;
begin
  if not exists (select 1 from public.staff where id = p_staff_id and user_id = p_actor_user_id and status = 'ACTIVE') then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.sessions where id = p_session_id;
  if v_status is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_status <> 'COMPLETED' then raise exception 'SESSION_NOT_COMPLETED'; end if;
  if not exists (select 1 from public.session_staff where session_id = p_session_id and staff_id = p_staff_id) then raise exception 'SESSION_STAFF_REQUIRED'; end if;
  select * into v_existing from public.timesheets where session_id = p_session_id and staff_id = p_staff_id for update;
  if found and v_existing.status not in ('REJECTED') then raise exception 'TIMESHEET_ALREADY_SUBMITTED'; end if;
  if found then
    update public.timesheets set status = 'PENDING', submitted_at = now(), rejection_reason = null, notes = p_notes where id = v_existing.id returning id into v_id;
  else
    insert into public.timesheets(session_id, staff_id, notes) values (p_session_id, p_staff_id, p_notes) returning id into v_id;
  end if;
  perform public.write_audit(p_actor_user_id, 'TIMESHEET_SUBMIT', 'timesheets', v_id, null, jsonb_build_object('status', 'PENDING'));
  return jsonb_build_object('timesheet_id', v_id, 'status', 'PENDING');
end;
$$;

create or replace function public.calculate_payroll(p_payroll_period_id uuid, p_actor_user_id uuid, p_salary_method public.salary_method, p_percentage numeric default null, p_fixed_amount bigint default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_period public.payroll_periods%rowtype; v_count integer; v_excess boolean;
begin
  if not public.actor_has_permission(p_actor_user_id, 'PAYROLL_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select * into v_period from public.payroll_periods where id = p_payroll_period_id for update;
  if not found then raise exception 'PAYROLL_NOT_FOUND'; end if;
  if v_period.status <> 'DRAFT' then raise exception 'PAYROLL_LOCKED'; end if;
  if p_salary_method = 'PERCENTAGE' and (p_percentage is null or p_percentage < 0 or p_percentage > 100) then raise exception 'INVALID_SALARY_PERCENTAGE'; end if;
  if p_salary_method = 'FIXED' and (p_fixed_amount is null or p_fixed_amount < 0) then raise exception 'INVALID_FIXED_SALARY'; end if;
  insert into public.payroll_items(payroll_period_id, staff_id, session_id, timesheet_id, salary_method, revenue_snapshot, salary_percentage, fixed_amount, base_salary)
  select p_payroll_period_id, t.staff_id, t.session_id, t.id, p_salary_method, s.revenue_snapshot, p_percentage, p_fixed_amount,
    case when p_salary_method = 'PERCENTAGE' then round(s.revenue_snapshot::numeric * p_percentage / 100)::bigint else p_fixed_amount end
  from public.timesheets t join public.sessions s on s.id = t.session_id
  join public.class_months cm on cm.id = s.class_month_id
  where t.status = 'APPROVED' and cm.year = v_period.year and cm.month = v_period.month
  on conflict (payroll_period_id, staff_id, session_id) do update set salary_method = excluded.salary_method, revenue_snapshot = excluded.revenue_snapshot, salary_percentage = excluded.salary_percentage, fixed_amount = excluded.fixed_amount, base_salary = excluded.base_salary;
  select count(*) into v_count from public.payroll_items where payroll_period_id = p_payroll_period_id;
  select exists (select 1 from (select session_id, sum(base_salary) total from public.payroll_items where payroll_period_id = p_payroll_period_id group by session_id) x join public.sessions s on s.id = x.session_id where x.total > s.revenue_snapshot) into v_excess;
  if v_excess then raise exception 'PAYROLL_BASE_EXCEEDS_REVENUE'; end if;
  perform public.write_audit(p_actor_user_id, 'PAYROLL_CALCULATE', 'payroll_periods', p_payroll_period_id, null, jsonb_build_object('items', v_count, 'salary_method', p_salary_method));
  return jsonb_build_object('payroll_period_id', p_payroll_period_id, 'items', v_count);
end;
$$;

create or replace function public.confirm_payroll(p_payroll_period_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_status public.payroll_status; v_count integer;
begin
  if not public.actor_has_permission(p_actor_user_id, 'PAYROLL_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.payroll_periods where id = p_payroll_period_id for update;
  if v_status is null then raise exception 'PAYROLL_NOT_FOUND'; end if;
  if v_status <> 'DRAFT' then raise exception 'PAYROLL_NOT_DRAFT'; end if;
  select count(*) into v_count from public.payroll_items where payroll_period_id = p_payroll_period_id;
  if v_count = 0 then raise exception 'PAYROLL_NO_ITEMS'; end if;
  update public.payroll_periods set status = 'CONFIRMED', confirmed_at = now(), confirmed_by = p_actor_user_id where id = p_payroll_period_id;
  perform public.write_audit(p_actor_user_id, 'PAYROLL_CONFIRM', 'payroll_periods', p_payroll_period_id, jsonb_build_object('status', v_status), jsonb_build_object('status', 'CONFIRMED'));
  return jsonb_build_object('payroll_period_id', p_payroll_period_id, 'status', 'CONFIRMED');
end;
$$;
