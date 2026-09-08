alter function public.activate_class_month(uuid, uuid, boolean) rename to activate_class_month_unchecked;

create or replace function public.activate_class_month(p_class_month_id uuid, p_actor_user_id uuid, p_override_conflicts boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_month public.class_months%rowtype; v_start date; v_end date; v_conflicts integer;
begin
  if not public.actor_has_permission(p_actor_user_id, 'CLASS_MONTH_MANAGE') then raise exception 'FORBIDDEN'; end if;
  select * into v_month from public.class_months where id = p_class_month_id for update;
  if not found then raise exception 'CLASS_MONTH_NOT_FOUND'; end if;
  if v_month.status <> 'DRAFT' then raise exception 'CLASS_MONTH_NOT_DRAFT'; end if;
  v_start := make_date(v_month.year, v_month.month, 1); v_end := (v_start + interval '1 month - 1 day')::date;
  with candidates as (
    select ((d::date + cs.start_time) at time zone 'Asia/Ho_Chi_Minh') as start_at, ((d::date + cs.end_time) at time zone 'Asia/Ho_Chi_Minh') as end_at
    from public.class_month_schedules cs cross join generate_series(v_start, v_end, interval '1 day') d
    where cs.class_month_id = p_class_month_id and cs.status = 'ACTIVE' and extract(isodow from d)::int = cs.day_of_week
  )
  select count(*) into v_conflicts
  from candidates c join public.sessions other on other.scheduled_start_at < c.end_at and other.scheduled_end_at > c.start_at and other.status in ('SCHEDULED', 'IN_PROGRESS') and other.class_month_id <> p_class_month_id
  where exists (select 1 from public.session_students oss join public.class_month_students nms on nms.student_id = oss.student_id where oss.session_id = other.id and nms.class_month_id = p_class_month_id)
     or exists (select 1 from public.session_staff ost join public.class_month_staff nmt on nmt.staff_id = ost.staff_id where ost.session_id = other.id and nmt.class_month_id = p_class_month_id);
  if v_conflicts > 0 and not p_override_conflicts then raise exception 'SCHEDULE_CONFLICT'; end if;
  return public.activate_class_month_unchecked(p_class_month_id, p_actor_user_id, p_override_conflicts);
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
  if v_tuition.status = 'PAID' then return jsonb_build_object('tuition_id', p_tuition_id, 'status', 'PAID', 'amount_paid', v_tuition.amount_paid, 'idempotent', true); end if;
  select id into v_category from public.accounting_categories where code = 'TUITION_INCOME' and direction = 'INCOME' limit 1;
  if v_category is null then raise exception 'TUITION_CATEGORY_MISSING'; end if;
  update public.tuition_records set status = 'PAID', amount_paid = amount_due, payment_method = p_payment_method, paid_at = now(), confirmed_by = p_actor_user_id where id = p_tuition_id;
  insert into public.accounting_transactions(transaction_type, direction, category_id, source_type, source_id, amount, transaction_date, payment_method, description, created_by)
  values ('AUTO', 'INCOME', v_category, 'TUITION', p_tuition_id, v_tuition.amount_due, current_date, p_payment_method, 'Thu học phí', p_actor_user_id) on conflict (transaction_type, source_type, source_id) where transaction_type = 'AUTO' do nothing;
  perform public.write_audit(p_actor_user_id, 'TUITION_CONFIRM_PAID', 'tuition_records', p_tuition_id, jsonb_build_object('status', v_tuition.status), jsonb_build_object('status', 'PAID', 'amount_paid', v_tuition.amount_due));
  return jsonb_build_object('tuition_id', p_tuition_id, 'status', 'PAID', 'amount_paid', v_tuition.amount_due);
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
  if v_period.status = 'PAID' then return jsonb_build_object('payroll_period_id', p_payroll_period_id, 'status', 'PAID', 'idempotent', true); end if;
  if v_period.status <> 'CONFIRMED' then raise exception 'PAYROLL_NOT_CONFIRMED'; end if;
  select id into v_category from public.accounting_categories where code = 'PAYROLL_EXPENSE' and direction = 'EXPENSE' limit 1;
  if v_category is null then raise exception 'PAYROLL_CATEGORY_MISSING'; end if;
  select coalesce(sum(pi.base_salary), 0) + coalesce((select sum(case when adjustment_type = 'BONUS' then amount else -amount end) from public.salary_adjustments where payroll_period_id = p_payroll_period_id), 0) into v_amount from public.payroll_items pi where pi.payroll_period_id = p_payroll_period_id;
  if v_amount < 0 then raise exception 'PAYROLL_NEGATIVE_TOTAL'; end if;
  update public.payroll_periods set status = 'PAID', paid_at = now(), paid_by = p_actor_user_id where id = p_payroll_period_id;
  insert into public.accounting_transactions(transaction_type, direction, category_id, source_type, source_id, amount, transaction_date, description, created_by)
  values ('AUTO', 'EXPENSE', v_category, 'PAYROLL', p_payroll_period_id, v_amount, current_date, 'Thanh toán lương', p_actor_user_id) on conflict (transaction_type, source_type, source_id) where transaction_type = 'AUTO' do nothing;
  perform public.write_audit(p_actor_user_id, 'PAYROLL_PAY', 'payroll_periods', p_payroll_period_id, jsonb_build_object('status', v_period.status), jsonb_build_object('status', 'PAID', 'amount', v_amount));
  return jsonb_build_object('payroll_period_id', p_payroll_period_id, 'status', 'PAID', 'amount', v_amount);
end;
$$;

grant execute on function public.activate_class_month(uuid, uuid, boolean) to authenticated, service_role;
