-- Resolve session visibility through SECURITY DEFINER helpers so policies on
-- sessions/session_students do not recurse through each other.

create or replace function public.can_view_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('ACADEMIC_VIEW')
    or public.is_session_staff(p_session_id)
    or exists (
      select 1
      from public.sessions own_session
      join public.session_students ss on ss.session_id = own_session.id
      join public.students own_student on own_student.id = ss.student_id
      where own_session.id = p_session_id
        and own_session.status = 'COMPLETED'
        and own_student.user_id = auth.uid()
    );
$$;

create or replace function public.can_view_session_student(p_session_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('ACADEMIC_VIEW')
    or public.is_session_staff(p_session_id)
    or exists (
      select 1
      from public.sessions own_session
      join public.students own_student on own_student.user_id = auth.uid()
      where own_session.id = p_session_id
        and own_session.status = 'COMPLETED'
        and own_student.id = p_student_id
    );
$$;

revoke all on function public.can_view_session(uuid) from public, anon;
revoke all on function public.can_view_session_student(uuid, uuid) from public, anon;
grant execute on function public.can_view_session(uuid) to authenticated, service_role;
grant execute on function public.can_view_session_student(uuid, uuid) to authenticated, service_role;

drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select using (
  public.can_view_session(id)
);

drop policy if exists session_students_select on public.session_students;
create policy session_students_select on public.session_students for select using (
  public.can_view_session_student(session_id, student_id)
);

drop policy if exists attendances_select on public.student_attendances;
create policy attendances_select on public.student_attendances for select using (
  public.can_view_session_student(session_id, student_id)
);
