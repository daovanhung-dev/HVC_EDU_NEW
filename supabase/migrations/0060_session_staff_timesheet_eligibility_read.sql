begin;

create or replace function public.get_session_staff_timesheet_eligibility(p_session_ids uuid[])
returns table(session_id uuid, staff_id uuid, timesheet_eligible boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select ss.session_id, ss.staff_id, ss.timesheet_eligible
  from public.session_staff ss
  where ss.session_id = any(coalesce(p_session_ids, array[]::uuid[]))
    and ss.assignment_role = 'TEACHER'
    and (
      public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
      or (
        public.is_active_teacher()
        and exists (
          select 1 from public.staff assigned_staff
          where assigned_staff.id = ss.staff_id and assigned_staff.user_id = auth.uid()
        )
      )
    );
$$;

comment on function public.get_session_staff_timesheet_eligibility(uuid[])
  is 'Returns timesheet eligibility only to academic viewers and active teachers assigned to the session; direct column access remains restricted.';

revoke all on function public.get_session_staff_timesheet_eligibility(uuid[]) from public, anon;
grant execute on function public.get_session_staff_timesheet_eligibility(uuid[]) to authenticated;

commit;
