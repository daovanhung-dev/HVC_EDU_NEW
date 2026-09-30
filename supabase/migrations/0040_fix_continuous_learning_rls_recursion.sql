-- Break policy-to-policy reads in the continuous learning model. These
-- SECURITY DEFINER helpers inspect the underlying relations without invoking
-- their RLS policies, then expose only the existing row-level decisions.

create or replace function public.can_view_staff(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'STAFF_VIEW')
    or exists (
      select 1
      from public.staff own_staff
      where own_staff.id = p_staff_id
        and own_staff.user_id = auth.uid()
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
      select 1
      from public.class_memberships membership
      where membership.class_id = p_class_id
        and public.is_student_owner(membership.student_id)
    )
    or exists (
      select 1
      from public.class_schedules schedule
      join public.class_schedule_staff assignment on assignment.schedule_id = schedule.id
      join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
      where schedule.class_id = p_class_id
        and assigned_staff.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.sessions s
      where s.class_id = p_class_id
        and public.is_session_staff(s.id)
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
    or exists (
      select 1
      from public.sessions s
      join public.session_staff assignment on assignment.session_id = s.id
      join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
      where s.class_id = p_class_id
        and assigned_staff.user_id = auth.uid()
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
    or exists (
      select 1
      from public.class_schedule_staff assignment
      join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
      where assignment.schedule_id = p_schedule_id
        and assigned_staff.user_id = auth.uid()
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
    or exists (
      select 1
      from public.class_schedule_staff assignment
      join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
      where assignment.schedule_id = p_schedule_id
        and assignment.staff_id = p_staff_id
        and assigned_staff.user_id = auth.uid()
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
    or exists (
      select 1
      from public.session_staff assignment
      join public.staff assigned_staff on assigned_staff.id = assignment.staff_id
      where assignment.session_id = p_session_id
        and assignment.staff_id = p_staff_id
        and assigned_staff.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.session_students roster
      where roster.session_id = p_session_id
        and public.is_student_owner(roster.student_id)
    );
$$;

create or replace function public.can_view_student_attendance(p_session_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.actor_has_permission(auth.uid(), 'ACADEMIC_VIEW')
    or public.is_session_staff(p_session_id)
    or (
      public.is_student_owner(p_student_id)
      and exists (
        select 1
        from public.sessions s
        where s.id = p_session_id
          and s.status = 'COMPLETED'
      )
    );
$$;

revoke all on function public.can_view_staff(uuid) from public, anon;
revoke all on function public.can_view_class(uuid) from public, anon;
revoke all on function public.can_view_class_membership(uuid, uuid) from public, anon;
revoke all on function public.can_view_class_schedule(uuid) from public, anon;
revoke all on function public.can_view_class_schedule_staff(uuid, uuid) from public, anon;
revoke all on function public.can_view_session_staff(uuid, uuid) from public, anon;
revoke all on function public.can_view_student_attendance(uuid, uuid) from public, anon;

grant execute on function public.can_view_staff(uuid) to authenticated, service_role;
grant execute on function public.can_view_class(uuid) to authenticated, service_role;
grant execute on function public.can_view_class_membership(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_class_schedule(uuid) to authenticated, service_role;
grant execute on function public.can_view_class_schedule_staff(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_session_staff(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_student_attendance(uuid, uuid) to authenticated, service_role;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff for select using (public.can_view_staff(id));

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select using (public.can_view_class(id));

drop policy if exists memberships_select on public.class_memberships;
create policy memberships_select on public.class_memberships for select using (
  public.can_view_class_membership(class_id, student_id)
);

drop policy if exists class_schedules_select on public.class_schedules;
create policy class_schedules_select on public.class_schedules for select using (
  public.can_view_class_schedule(id)
);

drop policy if exists class_schedule_staff_select on public.class_schedule_staff;
create policy class_schedule_staff_select on public.class_schedule_staff for select using (
  public.can_view_class_schedule_staff(schedule_id, staff_id)
);

drop policy if exists session_staff_select on public.session_staff;
create policy session_staff_select on public.session_staff for select using (
  public.can_view_session_staff(session_id, staff_id)
);

drop policy if exists attendances_select on public.student_attendances;
create policy attendances_select on public.student_attendances for select using (
  public.can_view_student_attendance(session_id, student_id)
);
