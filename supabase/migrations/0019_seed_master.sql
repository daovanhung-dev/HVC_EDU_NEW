insert into public.permission_groups(code, name) values
  ('STUDENT_MANAGEMENT', 'Quản trị học sinh'),
  ('CLASS_MANAGEMENT', 'Quản trị lớp học'),
  ('STAFF_MANAGEMENT', 'Quản trị nhân sự'),
  ('ACADEMIC_MANAGEMENT', 'Quản trị học tập'),
  ('TIMESHEET_MANAGEMENT', 'Quản trị chấm công'),
  ('PAYROLL_MANAGEMENT', 'Quản trị lương'),
  ('ACCOUNTING', 'Kế toán'),
  ('REPORTING', 'Báo cáo'),
  ('NOTIFICATIONS', 'Thông báo')
on conflict (code) do update set name = excluded.name;

insert into public.permissions(code, name) values
  ('STUDENTS_VIEW', 'Xem học sinh'), ('STUDENTS_MANAGE', 'Quản lý học sinh'),
  ('CLASS_VIEW', 'Xem lớp học'), ('CLASS_MANAGE', 'Quản lý lớp học'), ('CLASS_MONTH_MANAGE', 'Quản lý tháng vận hành'),
  ('STAFF_VIEW', 'Xem nhân sự'), ('STAFF_MANAGE', 'Quản lý nhân sự'),
  ('ACADEMIC_VIEW', 'Xem dữ liệu học tập'), ('ACADEMIC_MANAGE', 'Quản lý dữ liệu học tập'),
  ('TIMESHEET_VIEW', 'Xem chấm công'), ('TIMESHEET_APPROVE', 'Duyệt chấm công'),
  ('PAYROLL_VIEW', 'Xem bảng lương'), ('PAYROLL_MANAGE', 'Quản lý bảng lương'),
  ('ACCOUNTING_VIEW', 'Xem kế toán'), ('ACCOUNTING_MANAGE', 'Quản lý kế toán'),
  ('REPORTS_VIEW', 'Xem báo cáo'), ('REPORTS_EXPORT', 'Export báo cáo'),
  ('NOTIFICATIONS_MANAGE', 'Quản lý thông báo')
on conflict (code) do update set name = excluded.name;

insert into public.permission_group_permissions(permission_group_id, permission_id)
select pg.id, p.id from public.permission_groups pg cross join public.permissions p
where (pg.code = 'STUDENT_MANAGEMENT' and p.code in ('STUDENTS_VIEW','STUDENTS_MANAGE'))
   or (pg.code = 'CLASS_MANAGEMENT' and p.code in ('CLASS_VIEW','CLASS_MANAGE','CLASS_MONTH_MANAGE'))
   or (pg.code = 'STAFF_MANAGEMENT' and p.code in ('STAFF_VIEW','STAFF_MANAGE'))
   or (pg.code = 'ACADEMIC_MANAGEMENT' and p.code in ('ACADEMIC_VIEW','ACADEMIC_MANAGE'))
   or (pg.code = 'TIMESHEET_MANAGEMENT' and p.code in ('TIMESHEET_VIEW','TIMESHEET_APPROVE'))
   or (pg.code = 'PAYROLL_MANAGEMENT' and p.code in ('PAYROLL_VIEW','PAYROLL_MANAGE'))
   or (pg.code = 'ACCOUNTING' and p.code in ('ACCOUNTING_VIEW','ACCOUNTING_MANAGE'))
   or (pg.code = 'REPORTING' and p.code in ('REPORTS_VIEW','REPORTS_EXPORT'))
   or (pg.code = 'NOTIFICATIONS' and p.code = 'NOTIFICATIONS_MANAGE')
on conflict do nothing;

insert into public.accounting_categories(code, name, direction) values
  ('TUITION_INCOME', 'Học phí', 'INCOME'),
  ('OTHER_INCOME', 'Thu khác', 'INCOME'),
  ('PAYROLL_EXPENSE', 'Lương', 'EXPENSE'),
  ('RENT_EXPENSE', 'Thuê nhà', 'EXPENSE'),
  ('UTILITY_EXPENSE', 'Điện nước Internet', 'EXPENSE'),
  ('EQUIPMENT_EXPENSE', 'Thiết bị', 'EXPENSE'),
  ('MARKETING_EXPENSE', 'Marketing', 'EXPENSE'),
  ('OTHER_EXPENSE', 'Chi khác', 'EXPENSE')
on conflict (code) do update set name = excluded.name, direction = excluded.direction;

insert into public.subjects(code, name) values ('MATH', 'Toán'), ('LITERATURE', 'Văn'), ('ENGLISH', 'Tiếng Anh') on conflict (code) do nothing;
insert into public.grades(code, name) values ('GRADE_6', 'Khối 6'), ('GRADE_7', 'Khối 7'), ('GRADE_8', 'Khối 8'), ('GRADE_9', 'Khối 9'), ('GRADE_10', 'Khối 10'), ('GRADE_11', 'Khối 11'), ('GRADE_12', 'Khối 12') on conflict (code) do nothing;
