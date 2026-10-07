begin;

select plan(63);

-- All fixtures are synthetic and the transaction is rolled back at the end.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0400000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-rls-root@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0400000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-rls-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0400000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-rls-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0400000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-rls-unassigned@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0400000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-rls-student-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0400000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'qa-rls-student-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0400000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-RLS-ROOT', 'QA RLS ROOT', 'ACTIVE', false),
  ('f0400000-0000-0000-0000-000000000002', 'ADMIN', 'QA-RLS-ADMIN', 'QA RLS ADMIN', 'ACTIVE', false),
  ('f0400000-0000-0000-0000-000000000003', 'TEACHER', 'QA-RLS-TEACHER', 'QA RLS TEACHER', 'ACTIVE', false),
  ('f0400000-0000-0000-0000-000000000004', 'TEACHER', 'QA-RLS-UNASSIGNED', 'QA RLS UNASSIGNED', 'ACTIVE', false),
  ('f0400000-0000-0000-0000-000000000005', 'STUDENT', 'QA-RLS-STUDENT-A', 'QA RLS STUDENT A', 'ACTIVE', false),
  ('f0400000-0000-0000-0000-000000000006', 'STUDENT', 'QA-RLS-STUDENT-B', 'QA RLS STUDENT B', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0400000-0000-0000-0000-000000000101', 'f0400000-0000-0000-0000-000000000003', 'QA-RLS-T-1', 'TEACHER', 'QA RLS TEACHER', 'ACTIVE'),
  ('f0400000-0000-0000-0000-000000000102', 'f0400000-0000-0000-0000-000000000004', 'QA-RLS-T-2', 'TEACHER', 'QA RLS UNASSIGNED', 'ACTIVE');

insert into public.students (id, user_id, student_code, full_name, status) values
  ('f0400000-0000-0000-0000-000000000201', 'f0400000-0000-0000-0000-000000000005', 'QA-RLS-S-1', 'QA RLS STUDENT A', 'ACTIVE'),
  ('f0400000-0000-0000-0000-000000000202', 'f0400000-0000-0000-0000-000000000006', 'QA-RLS-S-2', 'QA RLS STUDENT B', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0400000-0000-0000-0000-000000000301', 'QA-RLS-SUBJECT', 'QA RLS SUBJECT', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0400000-0000-0000-0000-000000000302', 'QA-RLS-GRADE', 'QA RLS GRADE', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0400000-0000-0000-0000-000000000303', 'QA-RLS-CLASS', 'QA RLS CLASS', 'f0400000-0000-0000-0000-000000000301', 'f0400000-0000-0000-0000-000000000302', 'ACTIVE');

insert into public.class_memberships (class_id, student_id, start_date, status) values
  ('f0400000-0000-0000-0000-000000000303', 'f0400000-0000-0000-0000-000000000201', current_date, 'ACTIVE'),
  ('f0400000-0000-0000-0000-000000000303', 'f0400000-0000-0000-0000-000000000202', current_date, 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, status)
values ('f0400000-0000-0000-0000-000000000401', 'f0400000-0000-0000-0000-000000000303', 1, '17:30', '19:30', 'ACTIVE');
insert into public.class_schedule_staff (schedule_id, staff_id)
values ('f0400000-0000-0000-0000-000000000401', 'f0400000-0000-0000-0000-000000000101');

insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status)
values
  ('f0400000-0000-0000-0000-000000000501', 'f0400000-0000-0000-0000-000000000303', now() + interval '1 day', now() + interval '1 day 2 hours', 'SCHEDULED'),
  ('f0400000-0000-0000-0000-000000000502', 'f0400000-0000-0000-0000-000000000303', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 'COMPLETED');
insert into public.session_students (session_id, student_id) values
  ('f0400000-0000-0000-0000-000000000501', 'f0400000-0000-0000-0000-000000000201'),
  ('f0400000-0000-0000-0000-000000000501', 'f0400000-0000-0000-0000-000000000202'),
  ('f0400000-0000-0000-0000-000000000502', 'f0400000-0000-0000-0000-000000000201');
insert into public.session_staff (session_id, staff_id, assignment_role) values
  ('f0400000-0000-0000-0000-000000000501', 'f0400000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0400000-0000-0000-0000-000000000502', 'f0400000-0000-0000-0000-000000000101', 'TEACHER');
insert into public.student_attendances (session_id, student_id, status, homework_score, comment) values
  ('f0400000-0000-0000-0000-000000000501', 'f0400000-0000-0000-0000-000000000201', 'PRESENT', 8, 'QA scheduled attendance'),
  ('f0400000-0000-0000-0000-000000000501', 'f0400000-0000-0000-0000-000000000202', 'LATE', 7, 'QA peer attendance'),
  ('f0400000-0000-0000-0000-000000000502', 'f0400000-0000-0000-0000-000000000201', 'PRESENT', 9, 'QA completed attendance');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000001', true);
select lives_ok($$select count(*) from public.staff$$, 'ROOT can read staff without policy recursion');
select is((select count(*)::integer from public.staff), 2, 'ROOT can read all staff');
select is((select count(*)::integer from public.students), 2, 'ROOT can read all students');
select is((select count(*)::integer from public.classes), 1, 'ROOT can read classes');
select is((select count(*)::integer from public.class_memberships), 2, 'ROOT can read class memberships');
select is((select count(*)::integer from public.class_schedules), 1, 'ROOT can read class schedules');
select is((select count(*)::integer from public.class_schedule_staff), 1, 'ROOT can read schedule staff mappings');
select is((select count(*)::integer from public.sessions), 2, 'ROOT can read sessions');
select is((select count(*)::integer from public.session_students), 3, 'ROOT can read session rosters');
select is((select count(*)::integer from public.session_staff), 2, 'ROOT can read session staff');
select is((select count(*)::integer from public.student_attendances), 3, 'ROOT can read attendance');
select is((select count(*)::integer from public.classes c join public.class_schedules s on s.class_id = c.id join public.class_schedule_staff css on css.schedule_id = s.id join public.staff st on st.id = css.staff_id), 1, 'ROOT can load nested class schedule and teacher relations');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.staff), 2, 'ADMIN can read staff');
select is((select count(*)::integer from public.classes), 1, 'ADMIN can read classes');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000003', true);
select lives_ok($$select count(*) from public.classes c join public.class_schedules s on s.class_id = c.id join public.class_schedule_staff css on css.schedule_id = s.id join public.staff st on st.id = css.staff_id$$, 'assigned TEACHER can load nested class relations');
select is((select count(*)::integer from public.staff), 1, 'assigned TEACHER can read only own staff row');
select is((select count(*)::integer from public.classes), 1, 'assigned TEACHER can read assigned class');
select is((select count(*)::integer from public.class_memberships), 2, 'assigned TEACHER can read class roster');
select is((select count(*)::integer from public.sessions), 2, 'assigned TEACHER can read assigned sessions');
select is((select count(*)::integer from public.student_attendances), 3, 'assigned TEACHER can read assigned-session attendance');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.staff), 1, 'unassigned TEACHER can read only own staff row');
select is((select count(*)::integer from public.classes), 0, 'unassigned TEACHER cannot read an unassigned class');
select is((select count(*)::integer from public.sessions), 0, 'unassigned TEACHER cannot read another teacher sessions');
select is((select count(*)::integer from public.student_attendances), 0, 'unassigned TEACHER cannot read attendance');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000005', true);
select lives_ok($$select count(*) from public.sessions s left join public.session_students ss on ss.session_id = s.id left join public.session_staff sf on sf.session_id = s.id left join public.staff st on st.id = sf.staff_id$$, 'STUDENT can load own session, roster, and teacher relations');
select is((select count(*)::integer from public.students), 1, 'STUDENT A can read only own student profile');
select is((select count(*)::integer from public.staff), 1, 'STUDENT A can read own session teacher');
select is((select count(*)::integer from public.classes), 1, 'STUDENT A can read own class');
select is((select count(*)::integer from public.class_memberships), 1, 'STUDENT A can read only own class membership');
select is((select count(*)::integer from public.class_schedules), 1, 'STUDENT A can read own class schedule');
select is((select count(*)::integer from public.sessions), 2, 'STUDENT A can read own scheduled and completed sessions');
select is((select count(*)::integer from public.student_attendances), 1, 'STUDENT A sees only own completed-session attendance');

