create or replace function public.actor_role(p_user_id uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = p_user_id limit 1;
$$;

create or replace function public.actor_is_root(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where user_id = p_user_id and role = 'ROOT_ADMIN' and status = 'ACTIVE');
$$;

create or replace function public.actor_has_permission(p_user_id uuid, p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.actor_is_root(p_user_id)
    or exists (
      select 1
      from public.admin_permission_groups apg
      join public.permission_group_permissions pgp on pgp.permission_group_id = apg.permission_group_id
      join public.permissions p on p.id = pgp.permission_id
      join public.profiles pr on pr.user_id = apg.user_id
      where apg.user_id = p_user_id and p.code = p_permission_code and pr.status = 'ACTIVE'
    );
$$;

create or replace function public.current_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.profiles where user_id = auth.uid() limit 1; $$;

create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where user_id = auth.uid() limit 1; $$;

create or replace function public.is_root()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.actor_is_root(auth.uid()); $$;

create or replace function public.has_permission(p_permission_code text)
returns boolean
language sql stable security definer set search_path = public
as $$ select public.actor_has_permission(auth.uid(), p_permission_code); $$;

create or replace function public.is_student_owner(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.students where id = p_student_id and user_id = auth.uid()); $$;

create or replace function public.is_session_staff(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.session_staff ss
    join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and s.user_id = auth.uid() and s.status = 'ACTIVE'
  );
$$;

create or replace function public.is_session_teacher(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.session_staff ss
    join public.staff s on s.id = ss.staff_id
    where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER' and s.user_id = auth.uid() and s.status = 'ACTIVE'
  );
$$;

create or replace function public.write_audit(
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_reason text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.audit_logs(actor_user_id, actor_role, action, entity_type, entity_id, old_data, new_data, reason)
  values (p_actor_user_id, public.actor_role(p_actor_user_id), p_action, p_entity_type, p_entity_id, p_old_data, p_new_data, p_reason)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.clear_force_password_change()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set force_password_change = false where user_id = auth.uid();
end;
$$;

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
  v_eligible integer;
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
  where (((extract(isodow from d.day)::int) = cs.day_of_week));
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
  perform public.write_audit(p_actor_user_id, 'CLASS_MONTH_ACTIVATE', 'class_months', p_class_month_id, null, jsonb_build_object('status', 'ACTIVE', 'sessions_created', v_sessions));
  return jsonb_build_object('class_month_id', p_class_month_id, 'sessions_created', v_sessions, 'tuition_created', v_tuition);
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_session public.sessions%rowtype; v_revenue bigint;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'IN_PROGRESS' then raise exception 'SESSION_NOT_IN_PROGRESS'; end if;
  if not exists (select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER' and s.user_id = p_actor_user_id) then raise exception 'SESSION_TEACHER_REQUIRED'; end if;
  if exists (select 1 from public.session_students ss left join public.student_attendances sa on sa.session_id = ss.session_id and sa.student_id = ss.student_id where ss.session_id = p_session_id and sa.id is null) then raise exception 'SESSION_NOT_COMPLETEABLE'; end if;
  select coalesce(sum(ss.session_unit_value), 0)::bigint into v_revenue
  from public.session_students ss join public.student_attendances sa on sa.session_id = ss.session_id and sa.student_id = ss.student_id
  where ss.session_id = p_session_id and sa.status in ('PRESENT', 'LATE');
  update public.sessions set status = 'COMPLETED', ended_at = now(), ended_by = p_actor_user_id, revenue_snapshot = v_revenue where id = p_session_id;
  perform public.write_audit(p_actor_user_id, 'SESSION_COMPLETE', 'sessions', p_session_id, jsonb_build_object('status', v_session.status), jsonb_build_object('status', 'COMPLETED', 'revenue_snapshot', v_revenue));
  return jsonb_build_object('session_id', p_session_id, 'revenue_snapshot', v_revenue);
end;
$$;

create or replace function public.approve_timesheet(p_timesheet_id uuid, p_actor_user_id uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_timesheet public.timesheets%rowtype; v_status public.timesheet_status;
begin
  if not public.actor_has_permission(p_actor_user_id, 'TIMESHEET_APPROVE') then raise exception 'FORBIDDEN'; end if;
  select * into v_timesheet from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'TIMESHEET_NOT_FOUND'; end if;
  v_status := case when p_approve then 'APPROVED'::public.timesheet_status else 'REJECTED'::public.timesheet_status end;
  if not p_approve and nullif(trim(p_reason), '') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  update public.timesheets set status = v_status, approved_at = case when p_approve then now() else null end, approved_by = case when p_approve then p_actor_user_id else null end, rejection_reason = case when p_approve then null else p_reason end where id = p_timesheet_id;
  perform public.write_audit(p_actor_user_id, case when p_approve then 'TIMESHEET_APPROVE' else 'TIMESHEET_REJECT' end, 'timesheets', p_timesheet_id, null, jsonb_build_object('status', v_status), p_reason);
  return jsonb_build_object('timesheet_id', p_timesheet_id, 'status', v_status);
end;
$$;

create or replace function public.confirm_tuition_paid(p_tuition_id uuid, p_actor_user_id uuid, p_payment_method public.payment_method)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tuition public.tuition_records%rowtype; v_category uuid;
begin
  if not public.actor_has_permission(p_actor_user_id, 'ACCOUNTING_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select * into v_tuition from public.tuition_records where id = p_tuition_id for update;
  if not found then raise exception 'TUITION_NOT_FOUND'; end if;
  if v_tuition.status = 'PAID' then raise exception 'TUITION_ALREADY_PAID'; end if;
  select id into v_category from public.accounting_categories where code = 'TUITION_INCOME' and direction = 'INCOME' limit 1;
  if v_category is null then raise exception 'TUITION_CATEGORY_MISSING'; end if;
  update public.tuition_records set status = 'PAID', amount_paid = amount_due, payment_method = p_payment_method, paid_at = now(), confirmed_by = p_actor_user_id where id = p_tuition_id;
  insert into public.accounting_transactions(transaction_type, direction, category_id, source_type, source_id, amount, transaction_date, payment_method, description, created_by)
  values ('AUTO', 'INCOME', v_category, 'TUITION', p_tuition_id, v_tuition.amount_due, current_date, p_payment_method, 'Thu học phí', p_actor_user_id);
  perform public.write_audit(p_actor_user_id, 'TUITION_CONFIRM_PAID', 'tuition_records', p_tuition_id, jsonb_build_object('status', v_tuition.status), jsonb_build_object('status', 'PAID', 'amount_paid', v_tuition.amount_due));
  return jsonb_build_object('tuition_id', p_tuition_id, 'status', 'PAID');
end;
$$;

create or replace function public.pay_payroll(p_payroll_period_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_period public.payroll_periods%rowtype; v_category uuid; v_amount bigint;
begin
  if not public.actor_has_permission(p_actor_user_id, 'PAYROLL_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select * into v_period from public.payroll_periods where id = p_payroll_period_id for update;
  if not found then raise exception 'PAYROLL_NOT_FOUND'; end if;
  if v_period.status <> 'CONFIRMED' then raise exception 'PAYROLL_NOT_CONFIRMED'; end if;
  select id into v_category from public.accounting_categories where code = 'PAYROLL_EXPENSE' and direction = 'EXPENSE' limit 1;
  if v_category is null then raise exception 'PAYROLL_CATEGORY_MISSING'; end if;
  select coalesce(sum(pi.base_salary), 0) + coalesce((select sum(case when adjustment_type = 'BONUS' then amount else -amount end) from public.salary_adjustments where payroll_period_id = p_payroll_period_id), 0) into v_amount from public.payroll_items pi where pi.payroll_period_id = p_payroll_period_id;
  if v_amount < 0 then raise exception 'PAYROLL_NEGATIVE_TOTAL'; end if;
  update public.payroll_periods set status = 'PAID', paid_at = now(), paid_by = p_actor_user_id where id = p_payroll_period_id;
  insert into public.accounting_transactions(transaction_type, direction, category_id, source_type, source_id, amount, transaction_date, description, created_by)
  values ('AUTO', 'EXPENSE', v_category, 'PAYROLL', p_payroll_period_id, v_amount, current_date, 'Thanh toán lương', p_actor_user_id);
  perform public.write_audit(p_actor_user_id, 'PAYROLL_PAY', 'payroll_periods', p_payroll_period_id, jsonb_build_object('status', v_period.status), jsonb_build_object('status', 'PAID', 'amount', v_amount));
  return jsonb_build_object('payroll_period_id', p_payroll_period_id, 'status', 'PAID', 'amount', v_amount);
end;
$$;
