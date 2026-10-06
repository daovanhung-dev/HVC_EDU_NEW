begin;

select plan(19);

-- Synthetic fixtures only; the transaction rolls back after the test.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0430000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-teacher-limit-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0430000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-teacher-limit-1@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0430000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-teacher-limit-2@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0430000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-teacher-limit-3@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0430000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-teacher-limit-4@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0430000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'qa-teacher-limit-5@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0430000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'qa-teacher-limit-6@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0430000-0000-0000-0000-000000000001', 'ADMIN', 'QA-TEACHER-LIMIT-ADMIN', 'QA Teacher Limit Admin', 'ACTIVE', false),
  ('f0430000-0000-0000-0000-000000000002', 'TEACHER', 'QA-TEACHER-LIMIT-1', 'QA Teacher Limit 1', 'ACTIVE', false),
  ('f0430000-0000-0000-0000-000000000003', 'TEACHER', 'QA-TEACHER-LIMIT-2', 'QA Teacher Limit 2', 'ACTIVE', false),
  ('f0430000-0000-0000-0000-000000000004', 'TEACHER', 'QA-TEACHER-LIMIT-3', 'QA Teacher Limit 3', 'ACTIVE', false),
  ('f0430000-0000-0000-0000-000000000005', 'TEACHER', 'QA-TEACHER-LIMIT-4', 'QA Teacher Limit 4', 'ACTIVE', false),
  ('f0430000-0000-0000-0000-000000000006', 'TEACHER', 'QA-TEACHER-LIMIT-5', 'QA Teacher Limit 5', 'ACTIVE', false),
  ('f0430000-0000-0000-0000-000000000007', 'TEACHER', 'QA-TEACHER-LIMIT-6', 'QA Teacher Limit 6', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0430000-0000-0000-0000-000000000101', 'f0430000-0000-0000-0000-000000000002', 'QA-LIMIT-T-1', 'TEACHER', 'QA Teacher 1', 'ACTIVE'),
  ('f0430000-0000-0000-0000-000000000102', 'f0430000-0000-0000-0000-000000000003', 'QA-LIMIT-T-2', 'TEACHER', 'QA Teacher 2', 'ACTIVE'),
  ('f0430000-0000-0000-0000-000000000103', 'f0430000-0000-0000-0000-000000000004', 'QA-LIMIT-T-3', 'TEACHER', 'QA Teacher 3', 'ACTIVE'),
  ('f0430000-0000-0000-0000-000000000104', 'f0430000-0000-0000-0000-000000000005', 'QA-LIMIT-T-4', 'TEACHER', 'QA Teacher 4', 'ACTIVE'),
  ('f0430000-0000-0000-0000-000000000105', 'f0430000-0000-0000-0000-000000000006', 'QA-LIMIT-T-5', 'TEACHER', 'QA Teacher 5', 'ACTIVE'),
  ('f0430000-0000-0000-0000-000000000106', 'f0430000-0000-0000-0000-000000000007', 'QA-LIMIT-T-6', 'TEACHER', 'QA Teacher 6', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0430000-0000-0000-0000-000000000301', 'QA-LIMIT-SUBJECT', 'QA Limit Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0430000-0000-0000-0000-000000000302', 'QA-LIMIT-GRADE', 'QA Limit Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status) values
  ('f0430000-0000-0000-0000-000000000303', 'QA-LIMIT-CLASS-A', 'QA Limit Class A', 'f0430000-0000-0000-0000-000000000301', 'f0430000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0430000-0000-0000-0000-000000000304', 'QA-LIMIT-CLASS-B', 'QA Limit Class B', 'f0430000-0000-0000-0000-000000000301', 'f0430000-0000-0000-0000-000000000302', 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, status) values
  ('f0430000-0000-0000-0000-000000000401', 'f0430000-0000-0000-0000-000000000303', 1, '08:00', '09:00', 'INACTIVE'),
  ('f0430000-0000-0000-0000-000000000402', 'f0430000-0000-0000-0000-000000000303', 2, '08:00', '09:00', 'INACTIVE'),
  ('f0430000-0000-0000-0000-000000000403', 'f0430000-0000-0000-0000-000000000303', 3, '08:00', '09:00', 'ARCHIVED'),
  ('f0430000-0000-0000-0000-000000000404', 'f0430000-0000-0000-0000-000000000304', 1, '08:00', '09:00', 'INACTIVE');

insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status) values
  ('f0430000-0000-0000-0000-000000000501', 'f0430000-0000-0000-0000-000000000303', now() + interval '10 days', now() + interval '10 days 2 hours', 'SCHEDULED'),
  ('f0430000-0000-0000-0000-000000000502', 'f0430000-0000-0000-0000-000000000303', now() + interval '11 days', now() + interval '11 days 2 hours', 'SCHEDULED'),
  ('f0430000-0000-0000-0000-000000000503', 'f0430000-0000-0000-0000-000000000303', now() - interval '10 days', now() - interval '10 days' + interval '2 hours', 'COMPLETED'),
  ('f0430000-0000-0000-0000-000000000504', 'f0430000-0000-0000-0000-000000000303', now() - interval '11 days', now() - interval '11 days' + interval '2 hours', 'CANCELLED');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0430000-0000-0000-0000-000000000001', true);

