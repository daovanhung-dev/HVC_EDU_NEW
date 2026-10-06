begin;

select plan(18);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0450000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-backdate-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0450000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-backdate-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0450000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-backdate-archived-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0450000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-backdate-inactive-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0450000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-backdate-archived-class-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0450000-0000-0000-0000-000000000001', 'ADMIN', 'QA-BACKDATE-ADMIN', 'QA Backdate Admin', 'ACTIVE', false),
  ('f0450000-0000-0000-0000-000000000002', 'TEACHER', 'QA-BACKDATE-TEACHER', 'QA Backdate Teacher', 'ACTIVE', false),
  ('f0450000-0000-0000-0000-000000000003', 'STUDENT', 'QA-BACKDATE-STUDENT-1', 'QA Backdate Student 1', 'ACTIVE', false),
  ('f0450000-0000-0000-0000-000000000004', 'STUDENT', 'QA-BACKDATE-STUDENT-2', 'QA Backdate Student 2', 'ACTIVE', false),
  ('f0450000-0000-0000-0000-000000000005', 'STUDENT', 'QA-BACKDATE-STUDENT-3', 'QA Backdate Student 3', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status)
values ('f0450000-0000-0000-0000-000000000101', 'f0450000-0000-0000-0000-000000000002', 'QA-T-BACKDATE', 'TEACHER', 'QA Backdate Teacher', 'ACTIVE');

insert into public.students (id, user_id, student_code, full_name, status) values
  ('f0450000-0000-0000-0000-000000000201', 'f0450000-0000-0000-0000-000000000003', 'QA-S-BACKDATE-1', 'QA Backdate Student 1', 'ARCHIVED'),
  ('f0450000-0000-0000-0000-000000000202', 'f0450000-0000-0000-0000-000000000004', 'QA-S-BACKDATE-2', 'QA Backdate Student 2', 'ACTIVE'),
  ('f0450000-0000-0000-0000-000000000203', 'f0450000-0000-0000-0000-000000000005', 'QA-S-BACKDATE-3', 'QA Backdate Student 3', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0450000-0000-0000-0000-000000000301', 'QA-BACKDATE-SUBJECT', 'QA Backdate Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0450000-0000-0000-0000-000000000302', 'QA-BACKDATE-GRADE', 'QA Backdate Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status) values
  ('f0450000-0000-0000-0000-000000000401', 'QA-BACKDATE-ACTIVE', 'QA Backdate Active Class', 'f0450000-0000-0000-0000-000000000301', 'f0450000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0450000-0000-0000-0000-000000000402', 'QA-BACKDATE-INACTIVE', 'QA Backdate Inactive Class', 'f0450000-0000-0000-0000-000000000301', 'f0450000-0000-0000-0000-000000000302', 'INACTIVE'),
  ('f0450000-0000-0000-0000-000000000403', 'QA-BACKDATE-ARCHIVED', 'QA Backdate Archived Class', 'f0450000-0000-0000-0000-000000000301', 'f0450000-0000-0000-0000-000000000302', 'ARCHIVED');

insert into public.class_memberships (class_id, student_id, start_date, end_date, status) values
  ('f0450000-0000-0000-0000-000000000401', 'f0450000-0000-0000-0000-000000000201', '2025-01-01', '2025-12-31', 'INACTIVE'),
  ('f0450000-0000-0000-0000-000000000401', 'f0450000-0000-0000-0000-000000000202', '2025-01-01', null, 'ACTIVE'),
  ('f0450000-0000-0000-0000-000000000402', 'f0450000-0000-0000-0000-000000000202', '2025-01-01', '2025-12-31', 'ARCHIVED'),
  ('f0450000-0000-0000-0000-000000000402', 'f0450000-0000-0000-0000-000000000201', '2025-01-01', '2025-12-31', 'INACTIVE'),
  ('f0450000-0000-0000-0000-000000000403', 'f0450000-0000-0000-0000-000000000203', '2025-01-01', '2025-12-31', 'INACTIVE');

insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, room)
values
  ('f0450000-0000-0000-0000-000000000501', 'f0450000-0000-0000-0000-000000000401', '2025-03-10 17:30:00+07', '2025-03-10 19:00:00+07', 'COMPLETED', 'QA-Room-A'),
  ('f0450000-0000-0000-0000-000000000502', 'f0450000-0000-0000-0000-000000000403', '2025-03-14 17:30:00+07', '2025-03-14 19:00:00+07', 'COMPLETED', 'QA-Room-B'),
  ('f0450000-0000-0000-0000-000000000503', 'f0450000-0000-0000-0000-000000000403', '2025-03-15 17:30:00+07', '2025-03-15 19:00:00+07', 'COMPLETED', 'QA-Room-C'),
  ('f0450000-0000-0000-0000-000000000504', 'f0450000-0000-0000-0000-000000000403', '2025-03-16 17:30:00+07', '2025-03-16 19:00:00+07', 'CANCELLED', 'QA-Room-D');

