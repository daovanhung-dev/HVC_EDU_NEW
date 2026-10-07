begin;

-- Keep teacher access to learning records closed while the reset password is active.
create or replace function public.is_active_teacher()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.staff st on st.user_id = p.user_id
    where p.user_id = auth.uid()
      and p.role = 'TEACHER'
      and p.status = 'ACTIVE'
      and not p.force_password_change
      and st.staff_type = 'TEACHER'
      and st.status = 'ACTIVE'
  );
$$;

revoke all on function public.is_active_teacher() from public, anon;
grant execute on function public.is_active_teacher() to authenticated, service_role;

create or replace function public.is_session_staff(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_active_teacher() and exists (
    select 1
    from public.session_staff ss
    join public.staff st on st.id = ss.staff_id
    where ss.session_id = p_session_id
      and st.user_id = auth.uid()
      and st.staff_type = 'TEACHER'
      and st.status = 'ACTIVE'
  );
$$;

create or replace function public.is_session_teacher(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_active_teacher() and exists (
    select 1
    from public.session_staff ss
    join public.staff st on st.id = ss.staff_id
    where ss.session_id = p_session_id
      and ss.assignment_role = 'TEACHER'
      and st.user_id = auth.uid()
      and st.staff_type = 'TEACHER'
      and st.status = 'ACTIVE'
  );
$$;

revoke all on function public.is_session_staff(uuid) from public, anon;
revoke all on function public.is_session_teacher(uuid) from public, anon;
grant execute on function public.is_session_staff(uuid) to authenticated, service_role;
grant execute on function public.is_session_teacher(uuid) to authenticated, service_role;

create or replace function public.can_view_staff(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'STAFF_VIEW')
    or (
      public.is_active_teacher()
      and exists (
        select 1 from public.staff own_staff
        where own_staff.id = p_staff_id and own_staff.user_id = auth.uid()
      )
    )
    or exists (
      select 1
      from public.session_staff assignment
      join public.session_students roster on roster.session_id = assignment.session_id
      where assignment.staff_id = p_staff_id
        and public.is_student_owner(roster.student_id)
    );
$$;

create or replace function public.can_view_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'CLASS_VIEW')
    or exists (
      select 1 from public.class_memberships membership
      where membership.class_id = p_class_id
        and public.is_student_owner(membership.student_id)
    )
    or (
      public.is_active_teacher()
      and exists (
        select 1
        from public.class_schedules schedule
        join public.class_schedule_staff assignment on assignment.schedule_id = schedule.id
        join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
        where schedule.class_id = p_class_id and assigned_staff.user_id = auth.uid()
      )
    )
    or exists (
      select 1 from public.sessions s
      where s.class_id = p_class_id and public.is_session_staff(s.id)
    );
$$;

create or replace function public.can_view_class_membership(p_class_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'STUDENTS_VIEW')
    or public.is_student_owner(p_student_id)
    or (
      public.is_active_teacher()
      and exists (
        select 1
        from public.sessions s
        join public.session_staff assignment on assignment.session_id = s.id
        join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
        where s.class_id = p_class_id and assigned_staff.user_id = auth.uid()
      )
    );
$$;

create or replace function public.can_view_class_schedule(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'CLASS_VIEW')
    or (
      public.is_active_teacher()
      and exists (
        select 1
        from public.class_schedule_staff assignment
        join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
        where assignment.schedule_id = p_schedule_id and assigned_staff.user_id = auth.uid()
      )
    )
    or exists (
      select 1
      from public.class_schedules schedule
      join public.class_memberships membership on membership.class_id = schedule.class_id
      where schedule.id = p_schedule_id
        and public.is_student_owner(membership.student_id)
    );
$$;

create or replace function public.can_view_class_schedule_staff(p_schedule_id uuid, p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'CLASS_VIEW')
    or (
      public.is_active_teacher()
      and exists (
        select 1
        from public.class_schedule_staff assignment
        join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
        where assignment.schedule_id = p_schedule_id
          and assignment.staff_id = p_staff_id
          and assigned_staff.user_id = auth.uid()
      )
    );
$$;

create or replace function public.can_view_session_staff(p_session_id uuid, p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
    or (
      public.is_active_teacher()
      and exists (
        select 1
        from public.session_staff assignment
        join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
        where assignment.session_id = p_session_id
          and assignment.staff_id = p_staff_id
          and assigned_staff.user_id = auth.uid()
      )
    )
    or exists (
      select 1 from public.session_students roster
      where roster.session_id = p_session_id
        and public.is_student_owner(roster.student_id)
    );
$$;

-- Preserve the student's existing restriction and apply the same gate to teachers.
create or replace function public.clear_force_password_change()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('STUDENT', 'TEACHER')
      and p.force_password_change
  ) then
    raise exception 'PASSWORD_CHANGE_REQUIRED';
  end if;

  update public.profiles
  set force_password_change = false
  where user_id = auth.uid();
end;
$$;

revoke all on function public.clear_force_password_change() from public, anon;
grant execute on function public.clear_force_password_change() to authenticated, service_role;

drop policy if exists timesheets_select on public.timesheets;
create policy timesheets_select on public.timesheets for select using (
  public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
  or (
    public.is_active_teacher()
    and exists (
      select 1 from public.staff st
      where st.id = timesheets.staff_id and st.user_id = auth.uid()
    )
  )
);

commit;
