do $$
declare t text;
begin
  foreach t in array array[
    'profiles','permission_groups','permissions','permission_group_permissions','admin_permission_groups',
    'students','staff','subjects','grades','classes','class_memberships','class_months','class_month_students',
    'class_month_staff','class_month_schedules','sessions','session_students','session_staff','staff_replacements',
    'student_attendances','timesheets','tuition_records','payroll_periods','payroll_items','salary_adjustments',
    'accounting_categories','accounting_transactions','notifications','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

create policy profiles_select on public.profiles for select using (
  user_id = auth.uid() or public.is_root() or (public.current_role() = 'ADMIN' and public.has_permission('STAFF_VIEW'))
);

create policy permission_groups_select on public.permission_groups for select using (public.is_root() or public.current_role() = 'ADMIN');
create policy permissions_select on public.permissions for select using (public.is_root() or public.current_role() = 'ADMIN');
create policy group_permissions_select on public.permission_group_permissions for select using (public.is_root() or public.current_role() = 'ADMIN');
create policy admin_groups_select on public.admin_permission_groups for select using (user_id = auth.uid() or public.is_root() or (public.current_role() = 'ADMIN' and public.has_permission('STAFF_VIEW')));

create policy students_select on public.students for select using (
  public.is_student_owner(id) or public.is_root() or public.has_permission('STUDENTS_VIEW')
  or exists (select 1 from public.session_students ss join public.sessions s on s.id = ss.session_id where ss.student_id = students.id and public.is_session_staff(s.id))
);
create policy students_insert on public.students for insert with check (public.is_root() or public.has_permission('STUDENTS_MANAGE'));
create policy students_update on public.students for update using (public.is_root() or public.has_permission('STUDENTS_MANAGE')) with check (public.is_root() or public.has_permission('STUDENTS_MANAGE'));

create policy staff_select on public.staff for select using (
  user_id = auth.uid() or public.is_root() or public.has_permission('STAFF_VIEW') or public.is_session_staff((select session_id from public.session_staff where staff_id = staff.id limit 1))
);
create policy staff_insert on public.staff for insert with check (public.is_root() or public.has_permission('STAFF_MANAGE'));
create policy staff_update on public.staff for update using (public.is_root() or public.has_permission('STAFF_MANAGE')) with check (public.is_root() or public.has_permission('STAFF_MANAGE'));

create policy subjects_select on public.subjects for select using (auth.uid() is not null);
create policy grades_select on public.grades for select using (auth.uid() is not null);
create policy subjects_manage on public.subjects for all using (public.is_root() or public.has_permission('CLASS_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MANAGE'));
create policy grades_manage on public.grades for all using (public.is_root() or public.has_permission('CLASS_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MANAGE'));

create policy classes_select on public.classes for select using (
  public.is_root() or public.has_permission('CLASS_VIEW')
  or exists (select 1 from public.class_months cm join public.class_month_staff cms on cms.class_month_id = cm.id join public.staff s on s.id = cms.staff_id where cm.class_id = classes.id and s.user_id = auth.uid())
  or exists (select 1 from public.class_months cm join public.class_month_students cms on cms.class_month_id = cm.id where cm.class_id = classes.id and public.is_student_owner(cms.student_id))
);
create policy classes_manage on public.classes for all using (public.is_root() or public.has_permission('CLASS_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MANAGE'));

create policy memberships_select on public.class_memberships for select using (
  public.is_root() or public.has_permission('STUDENTS_VIEW') or public.is_student_owner(student_id)
);
create policy memberships_manage on public.class_memberships for all using (public.is_root() or public.has_permission('CLASS_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MANAGE'));

create policy class_months_select on public.class_months for select using (
  public.is_root() or public.has_permission('CLASS_VIEW')
  or exists (select 1 from public.class_month_students cms where cms.class_month_id = class_months.id and public.is_student_owner(cms.student_id))
  or exists (select 1 from public.class_month_staff cms join public.staff s on s.id = cms.staff_id where cms.class_month_id = class_months.id and s.user_id = auth.uid())
);
create policy class_months_manage on public.class_months for all using (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE'));

create policy class_month_students_select on public.class_month_students for select using (
  public.is_root() or public.has_permission('CLASS_VIEW') or public.is_student_owner(student_id)
  or exists (select 1 from public.class_month_staff cms join public.staff s on s.id = cms.staff_id where cms.class_month_id = class_month_students.class_month_id and s.user_id = auth.uid())
);
create policy class_month_students_manage on public.class_month_students for all using (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE'));
create policy class_month_staff_select on public.class_month_staff for select using (public.is_root() or public.has_permission('CLASS_VIEW') or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
create policy class_month_staff_manage on public.class_month_staff for all using (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE'));
create policy class_month_schedules_select on public.class_month_schedules for select using (public.is_root() or public.has_permission('CLASS_VIEW') or exists (select 1 from public.class_month_staff cms join public.staff s on s.id = cms.staff_id where cms.class_month_id = class_month_schedules.class_month_id and s.user_id = auth.uid()));
create policy class_month_schedules_manage on public.class_month_schedules for all using (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE')) with check (public.is_root() or public.has_permission('CLASS_MONTH_MANAGE'));

create policy sessions_select on public.sessions for select using (
  public.is_root() or public.has_permission('ACADEMIC_VIEW') or public.is_session_staff(id)
  or (status = 'COMPLETED' and exists (select 1 from public.session_students ss where ss.session_id = sessions.id and public.is_student_owner(ss.student_id)))
);
create policy sessions_update_staff on public.sessions for update using (public.is_session_staff(id) and status = 'IN_PROGRESS') with check (public.is_session_staff(id) and status = 'IN_PROGRESS');
create policy session_students_select on public.session_students for select using (public.is_root() or public.has_permission('ACADEMIC_VIEW') or public.is_session_staff(session_id) or (exists (select 1 from public.sessions s where s.id = session_id and s.status = 'COMPLETED') and public.is_student_owner(student_id)));
create policy session_staff_select on public.session_staff for select using (public.is_root() or public.has_permission('ACADEMIC_VIEW') or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()) or public.is_session_staff(session_id));
create policy staff_replacements_select on public.staff_replacements for select using (public.is_root() or public.has_permission('ACADEMIC_VIEW') or exists (select 1 from public.session_staff ss join public.staff s on s.id = ss.staff_id where ss.session_id = staff_replacements.session_id and s.user_id = auth.uid()));

create policy attendances_select on public.student_attendances for select using (
  public.is_root() or public.has_permission('ACADEMIC_VIEW') or public.is_session_staff(session_id)
  or (exists (select 1 from public.sessions s where s.id = session_id and s.status = 'COMPLETED') and public.is_student_owner(student_id))
);
create policy attendances_insert on public.student_attendances for insert with check (public.is_session_staff(session_id) and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'IN_PROGRESS'));
create policy attendances_update on public.student_attendances for update using (public.is_session_staff(session_id) and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'IN_PROGRESS')) with check (public.is_session_staff(session_id) and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'IN_PROGRESS'));

create policy timesheets_select on public.timesheets for select using (public.is_root() or public.has_permission('TIMESHEET_VIEW') or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
create policy timesheets_insert on public.timesheets for insert with check (exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()) and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'COMPLETED'));
create policy timesheets_update on public.timesheets for update using (exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()) and status = 'REJECTED') with check (exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));

create policy tuition_select on public.tuition_records for select using (public.is_root() or public.has_permission('ACCOUNTING_VIEW') or public.is_student_owner(student_id));
create policy payroll_periods_select on public.payroll_periods for select using (public.is_root() or public.has_permission('PAYROLL_VIEW') or exists (select 1 from public.payroll_items pi join public.staff s on s.id = pi.staff_id where pi.payroll_period_id = payroll_periods.id and s.user_id = auth.uid()));
create policy payroll_items_select on public.payroll_items for select using (public.is_root() or public.has_permission('PAYROLL_VIEW') or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
create policy adjustments_select on public.salary_adjustments for select using (public.is_root() or public.has_permission('PAYROLL_VIEW') or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));

create policy categories_select on public.accounting_categories for select using (public.is_root() or public.has_permission('ACCOUNTING_VIEW'));
create policy transactions_select on public.accounting_transactions for select using (public.is_root() or public.has_permission('ACCOUNTING_VIEW') or public.has_permission('REPORTS_VIEW'));

create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_select on public.audit_logs for select using (public.is_root() or public.has_permission('REPORTS_VIEW'));
