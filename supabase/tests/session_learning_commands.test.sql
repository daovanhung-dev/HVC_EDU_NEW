begin;

select plan(27);

-- Fixtures are synthetic, and the transaction is rolled back after these checks.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0460000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-session-command-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0460000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-session-command-unassigned@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0460000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-session-command-student-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0460000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-session-command-student-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0460000-0000-0000-0000-000000000001', 'TEACHER', 'QA-SESSION-COMMAND-TEACHER', 'QA Session Command Teacher', 'ACTIVE', false),
  ('f0460000-0000-0000-0000-000000000002', 'TEACHER', 'QA-SESSION-COMMAND-UNASSIGNED', 'QA Session Command Unassigned', 'ACTIVE', false),
  ('f0460000-0000-0000-0000-000000000003', 'STUDENT', 'QA-SESSION-COMMAND-STUDENT-A', 'QA Session Command Student A', 'ACTIVE', false),
  ('f0460000-0000-0000-0000-000000000004', 'STUDENT', 'QA-SESSION-COMMAND-STUDENT-B', 'QA Session Command Student B', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0460000-0000-0000-0000-000000000101', 'f0460000-0000-0000-0000-000000000001', 'QA-SESSION-COMMAND-T1', 'TEACHER', 'QA Session Command Teacher', 'ACTIVE'),
  ('f0460000-0000-0000-0000-000000000102', 'f0460000-0000-0000-0000-000000000002', 'QA-SESSION-COMMAND-T2', 'TEACHER', 'QA Session Command Unassigned', 'ACTIVE');

insert into public.students (id, user_id, student_code, full_name, status) values
  ('f0460000-0000-0000-0000-000000000201', 'f0460000-0000-0000-0000-000000000003', 'QA-SESSION-COMMAND-S1', 'QA Session Command Student A', 'ACTIVE'),
  ('f0460000-0000-0000-0000-000000000202', 'f0460000-0000-0000-0000-000000000004', 'QA-SESSION-COMMAND-S2', 'QA Session Command Student B', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0460000-0000-0000-0000-000000000301', 'QA-SESSION-COMMAND-SUBJECT', 'QA Session Command Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0460000-0000-0000-0000-000000000302', 'QA-SESSION-COMMAND-GRADE', 'QA Session Command Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0460000-0000-0000-0000-000000000401', 'QA-SESSION-COMMAND-CLASS', 'QA Session Command Class', 'f0460000-0000-0000-0000-000000000301', 'f0460000-0000-0000-0000-000000000302', 'ACTIVE');
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, room)
values (
  'f0460000-0000-0000-0000-000000000501',
  'f0460000-0000-0000-0000-000000000401',
  (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
  (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
  'SCHEDULED', 'QA-SESSION-COMMAND-ROOM'
);
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, room, lesson_youtube_url)
values (
  'f0460000-0000-0000-0000-000000000502',
  'f0460000-0000-0000-0000-000000000401',
  (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
  (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
  'COMPLETED', 'QA-SESSION-COMMAND-ROOM', 'https://youtu.be/dQw4w9WgXcQ'
);
select ok(
  (select scheduled_start_at < now() and status = 'SCHEDULED'
   from public.sessions where id = 'f0460000-0000-0000-0000-000000000501'),
  'fixture is a scheduled session in the past'
);
insert into public.session_students (session_id, student_id) values
  ('f0460000-0000-0000-0000-000000000501', 'f0460000-0000-0000-0000-000000000201'),
  ('f0460000-0000-0000-0000-000000000501', 'f0460000-0000-0000-0000-000000000202'),
  ('f0460000-0000-0000-0000-000000000502', 'f0460000-0000-0000-0000-000000000202');
insert into public.session_staff (session_id, staff_id, assignment_role)
values ('f0460000-0000-0000-0000-000000000501', 'f0460000-0000-0000-0000-000000000101', 'TEACHER');

set local role service_role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select ok(
  has_function_privilege('service_role', 'public.start_session(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.complete_session(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.update_session_learning(uuid,uuid,text,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.update_session_learning(uuid,uuid,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.start_session(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.complete_session(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.update_session_learning(uuid,uuid,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.update_session_learning(uuid,uuid,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.start_session(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.complete_session(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_session_learning(uuid,uuid,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_session_learning(uuid,uuid,text,text,jsonb)', 'EXECUTE'),
  'session RPC execution remains restricted to service_role'
);
select is(current_setting('request.jwt.claim.role', true), ''::text, 'service_role test call has no JWT role claim');
select is(current_user::text, 'service_role'::text, 'test runs as the database service_role');

select throws_ok($$
  select public.start_session(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000002'
  )
$$, 'P0001', 'SESSION_TEACHER_REQUIRED', 'an unassigned teacher cannot start this session');
select lives_ok($$
  select public.start_session(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000001'
  )
$$, 'assigned teacher can start a past session without a JWT role claim');
select is((select status::text from public.sessions where id = 'f0460000-0000-0000-0000-000000000501'), 'IN_PROGRESS'::text, 'starting changes the session status');
select is((select started_by from public.sessions where id = 'f0460000-0000-0000-0000-000000000501'), 'f0460000-0000-0000-0000-000000000001'::uuid, 'starting records the assigned teacher');

select lives_ok($$
  select public.update_session_learning(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000001',
    'QA session note',
    '[{"student_id":"f0460000-0000-0000-0000-000000000201","status":"PRESENT","homework_score":8}]'::jsonb
  )
$$, 'assigned teacher can save attendance and learning results');
select lives_ok($$
  select public.update_session_learning(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000001',
    'QA session note with video',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '[]'::jsonb
  )
$$, 'assigned teacher can save a YouTube link while the session is in progress');
select ok(
  (select lesson_youtube_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' from public.sessions where id = 'f0460000-0000-0000-0000-000000000501')
  and exists (
    select 1 from public.audit_logs
    where entity_id = 'f0460000-0000-0000-0000-000000000501'
      and action = 'SESSION_LEARNING_UPDATE'
      and old_data ? 'lesson_youtube_url'
      and old_data->>'lesson_youtube_url' is null
      and new_data->>'lesson_youtube_url' = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  ), 'saved video link is persisted and included in the learning audit');
select is((select count(*)::integer from public.student_attendances where session_id = 'f0460000-0000-0000-0000-000000000501'), 1, 'the first learning result is persisted');
select throws_ok($$
  select public.complete_session(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000001'
  )
$$, 'P0001', 'SESSION_NOT_COMPLETEABLE', 'completion is blocked while a roster student has no attendance');
select throws_ok($$
  select public.update_session_learning(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000002',
    null,
    '[]'::jsonb
  )
$$, 'P0001', 'FORBIDDEN', 'an unassigned teacher cannot save session results');

select lives_ok($$
  select public.update_session_learning(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000001',
    'QA session note complete',
    '[{"student_id":"f0460000-0000-0000-0000-000000000201","status":"PRESENT","homework_score":8},{"student_id":"f0460000-0000-0000-0000-000000000202","status":"LATE","late_minutes":5,"homework_score":7}]'::jsonb
  )
$$, 'assigned teacher can save results for the full roster');
select is((select count(*)::integer from public.student_attendances where session_id = 'f0460000-0000-0000-0000-000000000501'), 2, 'attendance now covers the full roster');
select throws_ok($$
  select public.complete_session(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000002'
  )
$$, 'P0001', 'SESSION_TEACHER_REQUIRED', 'an unassigned teacher cannot complete the session');
select lives_ok($$
  select public.complete_session(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000001'
  )
$$, 'assigned teacher can complete the session without a JWT role claim');
select is((select status::text from public.sessions where id = 'f0460000-0000-0000-0000-000000000501'), 'COMPLETED'::text, 'completion changes the session status');
select is((select ended_by from public.sessions where id = 'f0460000-0000-0000-0000-000000000501'), 'f0460000-0000-0000-0000-000000000001'::uuid, 'completion records the assigned teacher');
select throws_ok($$
  select public.update_session_learning(
    'f0460000-0000-0000-0000-000000000501',
    'f0460000-0000-0000-0000-000000000001',
    null,
    'https://youtu.be/dQw4w9WgXcQ',
    '[]'::jsonb
  )
$$, 'P0001', 'SESSION_LOCKED', 'a completed session cannot be edited to add a video');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0460000-0000-0000-0000-000000000001', true);
select throws_ok($$
  select public.start_session('f0460000-0000-0000-0000-000000000501', 'f0460000-0000-0000-0000-000000000001')
$$, '42501', 'permission denied for function start_session', 'authenticated cannot invoke start_session directly');
select throws_ok($$
  select public.complete_session('f0460000-0000-0000-0000-000000000501', 'f0460000-0000-0000-0000-000000000001')
$$, '42501', 'permission denied for function complete_session', 'authenticated cannot invoke complete_session directly');
select throws_ok($$
  select public.update_session_learning('f0460000-0000-0000-0000-000000000501', 'f0460000-0000-0000-0000-000000000001', null, '[]'::jsonb)
$$, '42501', 'permission denied for function update_session_learning', 'authenticated cannot invoke update_session_learning directly');
select throws_ok($$
  select public.update_session_learning('f0460000-0000-0000-0000-000000000501', 'f0460000-0000-0000-0000-000000000001', null, null, '[]'::jsonb)
$$, '42501', 'permission denied for function update_session_learning', 'authenticated cannot invoke the video RPC directly');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0460000-0000-0000-0000-000000000003', true);
select is((select lesson_youtube_url from public.sessions where id = 'f0460000-0000-0000-0000-000000000501'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'::text, 'a student can read the video on their own session');
select is((select count(*)::integer from public.sessions where id = 'f0460000-0000-0000-0000-000000000502'), 0, 'a student cannot read another student session video');

select * from finish();
rollback;
