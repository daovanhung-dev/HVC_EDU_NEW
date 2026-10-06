-- Students with a forced password change can still read their own profile so
-- the frontend can route them to the password form, but cannot read their
-- student-linked learning data before completing that change.
create or replace function public.is_student_owner(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select not exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'STUDENT'
        and p.force_password_change
    )
    and exists (
      select 1
      from public.students s
      where s.id = p_student_id
        and s.user_id = auth.uid()
    );
$$;

revoke all on function public.is_student_owner(uuid) from public, anon;
grant execute on function public.is_student_owner(uuid) to authenticated, service_role;

-- Do not let a forced-change student clear the gate by calling this RPC
-- directly. The password-change Edge Function updates Auth first, then uses
-- its service role to clear the profile flag.
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
      and p.role = 'STUDENT'
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
