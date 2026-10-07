begin;

select plan(26);

-- Fixtures are synthetic and the entire test rolls back.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0420000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-time-root@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0420000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-time-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0420000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-time-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0420000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-time-other@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0420000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-time-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0420000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-TIME-ROOT', 'QA Time Root', 'ACTIVE', false),
  ('f0420000-0000-0000-0000-000000000002', 'ADMIN', 'QA-TIME-ADMIN', 'QA Time Admin', 'ACTIVE', false),
  ('f0420000-0000-0000-0000-000000000003', 'TEACHER', 'QA-TIME-TEACHER', 'QA Time Teacher', 'ACTIVE', false),
  ('f0420000-0000-0000-0000-000000000004', 'TEACHER', 'QA-TIME-OTHER', 'QA Time Other', 'ACTIVE', false),
  ('f0420000-0000-0000-0000-000000000005', 'STUDENT', 'QA-TIME-STUDENT', 'QA Time Student', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000003', 'QA-TIME-T-1', 'TEACHER', 'QA Time Teacher', 'ACTIVE'),
  ('f0420000-0000-0000-0000-000000000102', 'f0420000-0000-0000-0000-000000000004', 'QA-TIME-T-2', 'TEACHER', 'QA Time Other', 'ACTIVE');
insert into public.students (id, user_id, student_code, full_name, status)
values ('f0420000-0000-0000-0000-000000000201', 'f0420000-0000-0000-0000-000000000005', 'QA-TIME-S-1', 'QA Time Student', 'ACTIVE');
insert into public.subjects (id, code, name, status)
values ('f0420000-0000-0000-0000-000000000301', 'QA-TIME-SUB', 'QA Time Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0420000-0000-0000-0000-000000000302', 'QA-TIME-GRADE', 'QA Time Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0420000-0000-0000-0000-000000000303', 'QA-TIME-CLASS', 'QA Time Class', 'f0420000-0000-0000-0000-000000000301', 'f0420000-0000-0000-0000-000000000302', 'ACTIVE');
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status) values
  ('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000303', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'COMPLETED'),
  ('f0420000-0000-0000-0000-000000000402', 'f0420000-0000-0000-0000-000000000303', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 'COMPLETED'),
  ('f0420000-0000-0000-0000-000000000403', 'f0420000-0000-0000-0000-000000000303', now() + interval '1 day', now() + interval '1 day 2 hours', 'SCHEDULED');
insert into public.session_staff (session_id, staff_id, assignment_role) values
  ('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0420000-0000-0000-0000-000000000402', 'f0420000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0420000-0000-0000-0000-000000000403', 'f0420000-0000-0000-0000-000000000101', 'TEACHER');

select ok(not has_function_privilege('anon', 'public.submit_timesheet(uuid,uuid,uuid,text)', 'EXECUTE'), 'anon cannot submit timesheets');
select ok(not has_function_privilege('anon', 'public.approve_timesheet(uuid,uuid,boolean,text)', 'EXECUTE'), 'anon cannot review timesheets');
select ok(not has_function_privilege('authenticated', 'public.submit_timesheet(uuid,uuid,uuid,text)', 'EXECUTE'), 'authenticated users cannot call the service-only submit RPC');
select ok(not has_function_privilege('authenticated', 'public.approve_timesheet(uuid,uuid,boolean,text)', 'EXECUTE'), 'authenticated users cannot call the service-only review RPC');
select ok(not has_table_privilege('anon', 'public.timesheets', 'SELECT'), 'anon cannot read timesheets');
select ok(not has_table_privilege('authenticated', 'public.timesheets', 'INSERT'), 'app users cannot insert directly into timesheets');
select ok(not has_table_privilege('authenticated', 'public.timesheets', 'UPDATE'), 'app users cannot update timesheets directly');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.submit_timesheet('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000003', 'QA completed session');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0420000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.timesheets), 1, 'Admin can read the review queue');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0420000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.timesheets), 1, 'teacher can read their own timesheet');
select throws_ok($$select public.submit_timesheet('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000102', 'f0420000-0000-0000-0000-000000000004', null)$$, '42501', 'permission denied for function submit_timesheet', 'authenticated teacher cannot invoke submit RPC directly');

reset role;
update public.profiles set force_password_change = true where user_id = 'f0420000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0420000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.timesheets), 0, 'forced-change TEACHER cannot read timesheets');
select throws_ok($$select public.clear_force_password_change()$$, 'P0001', 'PASSWORD_CHANGE_REQUIRED', 'forced-change TEACHER cannot clear the flag directly');

reset role;
update public.profiles set force_password_change = false where user_id = 'f0420000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0420000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.timesheets), 1, 'TEACHER regains timesheet access after password change clears the flag');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0420000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.timesheets), 0, 'other teacher cannot read another teacher timesheet');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0420000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.timesheets), 0, 'student cannot read teacher timesheets');
reset role;

set local role service_role;
select throws_ok($$select public.submit_timesheet('f0420000-0000-0000-0000-000000000403', 'f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000003', null)$$, 'P0001', 'SESSION_NOT_COMPLETED', 'only completed sessions can be submitted');
select throws_ok($$select public.submit_timesheet('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000102', 'f0420000-0000-0000-0000-000000000004', null)$$, 'P0001', 'SESSION_STAFF_REQUIRED', 'unassigned teacher cannot submit for a session');
select throws_ok($$select public.submit_timesheet('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000004', null)$$, 'P0001', 'FORBIDDEN', 'teacher cannot claim another teacher staff profile');
select throws_ok($$select public.submit_timesheet('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000003', null)$$, 'P0001', 'TIMESHEET_ALREADY_SUBMITTED', 'duplicate pending submission is rejected');
select public.submit_timesheet('f0420000-0000-0000-0000-000000000402', 'f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000003', null);
select throws_ok($$select public.approve_timesheet((select id from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000402'), 'f0420000-0000-0000-0000-000000000003', true, null)$$, 'P0001', 'FORBIDDEN', 'teacher cannot review timesheet');
select throws_ok($$select public.approve_timesheet((select id from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000402'), 'f0420000-0000-0000-0000-000000000002', false, '  ')$$, 'P0001', 'REJECTION_REASON_REQUIRED', 'rejection requires a reason');
select public.approve_timesheet((select id from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000401'), 'f0420000-0000-0000-0000-000000000002', true, null);
select is((select status::text from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000401'), 'APPROVED', 'Admin approval marks the request approved');
select throws_ok($$select public.submit_timesheet('f0420000-0000-0000-0000-000000000401', 'f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000003', null)$$, 'P0001', 'TIMESHEET_ALREADY_SUBMITTED', 'an approved timesheet cannot be resubmitted');
select public.approve_timesheet((select id from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000402'), 'f0420000-0000-0000-0000-000000000002', false, 'QA reason');
select is((select status::text from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000402'), 'REJECTED', 'Admin rejection marks the request rejected');
select public.submit_timesheet('f0420000-0000-0000-0000-000000000402', 'f0420000-0000-0000-0000-000000000101', 'f0420000-0000-0000-0000-000000000003', 'QA resubmission');
select is((select status::text from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000402'), 'PENDING', 'teacher can resubmit after rejection');
select is((select rejection_reason from public.timesheets where session_id = 'f0420000-0000-0000-0000-000000000402'), null, 'resubmission clears the old rejection reason');

select * from finish();
rollback;
