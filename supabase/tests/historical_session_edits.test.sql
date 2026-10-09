begin;

select plan(42);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0560000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-historical-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0560000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-historical-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0560000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-historical-student-one@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0560000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-historical-student-two@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0560000-0000-0000-0000-000000000001', 'ADMIN', 'QA-HISTORICAL-ADMIN', 'QA Historical Admin', 'ACTIVE', false),
  ('f0560000-0000-0000-0000-000000000002', 'TEACHER', 'QA-HISTORICAL-TEACHER', 'QA Historical Teacher', 'ACTIVE', false),
  ('f0560000-0000-0000-0000-000000000003', 'STUDENT', 'QA-HISTORICAL-STUDENT-1', 'QA Historical Student One', 'ACTIVE', false),
  ('f0560000-0000-0000-0000-000000000004', 'STUDENT', 'QA-HISTORICAL-STUDENT-2', 'QA Historical Student Two', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0560000-0000-0000-0000-000000000101', 'f0560000-0000-0000-0000-000000000002', 'QA-HISTORICAL-T1', 'TEACHER', 'QA Historical Teacher One', 'ACTIVE'),
  ('f0560000-0000-0000-0000-000000000102', null, 'QA-HISTORICAL-T2', 'TEACHER', 'QA Historical Teacher Two', 'ACTIVE'),
  ('f0560000-0000-0000-0000-000000000103', null, 'QA-HISTORICAL-T3', 'TEACHER', 'QA Historical Teacher Three', 'ACTIVE');

insert into public.students (id, user_id, student_code, full_name, status) values
  ('f0560000-0000-0000-0000-000000000201', 'f0560000-0000-0000-0000-000000000003', 'QA-HISTORICAL-S1', 'QA Historical Student One', 'ACTIVE'),
  ('f0560000-0000-0000-0000-000000000202', 'f0560000-0000-0000-0000-000000000004', 'QA-HISTORICAL-S2', 'QA Historical Student Two', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0560000-0000-0000-0000-000000000301', 'QA-HISTORICAL-SUBJECT', 'QA Historical Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0560000-0000-0000-0000-000000000302', 'QA-HISTORICAL-GRADE', 'QA Historical Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status) values
  ('f0560000-0000-0000-0000-000000000401', 'QA-HISTORICAL-CLASS-1', 'QA Historical Class One', 'f0560000-0000-0000-0000-000000000301', 'f0560000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0560000-0000-0000-0000-000000000402', 'QA-HISTORICAL-CLASS-2', 'QA Historical Class Two', 'f0560000-0000-0000-0000-000000000301', 'f0560000-0000-0000-0000-000000000302', 'ACTIVE');

insert into public.class_memberships (class_id, student_id, start_date, end_date, status) values
  ('f0560000-0000-0000-0000-000000000401', 'f0560000-0000-0000-0000-000000000201', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 30, (now() at time zone 'Asia/Ho_Chi_Minh')::date - 10, 'INACTIVE'),
  ('f0560000-0000-0000-0000-000000000401', 'f0560000-0000-0000-0000-000000000202', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 10, null, 'ACTIVE');

insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, started_at, ended_at, room, session_note)
values
  ('f0560000-0000-0000-0000-000000000501', 'f0560000-0000-0000-0000-000000000401', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30) + time '17:30') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30) + time '19:30') at time zone 'Asia/Ho_Chi_Minh', 'COMPLETED', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30) + time '17:35') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30) + time '19:32') at time zone 'Asia/Ho_Chi_Minh', 'QA-HISTORICAL-ROOM-A', 'QA note before edit'),
  ('f0560000-0000-0000-0000-000000000502', 'f0560000-0000-0000-0000-000000000401', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1) + time '17:30') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1) + time '19:30') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', null, null, 'QA-HISTORICAL-ROOM-B', null),
  ('f0560000-0000-0000-0000-000000000503', 'f0560000-0000-0000-0000-000000000401', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh', 'IN_PROGRESS', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 2) + time '17:35') at time zone 'Asia/Ho_Chi_Minh', null, 'QA-HISTORICAL-ROOM-C', null),
  ('f0560000-0000-0000-0000-000000000504', 'f0560000-0000-0000-0000-000000000401', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 3) + time '17:30') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 3) + time '19:30') at time zone 'Asia/Ho_Chi_Minh', 'CANCELLED', null, null, 'QA-HISTORICAL-ROOM-D', null),
  ('f0560000-0000-0000-0000-000000000505', 'f0560000-0000-0000-0000-000000000401', (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 3) + time '17:30') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 3) + time '19:30') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', null, null, 'QA-HISTORICAL-ROOM-E', null),
  ('f0560000-0000-0000-0000-000000000506', 'f0560000-0000-0000-0000-000000000402', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 5) + time '17:30') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 5) + time '19:30') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', null, null, 'QA-HISTORICAL-ROOM-B', null),
  ('f0560000-0000-0000-0000-000000000507', 'f0560000-0000-0000-0000-000000000402', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 4) + time '17:30') at time zone 'Asia/Ho_Chi_Minh', (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 4) + time '19:30') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', null, null, 'QA-HISTORICAL-ROOM-C', null);