reset role;
update public.profiles set force_password_change = true where user_id = 'f0400000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.profiles where user_id = auth.uid()), 1, 'forced-change STUDENT can still read own profile');
select is((select count(*)::integer from public.students), 0, 'forced-change STUDENT cannot read student data');
select is((select count(*)::integer from public.classes), 0, 'forced-change STUDENT cannot read classes');
select is((select count(*)::integer from public.class_memberships), 0, 'forced-change STUDENT cannot read memberships');
select is((select count(*)::integer from public.sessions), 0, 'forced-change STUDENT cannot read sessions');
select is((select count(*)::integer from public.session_students), 0, 'forced-change STUDENT cannot read session rosters');
select is((select count(*)::integer from public.student_attendances), 0, 'forced-change STUDENT cannot read attendance');
select throws_ok($$select public.clear_force_password_change()$$, 'P0001', 'PASSWORD_CHANGE_REQUIRED', 'forced-change STUDENT cannot clear the gate through the RPC');

reset role;
update public.profiles set force_password_change = false where user_id = 'f0400000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.sessions), 2, 'STUDENT regains session access after password change clears the flag');

reset role;
update public.profiles set force_password_change = true where user_id = 'f0400000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.profiles where user_id = auth.uid()), 1, 'forced-change TEACHER can still read own profile');
select is((select count(*)::integer from public.staff), 0, 'forced-change TEACHER cannot read staff data');
select is((select count(*)::integer from public.classes), 0, 'forced-change TEACHER cannot read classes');
select is((select count(*)::integer from public.class_memberships), 0, 'forced-change TEACHER cannot read class memberships');
select is((select count(*)::integer from public.class_schedules), 0, 'forced-change TEACHER cannot read class schedules');
select is((select count(*)::integer from public.class_schedule_staff), 0, 'forced-change TEACHER cannot read schedule assignments');
select is((select count(*)::integer from public.sessions), 0, 'forced-change TEACHER cannot read sessions');
select is((select count(*)::integer from public.session_students), 0, 'forced-change TEACHER cannot read session rosters');
select is((select count(*)::integer from public.session_staff), 0, 'forced-change TEACHER cannot read session staff');
select is((select count(*)::integer from public.student_attendances), 0, 'forced-change TEACHER cannot read attendance');
select throws_ok($$select public.clear_force_password_change()$$, 'P0001', 'PASSWORD_CHANGE_REQUIRED', 'forced-change TEACHER cannot clear the gate through the RPC');

