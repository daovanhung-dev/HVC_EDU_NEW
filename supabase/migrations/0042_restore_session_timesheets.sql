begin;

-- Restore only the per-completed-session timesheet workflow. Payroll and other
-- archived financial modules remain inaccessible to authenticated app users.
drop policy if exists timesheets_select on public.timesheets;
drop policy if exists timesheets_insert on public.timesheets;
drop policy if exists timesheets_update on public.timesheets;

revoke all on public.timesheets from anon, authenticated;
grant select on public.timesheets to authenticated;

create policy timesheets_select on public.timesheets for select using (
  public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
  or exists (
    select 1 from public.staff st
    where st.id = timesheets.staff_id and st.user_id = auth.uid()
  )
);

create or replace function public.submit_timesheet(
  p_session_id uuid,
  p_staff_id uuid,
  p_actor_user_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_status public.session_status;
  v_existing public.timesheets%rowtype;
  v_timesheet_id uuid;
begin
  if p_session_id is null or p_staff_id is null or p_actor_user_id is null
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  if not exists (
    select 1 from public.staff st
    where st.id = p_staff_id and st.user_id = p_actor_user_id
      and st.staff_type = 'TEACHER' and st.status = 'ACTIVE'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select s.status into v_session_status
  from public.sessions s where s.id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session_status <> 'COMPLETED' then raise exception 'SESSION_NOT_COMPLETED'; end if;
  if not exists (
    select 1 from public.session_staff ss
    where ss.session_id = p_session_id and ss.staff_id = p_staff_id
      and ss.assignment_role = 'TEACHER'
  ) then raise exception 'SESSION_STAFF_REQUIRED'; end if;

  select * into v_existing
  from public.timesheets t
  where t.session_id = p_session_id and t.staff_id = p_staff_id
  for update;
  if found and v_existing.status <> 'REJECTED' then
    raise exception 'TIMESHEET_ALREADY_SUBMITTED';
  end if;

  if found then
    update public.timesheets
    set status = 'PENDING', submitted_at = now(), approved_at = null,
        approved_by = null, rejection_reason = null, notes = nullif(trim(p_notes), '')
    where id = v_existing.id
    returning id into v_timesheet_id;
  else
    insert into public.timesheets(session_id, staff_id, notes)
    values (p_session_id, p_staff_id, nullif(trim(p_notes), ''))
    returning id into v_timesheet_id;
  end if;

  perform public.write_audit(
    p_actor_user_id, 'TIMESHEET_SUBMIT', 'timesheets', v_timesheet_id, null,
    jsonb_build_object('status', 'PENDING', 'session_id', p_session_id), null
  );
  return jsonb_build_object('timesheet_id', v_timesheet_id, 'status', 'PENDING');
end;
$$;

create or replace function public.approve_timesheet(
  p_timesheet_id uuid,
  p_actor_user_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timesheet public.timesheets%rowtype;
  v_status public.timesheet_status;
begin
  if p_timesheet_id is null or p_actor_user_id is null or p_approve is null
     or length(coalesce(p_reason, '')) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if not public.actor_has_permission(p_actor_user_id, 'TIMESHEET_APPROVE') then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_timesheet
  from public.timesheets t where t.id = p_timesheet_id for update;
  if not found then raise exception 'TIMESHEET_NOT_FOUND'; end if;
  if v_timesheet.status <> 'PENDING' then raise exception 'TIMESHEET_NOT_PENDING'; end if;
  if not p_approve and nullif(trim(p_reason), '') is null then
    raise exception 'REJECTION_REASON_REQUIRED';
  end if;

  v_status := case when p_approve then 'APPROVED'::public.timesheet_status else 'REJECTED'::public.timesheet_status end;
  update public.timesheets
  set status = v_status,
      approved_at = case when p_approve then now() else null end,
      approved_by = case when p_approve then p_actor_user_id else null end,
      rejection_reason = case when p_approve then null else trim(p_reason) end
  where id = p_timesheet_id;

  perform public.write_audit(
    p_actor_user_id,
    case when p_approve then 'TIMESHEET_APPROVE' else 'TIMESHEET_REJECT' end,
    'timesheets', p_timesheet_id,
    jsonb_build_object('status', v_timesheet.status),
    jsonb_build_object('status', v_status),
    case when p_approve then null else trim(p_reason) end
  );
  return jsonb_build_object('timesheet_id', p_timesheet_id, 'status', v_status);
end;
$$;

revoke all on function public.submit_timesheet(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.approve_timesheet(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_timesheet(uuid, uuid, uuid, text) to service_role;
grant execute on function public.approve_timesheet(uuid, uuid, boolean, text) to service_role;

commit;
