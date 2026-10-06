begin;

select plan(41);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0440000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-room-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0440000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-room-teacher-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0440000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-room-teacher-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0440000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-room-student-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0440000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-room-student-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0440000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'qa-room-student-c@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0440000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'qa-room-student-d@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0440000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'qa-room-student-e@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0440000-0000-0000-0000-000000000001', 'ADMIN', 'QA-ROOM-ADMIN', 'QA Room Admin', 'ACTIVE', false),
  ('f0440000-0000-0000-0000-000000000002', 'TEACHER', 'QA-ROOM-TEACHER-A', 'QA Room Teacher A', 'ACTIVE', false),
  ('f0440000-0000-0000-0000-000000000003', 'TEACHER', 'QA-ROOM-TEACHER-B', 'QA Room Teacher B', 'ACTIVE', false),
  ('f0440000-0000-0000-0000-000000000004', 'STUDENT', 'QA-ROOM-STUDENT-A', 'QA Room Student A', 'ACTIVE', false),
  ('f0440000-0000-0000-0000-000000000005', 'STUDENT', 'QA-ROOM-STUDENT-B', 'QA Room Student B', 'ACTIVE', false),
  ('f0440000-0000-0000-0000-000000000006', 'STUDENT', 'QA-ROOM-STUDENT-C', 'QA Room Student C', 'ACTIVE', false),
  ('f0440000-0000-0000-0000-000000000007', 'STUDENT', 'QA-ROOM-STUDENT-D', 'QA Room Student D', 'ACTIVE', false),
  ('f0440000-0000-0000-0000-000000000008', 'STUDENT', 'QA-ROOM-STUDENT-E', 'QA Room Student E', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0440000-0000-0000-0000-000000000101', 'f0440000-0000-0000-0000-000000000002', 'QA-ROOM-T-1', 'TEACHER', 'QA Room Teacher A', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000102', 'f0440000-0000-0000-0000-000000000003', 'QA-ROOM-T-2', 'TEACHER', 'QA Room Teacher B', 'ACTIVE');

insert into public.students (id, user_id, student_code, full_name, status) values
  ('f0440000-0000-0000-0000-000000000201', 'f0440000-0000-0000-0000-000000000004', 'QA-ROOM-S-1', 'QA Room Student A', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000202', 'f0440000-0000-0000-0000-000000000005', 'QA-ROOM-S-2', 'QA Room Student B', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000203', 'f0440000-0000-0000-0000-000000000006', 'QA-ROOM-S-3', 'QA Room Student C', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000204', 'f0440000-0000-0000-0000-000000000007', 'QA-ROOM-S-4', 'QA Room Student D', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000205', 'f0440000-0000-0000-0000-000000000008', 'QA-ROOM-S-5', 'QA Room Student E', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0440000-0000-0000-0000-000000000301', 'QA-ROOM-SUBJECT', 'QA Room Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0440000-0000-0000-0000-000000000302', 'QA-ROOM-GRADE', 'QA Room Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status) values
  ('f0440000-0000-0000-0000-000000000303', 'QA-ROOM-CLASS-A', 'QA Room Class A', 'f0440000-0000-0000-0000-000000000301', 'f0440000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000304', 'QA-ROOM-CLASS-B', 'QA Room Class B', 'f0440000-0000-0000-0000-000000000301', 'f0440000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000305', 'QA-ROOM-CLASS-C', 'QA Room Class C', 'f0440000-0000-0000-0000-000000000301', 'f0440000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000306', 'QA-ROOM-CLASS-D', 'QA Room Class D', 'f0440000-0000-0000-0000-000000000301', 'f0440000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000307', 'QA-ROOM-CLASS-E', 'QA Room Class E', 'f0440000-0000-0000-0000-000000000301', 'f0440000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000308', 'QA-ROOM-CLASS-F', 'QA Room Class F', 'f0440000-0000-0000-0000-000000000301', 'f0440000-0000-0000-0000-000000000302', 'ACTIVE');

insert into public.class_memberships (class_id, student_id, start_date, status) values
  ('f0440000-0000-0000-0000-000000000303', 'f0440000-0000-0000-0000-000000000201', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000304', 'f0440000-0000-0000-0000-000000000202', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000305', 'f0440000-0000-0000-0000-000000000201', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000306', 'f0440000-0000-0000-0000-000000000203', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000307', 'f0440000-0000-0000-0000-000000000204', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE'),
  ('f0440000-0000-0000-0000-000000000308', 'f0440000-0000-0000-0000-000000000205', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0440000-0000-0000-0000-000000000001', true);

select lives_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000303',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000101'::uuid], 'QA-Room-A'
  )
