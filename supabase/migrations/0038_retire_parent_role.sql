-- Keep legacy PARENT profiles and links for audit/history, but stop granting
-- them access to learner data. New logins and account creation are rejected
-- by the corresponding Edge Functions.

create or replace function public.actor_has_permission(
  p_user_id uuid,
  p_permission_code text
)
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
      where apg.user_id = p_user_id
        and p.code = p_permission_code
        and pr.role = 'ADMIN'
        and pr.status = 'ACTIVE'
    );
$$;

create or replace function public.is_parent_owner(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or public.has_permission('STUDENTS_VIEW')
    or public.is_student_owner(p_student_id)
    or exists (
      select 1
      from public.session_students ss
      join public.sessions s on s.id = ss.session_id
      where ss.student_id = p_student_id
        and public.is_session_staff(s.id)
    );
$$;

drop policy if exists parent_students_select on public.parent_students;
create policy parent_students_select on public.parent_students
for select using (
  public.is_root() or public.has_permission('STUDENTS_VIEW')
);

drop policy if exists parent_students_manage on public.parent_students;
create policy parent_students_manage on public.parent_students
for all using (
  public.is_root() or public.has_permission('STUDENTS_MANAGE')
) with check (
  public.is_root() or public.has_permission('STUDENTS_MANAGE')
);