insert into public.session_students (session_id, student_id, assessment_snapshot, monthly_fee_snapshot, session_unit_value) values
  ('f0560000-0000-0000-0000-000000000501', 'f0560000-0000-0000-0000-000000000201', '{"source":"QA-preserve"}'::jsonb, 25000, 15000);
insert into public.session_staff (session_id, staff_id, assignment_role)
values
  ('f0560000-0000-0000-0000-000000000501', 'f0560000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0560000-0000-0000-0000-000000000502', 'f0560000-0000-0000-0000-000000000102', 'TEACHER'),
  ('f0560000-0000-0000-0000-000000000507', 'f0560000-0000-0000-0000-000000000102', 'TEACHER');
insert into public.student_attendances (session_id, student_id, status, homework_score, updated_by)
values ('f0560000-0000-0000-0000-000000000501', 'f0560000-0000-0000-0000-000000000201', 'PRESENT', 6, 'f0560000-0000-0000-0000-000000000001');
insert into public.timesheets (id, session_id, staff_id, status, notes)
values ('f0560000-0000-0000-0000-000000000601', 'f0560000-0000-0000-0000-000000000501', 'f0560000-0000-0000-0000-000000000101', 'APPROVED', 'QA preserve timesheet');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0560000-0000-0000-0000-000000000001', true);

select lives_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000501',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 4) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 4) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    'QA-HISTORICAL-ROOM-A'
  )
$$, 'Admin can correct the schedule date for a completed makeup session');
select is((select status::text from public.sessions where id = 'f0560000-0000-0000-0000-000000000501'), 'COMPLETED'::text, 'schedule correction preserves completed status');
select is((select started_at from public.sessions where id = 'f0560000-0000-0000-0000-000000000501'), (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30) + time '17:35') at time zone 'Asia/Ho_Chi_Minh', 'schedule correction preserves actual start time');
select is((select ended_at from public.sessions where id = 'f0560000-0000-0000-0000-000000000501'), (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30) + time '19:32') at time zone 'Asia/Ho_Chi_Minh', 'schedule correction preserves actual end time');

select lives_ok($$
  select public.admin_update_session_teachers(
    'f0560000-0000-0000-0000-000000000501',
    array['f0560000-0000-0000-0000-000000000103'::uuid]
  )
$$, 'Admin can update teachers for a completed session');
select throws_ok($$
  select public.admin_update_session_teachers(
    'f0560000-0000-0000-0000-000000000501',
    array['f0560000-0000-0000-0000-000000000102'::uuid]
  )
$$, 'P0001', 'SCHEDULE_CONFLICT', 'teacher assignment rejects an overlapping scheduled session');
select is((select staff_id from public.session_staff where session_id = 'f0560000-0000-0000-0000-000000000501'), 'f0560000-0000-0000-0000-000000000103'::uuid, 'teacher assignment is updated');

