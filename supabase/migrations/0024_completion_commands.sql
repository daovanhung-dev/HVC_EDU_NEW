create or replace function public.create_payroll_period(p_year smallint, p_month smallint, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_period public.payroll_periods%rowtype;
begin
  if not public.actor_has_permission(p_actor_user_id, 'PAYROLL_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_year not between 2000 and 2200 or p_month not between 1 and 12 then raise exception 'INVALID_PAYROLL_PERIOD'; end if;
  insert into public.payroll_periods(year, month) values (p_year, p_month) on conflict (year, month) do nothing;
  select * into v_period from public.payroll_periods where year = p_year and month = p_month;
  perform public.write_audit(p_actor_user_id, 'PAYROLL_PERIOD_CREATE', 'payroll_periods', v_period.id, null, jsonb_build_object('year', p_year, 'month', p_month));
  return jsonb_build_object('id', v_period.id, 'year', v_period.year, 'month', v_period.month, 'status', v_period.status);
end;
$$;

create or replace function public.add_salary_adjustment(p_payroll_period_id uuid, p_staff_id uuid, p_adjustment_type public.adjustment_type, p_amount bigint, p_reason text, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_status public.payroll_status;
begin
  if not public.actor_has_permission(p_actor_user_id, 'PAYROLL_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_amount <= 0 or nullif(trim(p_reason), '') is null then raise exception 'INVALID_SALARY_ADJUSTMENT'; end if;
  select status into v_status from public.payroll_periods where id = p_payroll_period_id for update;
  if v_status is null then raise exception 'PAYROLL_NOT_FOUND'; end if;
  if v_status <> 'DRAFT' then raise exception 'PAYROLL_LOCKED'; end if;
  if not exists (select 1 from public.staff where id = p_staff_id and status = 'ACTIVE') then raise exception 'STAFF_NOT_FOUND'; end if;
  insert into public.salary_adjustments(payroll_period_id, staff_id, adjustment_type, amount, reason, created_by)
  values (p_payroll_period_id, p_staff_id, p_adjustment_type, p_amount, trim(p_reason), p_actor_user_id) returning id into v_id;
  perform public.write_audit(p_actor_user_id, 'SALARY_ADJUSTMENT', 'salary_adjustments', v_id, null, jsonb_build_object('staff_id', p_staff_id, 'type', p_adjustment_type, 'amount', p_amount), p_reason);
  return jsonb_build_object('id', v_id, 'payroll_period_id', p_payroll_period_id);
end;
$$;

create or replace function public.set_account_status(p_user_id uuid, p_status public.account_status, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if v_profile.user_id = p_actor_user_id and p_status <> 'ACTIVE' then raise exception 'CANNOT_LOCK_SELF'; end if;
  if v_profile.role = 'ROOT_ADMIN' and not public.actor_is_root(p_actor_user_id) then raise exception 'FORBIDDEN'; end if;
  if not (public.actor_is_root(p_actor_user_id) or public.actor_has_permission(p_actor_user_id, 'STAFF_MANAGE') or (v_profile.role = 'STUDENT' and public.actor_has_permission(p_actor_user_id, 'STUDENTS_MANAGE'))) then raise exception 'FORBIDDEN'; end if;
  update public.profiles set status = p_status where user_id = p_user_id;
  update public.students set status = case when p_status = 'ACTIVE' then 'ACTIVE'::public.entity_status else 'INACTIVE'::public.entity_status end where user_id = p_user_id;
  update public.staff set status = case when p_status = 'ACTIVE' then 'ACTIVE'::public.entity_status else 'INACTIVE'::public.entity_status end where user_id = p_user_id;
  perform public.write_audit(p_actor_user_id, 'ACCOUNT_STATUS_CHANGE', 'profiles', v_profile.id, jsonb_build_object('status', v_profile.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('user_id', p_user_id, 'status', p_status);
end;
$$;

create or replace function public.create_manual_transaction(p_direction public.transaction_direction, p_category_id uuid, p_amount bigint, p_transaction_date date, p_payment_method public.payment_method, p_description text, p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.actor_has_permission(p_actor_user_id, 'ACCOUNTING_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_amount <= 0 or nullif(trim(p_description), '') is null then raise exception 'INVALID_TRANSACTION'; end if;
  if not exists (select 1 from public.accounting_categories where id = p_category_id and direction = p_direction and status = 'ACTIVE') then raise exception 'ACCOUNTING_CATEGORY_MISMATCH'; end if;
  insert into public.accounting_transactions(transaction_type, direction, category_id, amount, transaction_date, payment_method, description, created_by)
  values ('MANUAL', p_direction, p_category_id, p_amount, coalesce(p_transaction_date, current_date), p_payment_method, trim(p_description), p_actor_user_id) returning id into v_id;
  perform public.write_audit(p_actor_user_id, 'ACCOUNTING_MANUAL', 'accounting_transactions', v_id, null, jsonb_build_object('direction', p_direction, 'amount', p_amount), p_description);
  return jsonb_build_object('id', v_id, 'transaction_type', 'MANUAL', 'amount', p_amount);
end;
$$;

grant execute on function public.create_payroll_period(smallint, smallint, uuid) to authenticated, service_role;
grant execute on function public.add_salary_adjustment(uuid, uuid, public.adjustment_type, bigint, text, uuid) to authenticated, service_role;
grant execute on function public.set_account_status(uuid, public.account_status, uuid) to authenticated, service_role;
grant execute on function public.create_manual_transaction(public.transaction_direction, uuid, bigint, date, public.payment_method, text, uuid) to authenticated, service_role;

create or replace function public.set_admin_permission_groups(p_user_id uuid, p_group_ids uuid[], p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_profile public.profiles%rowtype; v_count integer;
begin
  if not public.actor_is_root(p_actor_user_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found or v_profile.role <> 'ADMIN' then raise exception 'ADMIN_ACCOUNT_NOT_FOUND'; end if;
  delete from public.admin_permission_groups where user_id = p_user_id;
  insert into public.admin_permission_groups(user_id, permission_group_id, assigned_by)
  select p_user_id, group_id, p_actor_user_id from unnest(coalesce(p_group_ids, '{}'::uuid[])) group_id
  on conflict do nothing;
  select count(*) into v_count from public.admin_permission_groups where user_id = p_user_id;
  perform public.write_audit(p_actor_user_id, 'PERMISSIONS_CHANGE', 'profiles', v_profile.id, null, jsonb_build_object('permission_groups', v_count));
  return jsonb_build_object('user_id', p_user_id, 'permission_groups', v_count);
end;
$$;

grant execute on function public.set_admin_permission_groups(uuid, uuid[], uuid) to authenticated, service_role;
