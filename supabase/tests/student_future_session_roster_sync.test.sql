begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0540000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-roster-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0540000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-roster-existing@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0540000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-roster-late-join@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0540000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-roster-later-join@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0540000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-roster-conflict@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0540000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-ROSTER-ADMIN', 'QA Roster Admin', 'ACTIVE', false),
  ('f0540000-0000-0000-0000-000000000002', 'STUDENT', 'QA-ROSTER-EXISTING', 'QA Roster Existing', 'ACTIVE', false),
  ('f0540000-0000-0000-0000-000000000003', 'STUDENT', 'QA-ROSTER-LATE-JOIN', 'QA Roster Late Join', 'ACTIVE', false),
  ('f0540000-0000-0000-0000-000000000004', 'STUDENT', 'QA-ROSTER-LATER-JOIN', 'QA Roster Later Join', 'ACTIVE', false),
  ('f0540000-0000-0000-0000-000000000005', 'STUDENT', 'QA-ROSTER-CONFLICT', 'QA Roster Conflict', 'ACTIVE', false);

insert into public.students (id, user_id, student_code, full_name, status) values
  ('f0540000-0000-0000-0000-000000000101', 'f0540000-0000-0000-0000-000000000002', 'QA-ROSTER-EXISTING', 'QA Roster Existing', 'ACTIVE'),
  ('f0540000-0000-0000-0000-000000000102', 'f0540000-0000-0000-0000-000000000003', 'QA-ROSTER-LATE-JOIN', 'QA Roster Late Join', 'ACTIVE'),
  ('f0540000-0000-0000-0000-000000000103', 'f0540000-0000-0000-0000-000000000004', 'QA-ROSTER-LATER-JOIN', 'QA Roster Later Join', 'ACTIVE'),
  ('f0540000-0000-0000-0000-000000000104', 'f0540000-0000-0000-0000-000000000005', 'QA-ROSTER-CONFLICT', 'QA Roster Conflict', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0540000-0000-0000-0000-000000000201', 'QA-ROSTER-SUBJECT', 'QA Roster Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0540000-0000-0000-0000-000000000202', 'QA-ROSTER-GRADE', 'QA Roster Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status) values
  ('f0540000-0000-0000-0000-000000000301', 'QA-ROSTER-CLASS', 'QA Roster Class', 'f0540000-0000-0000-0000-000000000201', 'f0540000-0000-0000-0000-000000000202', 'ACTIVE'),
  ('f0540000-0000-0000-0000-000000000302', 'QA-ROSTER-CONFLICT-CLASS', 'QA Roster Conflict Class', 'f0540000-0000-0000-0000-000000000201', 'f0540000-0000-0000-0000-000000000202', 'ACTIVE');

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status)
values ('f0540000-0000-0000-0000-000000000401', 'f0540000-0000-0000-0000-000000000001', 'QA-ROSTER-TEACHER', 'TEACHER', 'QA Roster Teacher', 'ACTIVE');

select set_config(
  'qa.roster_month',
  date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month')::date::text,
  true
);

insert into public.class_memberships (class_id, student_id, start_date, status) values
  ('f0540000-0000-0000-0000-000000000301', 'f0540000-0000-0000-0000-000000000101', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 30, 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at, reviewed_by)
values (
  'f0540000-0000-0000-0000-000000000501',
  'f0540000-0000-0000-0000-000000000301',
  extract(isodow from (current_setting('qa.roster_month')::date + 1))::integer,
  '16:00', '17:00', 'QA-RECURRENT-ROOM', 'ACTIVE', now(), 'f0540000-0000-0000-0000-000000000001'
);
insert into public.class_schedule_staff (schedule_id, staff_id)
values ('f0540000-0000-0000-0000-000000000501', 'f0540000-0000-0000-0000-000000000401');
insert into public.class_schedule_month_overrides (month_start, created_by)
values (current_setting('qa.roster_month')::date, 'f0540000-0000-0000-0000-000000000001');

insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, manual_schedule, room) values
  ('f0540000-0000-0000-0000-000000000601', 'f0540000-0000-0000-0000-000000000301', (current_setting('qa.roster_month')::date + time '08:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + time '09:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000602', 'f0540000-0000-0000-0000-000000000301', (current_setting('qa.roster_month')::date + 1 + time '08:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + 1 + time '09:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000603', 'f0540000-0000-0000-0000-000000000301', (current_setting('qa.roster_month')::date + 2 + time '08:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + 2 + time '09:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000604', 'f0540000-0000-0000-0000-000000000301', (current_setting('qa.roster_month')::date + 3 + time '08:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + 3 + time '09:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000605', 'f0540000-0000-0000-0000-000000000301', (current_setting('qa.roster_month')::date + 3 + time '10:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + 3 + time '11:00') at time zone 'Asia/Ho_Chi_Minh', 'IN_PROGRESS', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000606', 'f0540000-0000-0000-0000-000000000301', (current_setting('qa.roster_month')::date + 3 + time '12:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + 3 + time '13:00') at time zone 'Asia/Ho_Chi_Minh', 'COMPLETED', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000607', 'f0540000-0000-0000-0000-000000000301', (current_setting('qa.roster_month')::date + 3 + time '14:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + 3 + time '15:00') at time zone 'Asia/Ho_Chi_Minh', 'CANCELLED', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000608', 'f0540000-0000-0000-0000-000000000301', now() - interval '2 days', now() - interval '1 day', 'SCHEDULED', true, 'QA-MANUAL-ROOM'),
  ('f0540000-0000-0000-0000-000000000609', 'f0540000-0000-0000-0000-000000000302', (current_setting('qa.roster_month')::date + 3 + time '08:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.roster_month')::date + 3 + time '09:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', true, 'QA-CONFLICT-ROOM');

insert into public.session_students (session_id, student_id, assessment_snapshot) values
  ('f0540000-0000-0000-0000-000000000602', 'f0540000-0000-0000-0000-000000000101', '{"QA- existing": true}'::jsonb),
  ('f0540000-0000-0000-0000-000000000606', 'f0540000-0000-0000-0000-000000000101', '{"QA- completed": true}'::jsonb),
  ('f0540000-0000-0000-0000-000000000609', 'f0540000-0000-0000-0000-000000000104', '{"QA- conflict": true}'::jsonb);
insert into public.student_attendances (session_id, student_id, status, comment)
values ('f0540000-0000-0000-0000-000000000606', 'f0540000-0000-0000-0000-000000000101', 'PRESENT', 'QA- keep history');

-- Memberships are added only after the future manual sessions already exist.
insert into public.class_memberships (class_id, student_id, start_date, end_date, status) values
  ('f0540000-0000-0000-0000-000000000301', 'f0540000-0000-0000-0000-000000000102', current_setting('qa.roster_month')::date + 1, current_setting('qa.roster_month')::date + 2, 'ACTIVE'),
  ('f0540000-0000-0000-0000-000000000301', 'f0540000-0000-0000-0000-000000000103', current_setting('qa.roster_month')::date + 3, null, 'ACTIVE'),
  ('f0540000-0000-0000-0000-000000000301', 'f0540000-0000-0000-0000-000000000104', current_setting('qa.roster_month')::date + 3, null, 'ACTIVE');

select ok(
  not has_function_privilege('authenticated', 'public.sync_future_manual_session_student_rosters(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.sync_future_manual_session_student_rosters(uuid)', 'EXECUTE'),
  'manual roster sync helper is not directly executable by app roles'
);
select ok(
  has_function_privilege('authenticated', 'public.generate_upcoming_sessions(integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.generate_upcoming_sessions(integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.generate_upcoming_sessions(integer)', 'EXECUTE'),
  'generator keeps its established grants'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0540000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.generate_upcoming_sessions(90) $$,
  'P0001', 'FORBIDDEN',
  'student cannot invoke the privileged session generator'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0540000-0000-0000-0000-000000000001', true);
select set_config('qa.roster_generation', public.generate_upcoming_sessions(90)::text, true);
reset role;

select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000601' and student_id = 'f0540000-0000-0000-0000-000000000102'),
  0,
  'membership beginning after the first occurrence is not applied retroactively'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000602' and student_id = 'f0540000-0000-0000-0000-000000000102'),
  1,
  'new member is added to an existing scheduled month-template occurrence'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000603' and student_id = 'f0540000-0000-0000-0000-000000000102'),
  1,
  'membership end date includes the final effective occurrence'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000603' and student_id = 'f0540000-0000-0000-0000-000000000103'),
  0,
  'later member is not added before its membership start date'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000604' and student_id = 'f0540000-0000-0000-0000-000000000103'),
  1,
  'later member is added on the first effective occurrence'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000604' and student_id = 'f0540000-0000-0000-0000-000000000102'),
  0,
  'membership end date excludes later occurrences'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000604' and student_id = 'f0540000-0000-0000-0000-000000000104'),
  0,
  'overlapping enrollment is not added to a conflicting session'
);
select is(
  (select status::text from public.sessions where id = 'f0540000-0000-0000-0000-000000000604'),
  'SCHEDULED',
  'roster conflict leaves the existing session status unchanged'
);
select ok(
  (current_setting('qa.roster_generation')::jsonb ->> 'manual_roster_conflicts')::integer >= 1,
  'generator reports blocked manual roster additions'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000605' and student_id = 'f0540000-0000-0000-0000-000000000103'),
  0,
  'in-progress roster is not changed'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000606' and student_id = 'f0540000-0000-0000-0000-000000000103'),
  0,
  'completed roster is not changed'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000607' and student_id = 'f0540000-0000-0000-0000-000000000103'),
  0,
  'cancelled roster is not changed'
);
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000608' and student_id = 'f0540000-0000-0000-0000-000000000101'),
  0,
  'a past scheduled session is not changed'
);
select is(
  (select count(*)::integer from public.student_attendances where session_id = 'f0540000-0000-0000-0000-000000000606' and student_id = 'f0540000-0000-0000-0000-000000000101' and status = 'PRESENT' and comment = 'QA- keep history'),
  1,
  'existing attendance is preserved'
);
select is(
  (select assessment_snapshot from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000606' and student_id = 'f0540000-0000-0000-0000-000000000101'),
  '{"QA- completed": true}'::jsonb,
  'existing completed-session assessment snapshot is preserved'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0540000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::integer from public.sessions where id in ('f0540000-0000-0000-0000-000000000602', 'f0540000-0000-0000-0000-000000000603')),
  2,
  'student RLS exposes only sessions whose synchronized roster contains the student'
);
select is(
  (select count(*)::integer from public.sessions where id = 'f0540000-0000-0000-0000-000000000609'),
  0,
  'student RLS does not expose another student’s conflicting session'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0540000-0000-0000-0000-000000000001', true);
select lives_ok($$ select public.generate_upcoming_sessions(90) $$, 'repeated generation remains safe and idempotent');
reset role;
select is(
  (select count(*)::integer from public.session_students where session_id = 'f0540000-0000-0000-0000-000000000602' and student_id = 'f0540000-0000-0000-0000-000000000102'),
  1,
  'repeated synchronization does not duplicate a roster row'
);

select * from finish();
rollback;
