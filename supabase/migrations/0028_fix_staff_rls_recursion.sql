-- Resolve staff visibility through a SECURITY DEFINER helper so policies on
-- staff do not recursively evaluate session_staff -> staff -> session_staff.

create or replace function public.can_view_staff(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('STAFF_VIEW')
    or exists (
      select 1
      from public.staff own_staff
      where own_staff.id = p_staff_id
        and own_staff.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.session_staff own_assignment
      join public.staff own_staff on own_staff.id = own_assignment.staff_id
      join public.session_staff target_assignment
        on target_assignment.session_id = own_assignment.session_id
      where target_assignment.staff_id = p_staff_id
        and own_staff.user_id = auth.uid()
        and own_staff.status = 'ACTIVE'
    );
$$;

revoke all on function public.can_view_staff(uuid) from public, anon;
grant execute on function public.can_view_staff(uuid) to authenticated, service_role;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff for select using (
  public.can_view_staff(id)
);
