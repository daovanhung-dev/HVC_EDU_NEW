-- Resolve student visibility through a SECURITY DEFINER helper so the
-- students -> session_students -> students policy path cannot recurse.

create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('STUDENTS_VIEW')
    or exists (
      select 1
      from public.students own_student
      where own_student.id = p_student_id
        and own_student.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.session_students ss
      join public.sessions s on s.id = ss.session_id
      where ss.student_id = p_student_id
        and public.is_session_staff(s.id)
    );
$$;

revoke all on function public.can_view_student(uuid) from public, anon;
grant execute on function public.can_view_student(uuid) to authenticated, service_role;

drop policy if exists students_select on public.students;
create policy students_select on public.students for select using (
  public.can_view_student(id)
);