select lives_ok($$
  select public.admin_sync_session_student_roster('f0560000-0000-0000-0000-000000000501')
$$, 'Admin can synchronize a completed session to membership effective on its corrected date');
select is((select count(*)::integer from public.session_students where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000202'), 1, 'sync adds the student whose membership is effective on the corrected date');
select is((select count(*)::integer from public.session_students where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000201'), 1, 'sync retains a student row with attendance history');
select is((select assessment_snapshot from public.session_students where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000201'), '{"source":"QA-preserve"}'::jsonb, 'sync preserves the stored assessment snapshot');
select is((select monthly_fee_snapshot from public.session_students where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000201'), 25000::bigint, 'sync preserves the monthly fee snapshot');
select is((select session_unit_value from public.session_students where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000201'), 15000::bigint, 'sync preserves the session unit snapshot');

select lives_ok($$
  select public.admin_correct_session_learning(
    'f0560000-0000-0000-0000-000000000501',
    'QA note after correction',
    'https://youtu.be/dQw4w9WgXcQ',
    '[{"student_id":"f0560000-0000-0000-0000-000000000201","status":"LATE","late_minutes":7,"homework_score":8.5,"homework_note":"QA homework","understanding_score":4,"attitude_score":5,"positive_feedback_count":2,"positive_feedback_raw":"QA positive","comment":"QA comment"},{"student_id":"f0560000-0000-0000-0000-000000000202","status":"ABSENT","absence_reason":"QA reason"}]'::jsonb
  )
$$, 'Admin can correct a completed session note, video, attendance, and assessments');
select is((select status::text from public.timesheets where id = 'f0560000-0000-0000-0000-000000000601'), 'APPROVED'::text, 'schedule and learning correction preserve timesheet status');
select is((select notes from public.timesheets where id = 'f0560000-0000-0000-0000-000000000601'), 'QA preserve timesheet'::text, 'schedule and learning correction preserve timesheet details');
select is((select session_note from public.sessions where id = 'f0560000-0000-0000-0000-000000000501'), 'QA note after correction'::text, 'corrected lesson note is saved');
select is((select homework_score from public.student_attendances where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000201'), 8.5::numeric, 'decimal homework score is saved');
select is((select positive_feedback_count from public.student_attendances where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000201'), 2, 'feedback count is saved');
select is((select absence_reason from public.student_attendances where session_id = 'f0560000-0000-0000-0000-000000000501' and student_id = 'f0560000-0000-0000-0000-000000000202'), 'QA reason'::text, 'absence reason is saved for a newly recorded attendance');

select throws_ok($$
  select public.admin_correct_session_learning(
    'f0560000-0000-0000-0000-000000000501', null, null,
    '[{"student_id":"f0560000-0000-0000-0000-000000000201","status":"PRESENT","homework_score":11}]'::jsonb
  )
$$, 'P0001', 'INVALID_HOMEWORK_SCORE', 'homework score outside 0 to 10 is rejected');
select throws_ok($$
  select public.admin_correct_session_learning('f0560000-0000-0000-0000-000000000501', null, 'https://example.invalid/video', '[]'::jsonb)
$$, 'P0001', 'INVALID_YOUTUBE_URL', 'non-YouTube lesson links are rejected');
select is((select session_note from public.sessions where id = 'f0560000-0000-0000-0000-000000000501'), 'QA note after correction'::text, 'failed correction leaves previously saved content intact');

select throws_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000502',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 4) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 4) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    'QA-HISTORICAL-ROOM-F'
  )
$$, 'P0001', 'SCHEDULE_CONFLICT', 'schedule correction rejects an assigned teacher conflict');
select lives_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000502',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    'QA-HISTORICAL-ROOM-F'
  )
$$, 'Admin can move an overdue scheduled session into the future');
select is((select status::text from public.sessions where id = 'f0560000-0000-0000-0000-000000000502'), 'SCHEDULED'::text, 'rescheduled overdue occurrence remains scheduled');
select throws_ok($$
  select public.admin_correct_session_learning('f0560000-0000-0000-0000-000000000505', null, null, '[]'::jsonb)
$$, 'P0001', 'SESSION_LOCKED', 'future scheduled learning data remains locked');

select throws_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000503', now() + interval '1 day', now() + interval '1 day 2 hours', 'QA-FUTURE'
  )
$$, 'P0001', 'HISTORICAL_SESSION_MUST_REMAIN_PAST', 'in-progress session cannot be moved into the future');
select lives_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000503',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 6) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 6) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    'QA-HISTORICAL-ROOM-G'
  )
$$, 'Admin can correct an in-progress session to another past time');
select is((select status::text from public.sessions where id = 'f0560000-0000-0000-0000-000000000503'), 'IN_PROGRESS'::text, 'schedule correction preserves in-progress status');
select is((select started_at from public.sessions where id = 'f0560000-0000-0000-0000-000000000503'), (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 2) + time '17:35') at time zone 'Asia/Ho_Chi_Minh', 'in-progress schedule correction preserves actual start time');
select is((select ended_at from public.sessions where id = 'f0560000-0000-0000-0000-000000000503'), null::timestamptz, 'in-progress schedule correction leaves actual end time untouched');

select throws_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000501',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 5) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 5) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    'QA-HISTORICAL-ROOM-B'
  )
$$, 'P0001', 'ROOM_ALREADY_BOOKED', 'schedule correction rejects a room conflict');
select throws_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000504',
    now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'QA-CANCELLED'
  )
$$, 'P0001', 'SESSION_LOCKED', 'cancelled sessions cannot be edited');
select throws_ok($$
  select public.admin_sync_session_student_roster('f0560000-0000-0000-0000-000000000504')
$$, 'P0001', 'SESSION_LOCKED', 'cancelled session rosters cannot be edited');
select throws_ok($$
  select public.admin_correct_session_learning('f0560000-0000-0000-0000-000000000504', null, null, '[]'::jsonb)
$$, 'P0001', 'SESSION_LOCKED', 'cancelled session learning data cannot be edited');

reset role;
set local role service_role;
select ok(exists (
  select 1 from public.audit_logs
  where actor_user_id = 'f0560000-0000-0000-0000-000000000001'
    and entity_id = 'f0560000-0000-0000-0000-000000000501'
    and action = 'SESSION_SCHEDULE_CORRECTION'
    and old_data->>'status' = 'COMPLETED'
    and new_data->>'scheduled_start_at' is not null
), 'schedule correction stores before and after data in audit');
select ok(exists (
  select 1 from public.audit_logs
  where actor_user_id = 'f0560000-0000-0000-0000-000000000001'
    and entity_id = 'f0560000-0000-0000-0000-000000000501'
    and action = 'SESSION_ADMIN_LEARNING_CORRECTION'
    and old_data ? 'attendance'
    and new_data ? 'attendance'
), 'learning correction stores old and new attendance in audit');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0560000-0000-0000-0000-000000000002', true);
select throws_ok($$
  select public.admin_correct_session_learning('f0560000-0000-0000-0000-000000000501', null, null, '[]'::jsonb)
$$, 'P0001', 'FORBIDDEN', 'teacher cannot invoke Admin learning correction');
select throws_ok($$
  select public.admin_update_session_schedule(
    'f0560000-0000-0000-0000-000000000501', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', null
  )
$$, 'P0001', 'FORBIDDEN', 'teacher cannot invoke Admin schedule correction');
select throws_ok($$
  select public.admin_update_session_teachers('f0560000-0000-0000-0000-000000000501', array['f0560000-0000-0000-0000-000000000103'::uuid])
$$, 'P0001', 'FORBIDDEN', 'teacher cannot reassign session teachers');
select throws_ok($$
  select public.admin_sync_session_student_roster('f0560000-0000-0000-0000-000000000501')
$$, 'P0001', 'FORBIDDEN', 'teacher cannot synchronize a session roster');

select * from finish();
rollback;