select lives_ok($$
  insert into public.class_schedule_staff (schedule_id, staff_id) values
    ('f0430000-0000-0000-0000-000000000401', 'f0430000-0000-0000-0000-000000000101'),
    ('f0430000-0000-0000-0000-000000000401', 'f0430000-0000-0000-0000-000000000102'),
    ('f0430000-0000-0000-0000-000000000401', 'f0430000-0000-0000-0000-000000000103'),
    ('f0430000-0000-0000-0000-000000000402', 'f0430000-0000-0000-0000-000000000104'),
    ('f0430000-0000-0000-0000-000000000402', 'f0430000-0000-0000-0000-000000000105')
$$, 'five distinct teachers can be assigned across recurring schedules');

reset role;
select is((select count(*)::integer from public.class_teacher_assignments('f0430000-0000-0000-0000-000000000303')), 5, 'the class count is distinct across schedules');

select lives_ok($$insert into public.session_staff (session_id, staff_id, assignment_role) values ('f0430000-0000-0000-0000-000000000501', 'f0430000-0000-0000-0000-000000000105', 'TEACHER')$$,
  'the same teacher can also be assigned to a session without increasing the class count');
select is((select count(*)::integer from public.class_teacher_assignments('f0430000-0000-0000-0000-000000000303')), 5, 'duplicate schedule/session assignment is counted once');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0430000-0000-0000-0000-000000000001', true);
select throws_ok($$insert into public.class_schedule_staff (schedule_id, staff_id) values ('f0430000-0000-0000-0000-000000000402', 'f0430000-0000-0000-0000-000000000106')$$,
  'P0001', 'CLASS_TEACHER_LIMIT', 'a sixth distinct recurring teacher is rejected');
reset role;
select throws_ok($$insert into public.session_staff (session_id, staff_id, assignment_role) values ('f0430000-0000-0000-0000-000000000502', 'f0430000-0000-0000-0000-000000000106', 'TEACHER')$$,
  'P0001', 'CLASS_TEACHER_LIMIT', 'a sixth distinct session teacher is rejected');
select lives_ok($$insert into public.session_staff (session_id, staff_id, assignment_role) values
  ('f0430000-0000-0000-0000-000000000503', 'f0430000-0000-0000-0000-000000000106', 'TEACHER'),
  ('f0430000-0000-0000-0000-000000000504', 'f0430000-0000-0000-0000-000000000106', 'TEACHER')$$,
  'completed and cancelled sessions do not consume teacher slots');
select is((select count(*)::integer from public.class_teacher_assignments('f0430000-0000-0000-0000-000000000303')), 5, 'terminal sessions and their assignments are excluded');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0430000-0000-0000-0000-000000000001', true);
select lives_ok($$insert into public.class_schedule_staff (schedule_id, staff_id) values ('f0430000-0000-0000-0000-000000000403', 'f0430000-0000-0000-0000-000000000106')$$,
  'an assignment on an archived schedule does not consume a teacher slot');
select throws_ok($$update public.class_schedules set status = 'INACTIVE' where id = 'f0430000-0000-0000-0000-000000000403'$$,
  'P0001', 'CLASS_TEACHER_LIMIT', 'reactivating an archived schedule cannot add a sixth teacher');
select lives_ok($$insert into public.class_schedule_staff (schedule_id, staff_id) values ('f0430000-0000-0000-0000-000000000404', 'f0430000-0000-0000-0000-000000000106')$$,
  'teacher limits are independent for another class');
reset role;
select throws_ok($$update public.sessions set status = 'SCHEDULED' where id = 'f0430000-0000-0000-0000-000000000503'$$,
  'P0001', 'CLASS_TEACHER_LIMIT', 'reactivating a terminal session cannot add a sixth teacher');

select lives_ok($$update public.sessions set status = 'CANCELLED' where id = 'f0430000-0000-0000-0000-000000000501'$$,
  'a scheduled duplicate assignment can be cancelled');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0430000-0000-0000-0000-000000000001', true);
select lives_ok($$delete from public.class_schedule_staff where schedule_id = 'f0430000-0000-0000-0000-000000000402' and staff_id = 'f0430000-0000-0000-0000-000000000105'$$,
  'an existing teacher assignment can be removed');
reset role;
select is((select count(*)::integer from public.class_teacher_assignments('f0430000-0000-0000-0000-000000000303')), 4, 'removing an assignment frees a class slot');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0430000-0000-0000-0000-000000000001', true);
select lives_ok($$insert into public.class_schedule_staff (schedule_id, staff_id) values ('f0430000-0000-0000-0000-000000000402', 'f0430000-0000-0000-0000-000000000106')$$,
  'a new teacher can be assigned after a slot is freed');
select lives_ok($$update public.class_schedules set status = 'INACTIVE' where id = 'f0430000-0000-0000-0000-000000000403'$$,
  'an archived schedule can be restored when its teacher is already counted');
reset role;
select is((select count(*)::integer from public.class_teacher_assignments('f0430000-0000-0000-0000-000000000303')), 5, 'restoring a schedule with an already-counted teacher does not duplicate the count');
select ok(
  not has_function_privilege('anon', 'public.class_teacher_assignments(uuid,uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.class_teacher_assignments(uuid,uuid,uuid,uuid)', 'EXECUTE'),
  'the internal teacher assignment helper is not exposed to app roles'
);

select * from finish();
rollback;