reset role;
update public.profiles set force_password_change = false where user_id = 'f0400000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.staff), 1, 'TEACHER regains own staff profile after password change clears the flag');
select is((select count(*)::integer from public.sessions), 2, 'TEACHER regains assigned sessions after password change clears the flag');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0400000-0000-0000-0000-000000000006', true);
select is((select count(*)::integer from public.students), 1, 'STUDENT B can read only own student profile');
select is((select count(*)::integer from public.classes), 1, 'STUDENT B can read own class');
select is((select count(*)::integer from public.class_memberships), 1, 'STUDENT B can read only own class membership');
select is((select count(*)::integer from public.class_schedules), 1, 'STUDENT B can read own class schedule');
select is((select count(*)::integer from public.sessions), 1, 'STUDENT B cannot read another student session');
select is((select count(*)::integer from public.session_students), 1, 'STUDENT B can read only own roster row');
select is((select count(*)::integer from public.session_staff), 1, 'STUDENT B can read teacher for own session');
select is((select count(*)::integer from public.student_attendances), 0, 'STUDENT B cannot read another student attendance or incomplete results');

reset role;
select ok(
  not has_function_privilege('anon', 'public.can_view_staff(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_view_class(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_view_class_membership(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_view_class_schedule(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_view_class_schedule_staff(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_view_session_staff(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_view_student_attendance(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.is_active_teacher()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.can_view_class(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.is_active_teacher()', 'EXECUTE')
  and has_function_privilege('service_role', 'public.can_view_class(uuid)', 'EXECUTE'),
  'anonymous access is revoked and required roles can execute access helpers'
);
select * from finish();
rollback;
