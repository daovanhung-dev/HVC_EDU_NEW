drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select using (
  public.is_root() or public.has_permission('ACADEMIC_VIEW') or public.is_session_staff(id)
  or exists (select 1 from public.session_students ss where ss.session_id = sessions.id and public.is_student_owner(ss.student_id))
);