$$, 'Admin can create a manual session in the first room');
select is((select room from public.sessions where class_id = 'f0440000-0000-0000-0000-000000000303' and status = 'SCHEDULED' order by created_at desc limit 1),
  'QA-Room-A'::text, 'manual session stores its room');

select lives_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000304',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000102'::uuid], 'QA-Room-B'
  )
$$, 'different classes may overlap in different rooms');
select lives_ok($$
  select public.admin_update_session_teachers(
    (select id from public.sessions where class_id = 'f0440000-0000-0000-0000-000000000304' and status = 'SCHEDULED' order by created_at desc limit 1),
    array['f0440000-0000-0000-0000-000000000101'::uuid]
  )
$$, 'the same teacher may be assigned to overlapping classes in separate rooms');
select is((
  select count(*)::integer from public.sessions s join public.session_staff ss on ss.session_id = s.id
  where s.class_id = 'f0440000-0000-0000-0000-000000000304' and s.status = 'SCHEDULED'
    and ss.staff_id = 'f0440000-0000-0000-0000-000000000101'
), 1, 'teacher reassignment is persisted for the second class');

select throws_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000305',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000102'::uuid], 'QA-Room-C'
  )
$$, 'P0001', 'SCHEDULE_CONFLICT', 'an overlapping student remains a scheduling conflict even in another room');
select throws_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000306',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000102'::uuid], 'QA-Room-A'
  )
$$, 'P0001', 'ROOM_ALREADY_BOOKED', 'an overlapping class cannot reuse an occupied room');
select throws_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000306',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000102'::uuid], null
  )
$$, 'P0001', 'ROOM_REQUIRED_FOR_OVERLAP', 'overlapping sessions require an explicit room');
select throws_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000303',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000102'::uuid], 'QA-Room-New'
  )
$$, 'P0001', 'SCHEDULE_CONFLICT', 'one class cannot have overlapping sessions even when the rooms differ');
select lives_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000306',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 3) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 3) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000102'::uuid], null
  )
$$, 'room may remain empty when the session does not overlap another class');
select lives_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000308',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '20:00') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000101'::uuid], null
  )
$$, 'sessions that only touch at an endpoint do not overlap');
select throws_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000308',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000101'::uuid], ' qa-room-a '
  )
$$, 'P0001', 'ROOM_ALREADY_BOOKED', 'room comparison ignores surrounding whitespace and letter case');

reset role;
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, room)
values
  ('f0440000-0000-0000-0000-000000000401', 'f0440000-0000-0000-0000-000000000305',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 4) + time '08:00') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 4) + time '10:00') at time zone 'Asia/Ho_Chi_Minh', 'COMPLETED', 'QA-Room-Archive'),
  ('f0440000-0000-0000-0000-000000000402', 'f0440000-0000-0000-0000-000000000308',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 4) + time '08:00') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 4) + time '10:00') at time zone 'Asia/Ho_Chi_Minh', 'CANCELLED', 'QA-Room-Archive');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0440000-0000-0000-0000-000000000001', true);
select lives_ok($$
  select public.admin_create_session(
    'f0440000-0000-0000-0000-000000000307',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 4) + time '08:00') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 4) + time '10:00') at time zone 'Asia/Ho_Chi_Minh',
    array['f0440000-0000-0000-0000-000000000102'::uuid], 'QA-Room-Archive'
  )
$$, 'completed and cancelled sessions do not reserve their rooms');
select is((select count(*)::integer from public.sessions where id in (
  'f0440000-0000-0000-0000-000000000401', 'f0440000-0000-0000-0000-000000000402'
) and status in ('COMPLETED', 'CANCELLED')), 2, 'terminal sessions remain unchanged');

select lives_ok($$
  select public.admin_update_session_occurrence(
    (select id from public.sessions where class_id = 'f0440000-0000-0000-0000-000000000307' and status = 'SCHEDULED' order by created_at desc limit 1),
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    false, 'QA-Room-C'
  )
$$, 'Admin can reschedule another class into the same time using a different room');
select is((select room from public.sessions where class_id = 'f0440000-0000-0000-0000-000000000307' and status = 'SCHEDULED' order by created_at desc limit 1),
  'QA-Room-C'::text, 'rescheduling changes the session room');