insert into public.session_students (session_id, student_id) values
  ('f0450000-0000-0000-0000-000000000501', 'f0450000-0000-0000-0000-000000000201'),
  ('f0450000-0000-0000-0000-000000000502', 'f0450000-0000-0000-0000-000000000201'),
  ('f0450000-0000-0000-0000-000000000503', 'f0450000-0000-0000-0000-000000000203');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0450000-0000-0000-0000-000000000001', true);

select lives_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2025-03-09 17:30:00+07', '2025-03-09 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'Admin can create a historical session for an active class');
select is((
  select status::text from public.sessions
  where class_id = 'f0450000-0000-0000-0000-000000000401'
    and scheduled_start_at = '2025-03-09 17:30:00+07'
), 'SCHEDULED', 'a historical session starts in the normal scheduled state');
select is((
  select count(*)::integer from public.session_students ss
  join public.sessions s on s.id = ss.session_id
  where s.class_id = 'f0450000-0000-0000-0000-000000000401'
    and s.scheduled_start_at = '2025-03-09 17:30:00+07'
    and ss.student_id = 'f0450000-0000-0000-0000-000000000201'
), 1, 'historical roster includes a student with an inactive membership and archived account');
select is((
  select count(*)::integer from public.session_staff sf
  join public.sessions s on s.id = sf.session_id
  where s.class_id = 'f0450000-0000-0000-0000-000000000401'
    and s.scheduled_start_at = '2025-03-09 17:30:00+07'
    and sf.staff_id = 'f0450000-0000-0000-0000-000000000101'
), 1, 'historical session keeps its active assigned teacher');

select lives_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2099-03-09 17:30:00+07', '2099-03-09 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-Future'
  )
$$, 'Admin can still create future sessions for an active class');
select is((
  select count(*)::integer from public.session_students ss
  join public.sessions s on s.id = ss.session_id
  where s.class_id = 'f0450000-0000-0000-0000-000000000401'
    and s.scheduled_start_at = '2099-03-09 17:30:00+07'
), 1, 'future roster still contains only currently active memberships and students');
select is((
  select count(*)::integer from public.session_students ss
  join public.sessions s on s.id = ss.session_id
  where s.class_id = 'f0450000-0000-0000-0000-000000000401'
    and s.scheduled_start_at = '2099-03-09 17:30:00+07'
    and ss.student_id = 'f0450000-0000-0000-0000-000000000201'
), 0, 'future roster excludes students whose account and membership are inactive');

select lives_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000402',
    '2025-03-11 17:30:00+07', '2025-03-11 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'Admin can create a historical session for an inactive class');
select is((
  select count(*)::integer from public.session_students ss
  join public.sessions s on s.id = ss.session_id
  where s.class_id = 'f0450000-0000-0000-0000-000000000402'
    and s.scheduled_start_at = '2025-03-11 17:30:00+07'
), 2, 'historical roster uses all memberships effective that day regardless of membership or student status');
select lives_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000403',
    '2025-03-12 17:30:00+07', '2025-03-12 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'Admin can create a historical session for an archived class');

select throws_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000402',
    '2099-03-11 17:30:00+07', '2099-03-11 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'P0001', 'CLASS_NOT_ACTIVE', 'inactive classes remain unavailable for future sessions');
select throws_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2024-12-31 17:30:00+07', '2024-12-31 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'P0001', 'NO_ACTIVE_STUDENTS', 'historical sessions require a membership effective on that date');

select throws_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2025-03-10 17:30:00+07', '2025-03-10 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'P0001', 'SCHEDULE_CONFLICT', 'a completed session for the same class blocks a backdated duplicate');
select throws_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000402',
    '2025-03-14 17:30:00+07', '2025-03-14 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-E'
  )
$$, 'P0001', 'SCHEDULE_CONFLICT', 'a completed session with a shared student blocks a backdated overlap');
select throws_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2025-03-15 17:30:00+07', '2025-03-15 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-C'
  )
$$, 'P0001', 'ROOM_ALREADY_BOOKED', 'a completed historical session reserves its room for backdated checks');
select lives_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2025-03-16 17:30:00+07', '2025-03-16 19:00:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-D'
  )
$$, 'a cancelled historical session does not block a make-up session');
select throws_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2025-03-17 19:30:00+07', '2025-03-17 17:30:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'P0001', 'INVALID_INPUT', 'session end must be later than its start');
select throws_ok($$
  select public.admin_create_session(
    'f0450000-0000-0000-0000-000000000401',
    '2025-03-17 23:30:00+07', '2025-03-18 00:30:00+07',
    array['f0450000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'P0001', 'INVALID_INPUT', 'session boundaries must remain within one Vietnam business date');

select * from finish();
rollback;