select is((select room_override from public.sessions where class_id = 'f0440000-0000-0000-0000-000000000307' and status = 'SCHEDULED' order by created_at desc limit 1),
  true, 'occurrence room edit is protected from recurring schedule refresh');
select throws_ok($$
  select public.admin_update_session_occurrence(
    (select id from public.sessions where class_id = 'f0440000-0000-0000-0000-000000000307' and status = 'SCHEDULED' order by created_at desc limit 1),
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    false, 'QA-Room-A'
  )
$$, 'P0001', 'ROOM_ALREADY_BOOKED', 'rescheduling cannot reuse a room already occupied by another class');
select throws_ok($$
  select public.admin_update_session_occurrence(
    (select id from public.sessions where class_id = 'f0440000-0000-0000-0000-000000000307' and status = 'SCHEDULED' order by created_at desc limit 1),
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    false, null
  )
$$, 'P0001', 'ROOM_REQUIRED_FOR_OVERLAP', 'rescheduling into an overlapping time requires a room');

reset role;
do $$
declare
  v_month date := date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month')::date;
  v_source_date date;
begin
  v_source_date := v_month + 2;
  insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, room, manual_schedule)
  values ('f0440000-0000-0000-0000-000000000403', 'f0440000-0000-0000-0000-000000000306',
    (v_source_date + time '10:00') at time zone 'Asia/Ho_Chi_Minh',
    (v_source_date + time '12:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', 'QA-Copy-Room', true);
  insert into public.session_staff (session_id, staff_id, assignment_role)
  values ('f0440000-0000-0000-0000-000000000403', 'f0440000-0000-0000-0000-000000000102', 'TEACHER');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0440000-0000-0000-0000-000000000001', true);
select lives_ok($$
  select public.admin_apply_week_to_month(
    array['f0440000-0000-0000-0000-000000000403'::uuid],
    date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month')::date
  )
$$, 'weekly copy accepts available future occurrences and preserves room');
select ok((
  select count(*) > 0 from public.sessions
  where class_id = 'f0440000-0000-0000-0000-000000000306' and manual_schedule
    and room = 'QA-Copy-Room' and scheduled_start_at > now()
    and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month')::date
    and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time = time '10:00'
), 'weekly copy creates date-specific sessions in the source room');
select is((
  select count(*)::integer from public.sessions
  where class_id = 'f0440000-0000-0000-0000-000000000306' and manual_schedule
    and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month')::date
    and room is distinct from 'QA-Copy-Room'
), 0, 'all copied occurrences inherit the source room');

reset role;
insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at)
values
  ('f0440000-0000-0000-0000-000000000411', 'f0440000-0000-0000-0000-000000000306', extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh')::date)::smallint, '06:00', '07:00', 'QA-Recurring-A', 'ACTIVE', now()),
  ('f0440000-0000-0000-0000-000000000412', 'f0440000-0000-0000-0000-000000000307', extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh')::date)::smallint, '06:00', '07:00', 'QA-Recurring-B', 'ACTIVE', now()),
  ('f0440000-0000-0000-0000-000000000413', 'f0440000-0000-0000-0000-000000000308', extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh')::date)::smallint, '06:00', '07:00', 'QA-Recurring-A', 'ACTIVE', now()),
  ('f0440000-0000-0000-0000-000000000414', 'f0440000-0000-0000-0000-000000000304', extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh')::date)::smallint, '06:00', '07:00', null, 'ACTIVE', now());
insert into public.class_schedule_staff (schedule_id, staff_id) values
  ('f0440000-0000-0000-0000-000000000411', 'f0440000-0000-0000-0000-000000000101'),
  ('f0440000-0000-0000-0000-000000000412', 'f0440000-0000-0000-0000-000000000101'),
  ('f0440000-0000-0000-0000-000000000413', 'f0440000-0000-0000-0000-000000000102'),
  ('f0440000-0000-0000-0000-000000000414', 'f0440000-0000-0000-0000-000000000102');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0440000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.generate_upcoming_sessions(30)$$, 'recurring generator can run with overlapping classes in distinct rooms');
select ok((
  select count(*) > 0 from public.sessions where recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000411' and status = 'SCHEDULED' and room = 'QA-Recurring-A'
), 'generator creates occurrences for the first room');
select ok((
  select count(*) > 0 from public.sessions where recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000412' and status = 'SCHEDULED' and room = 'QA-Recurring-B'
), 'generator creates occurrences for the second room');
select is((
  select count(distinct s.class_id)::integer from public.sessions s
  join public.session_staff ss on ss.session_id = s.id
  where s.recurrence_schedule_id in ('f0440000-0000-0000-0000-000000000411', 'f0440000-0000-0000-0000-000000000412')
    and s.status = 'SCHEDULED' and ss.staff_id = 'f0440000-0000-0000-0000-000000000101'
), 2, 'the same teacher can be scheduled for both classes');
select is((
  select count(*)::integer from public.sessions a join public.sessions b
    on a.id < b.id and a.scheduled_start_at < b.scheduled_end_at and a.scheduled_end_at > b.scheduled_start_at
  where a.recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000411'
    and b.recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000412'
    and a.status = 'SCHEDULED' and b.status = 'SCHEDULED'
    and lower(btrim(a.room)) <> lower(btrim(b.room))
), 0, 'recurring sessions are generated only at distinct rooms for overlapping periods');
select ok((
  select count(*) > 0 from public.sessions where recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000413' and status = 'CANCELLED'
), 'generator blocks another class from reusing a recurring room');
select ok((
  select count(*) > 0 from public.sessions where recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000414' and status = 'CANCELLED'
), 'generator blocks an overlapping recurring session when its room is missing');
select ok(((public.generate_upcoming_sessions(30)->>'room_conflicts')::integer) > 0,
  'generator reports recurring room collisions to Admin');
select ok(((public.generate_upcoming_sessions(30)->>'missing_room_conflicts')::integer) > 0,
  'generator reports recurring overlaps that need a room');
select lives_ok($$
  select public.admin_update_session_occurrence(
    (select s.id from public.sessions s where s.recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000411'
      and s.status = 'SCHEDULED' and s.scheduled_start_at > now() order by s.scheduled_start_at limit 1),
    (select s.scheduled_start_at from public.sessions s where s.recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000411'
      and s.status = 'SCHEDULED' and s.scheduled_start_at > now() order by s.scheduled_start_at limit 1),
    (select s.scheduled_end_at from public.sessions s where s.recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000411'
      and s.status = 'SCHEDULED' and s.scheduled_start_at > now() order by s.scheduled_start_at limit 1),
    false, 'QA-Override-Room'
  )
$$, 'Admin can override the room for one generated occurrence');
select lives_ok($$update public.class_schedules set room = 'QA-Recurring-A2' where id = 'f0440000-0000-0000-0000-000000000411'$$,
  'Admin can edit the recurring schedule room');
select lives_ok($$select public.generate_upcoming_sessions(30)$$, 'generator refreshes recurring rooms after a schedule edit');
select is((
  select count(*)::integer from public.sessions
  where recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000411'
    and room_override and room = 'QA-Override-Room' and status = 'SCHEDULED'
), 1, 'generator preserves an occurrence-specific room override');
select ok((
  select count(*) > 0 from public.sessions
  where recurrence_schedule_id = 'f0440000-0000-0000-0000-000000000411'
    and not room_override and room = 'QA-Recurring-A2' and status = 'SCHEDULED'
), 'generator copies the edited room to non-overridden occurrences');

select like(pg_get_functiondef('public.admin_create_session(uuid,timestamptz,timestamptz,uuid[],text)'::regprocedure), '%pg_advisory_xact_lock%',
  'manual creation serializes its room conflict check');
select like(pg_get_functiondef('public.admin_apply_week_to_month(uuid[],date)'::regprocedure), '%pg_advisory_xact_lock%',
  'weekly copy serializes its room conflict check');
select like(pg_get_functiondef('public.admin_update_session_occurrence(uuid,timestamptz,timestamptz,boolean,text)'::regprocedure), '%pg_advisory_xact_lock%',
  'rescheduling serializes its room conflict check');
select like(pg_get_functiondef('public.generate_upcoming_sessions(integer)'::regprocedure), '%pg_advisory_xact_lock%',
  'recurring generation serializes its room conflict check');
select like(pg_get_functiondef('public.admin_update_session_teachers(uuid,uuid[])'::regprocedure), '%pg_advisory_xact_lock%',
  'teacher changes serialize with session planning');

select * from finish();
rollback;
