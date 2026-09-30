begin;

select plan(26);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0410000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-schedule-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0410000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-schedule-teacher-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0410000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-schedule-teacher-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0410000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-schedule-student-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0410000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-schedule-student-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status) values
  ('f0410000-0000-0000-0000-000000000001', 'ADMIN', 'QA-SCHEDULE-ADMIN', 'QA Schedule Admin', 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000002', 'TEACHER', 'QA-SCHEDULE-TEACHER-A', 'QA Schedule Teacher A', 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000003', 'TEACHER', 'QA-SCHEDULE-TEACHER-B', 'QA Schedule Teacher B', 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000004', 'STUDENT', 'QA-SCHEDULE-STUDENT-A', 'QA Schedule Student A', 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000005', 'STUDENT', 'QA-SCHEDULE-STUDENT-B', 'QA Schedule Student B', 'ACTIVE');

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0410000-0000-0000-0000-000000000101', 'f0410000-0000-0000-0000-000000000002', 'QA-SCHEDULE-T-1', 'TEACHER', 'QA Schedule Teacher A', 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000102', 'f0410000-0000-0000-0000-000000000003', 'QA-SCHEDULE-T-2', 'TEACHER', 'QA Schedule Teacher B', 'ACTIVE');

insert into public.students (id, user_id, student_code, full_name, status) values
  ('f0410000-0000-0000-0000-000000000201', 'f0410000-0000-0000-0000-000000000004', 'QA-SCHEDULE-S-1', 'QA Schedule Student A', 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000202', 'f0410000-0000-0000-0000-000000000005', 'QA-SCHEDULE-S-2', 'QA Schedule Student B', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0410000-0000-0000-0000-000000000301', 'QA-SCHEDULE-SUBJECT', 'QA Schedule Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0410000-0000-0000-0000-000000000302', 'QA-SCHEDULE-GRADE', 'QA Schedule Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values
  ('f0410000-0000-0000-0000-000000000303', 'QA-SCHEDULE-CLASS', 'QA Schedule Class', 'f0410000-0000-0000-0000-000000000301', 'f0410000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000304', 'QA-SCHEDULE-CONFLICT', 'QA Schedule Conflict', 'f0410000-0000-0000-0000-000000000301', 'f0410000-0000-0000-0000-000000000302', 'ACTIVE');

insert into public.class_memberships (class_id, student_id, start_date, status) values
  ('f0410000-0000-0000-0000-000000000303', 'f0410000-0000-0000-0000-000000000201', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE'),
  ('f0410000-0000-0000-0000-000000000303', 'f0410000-0000-0000-0000-000000000202', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0410000-0000-0000-0000-000000000001', true);

select lives_ok($$
  select public.admin_create_session(
    'f0410000-0000-0000-0000-000000000303',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0410000-0000-0000-0000-000000000101'::uuid]
  )
$$, 'Admin can create a manually scheduled session');

select is((
  select manual_schedule from public.sessions
  where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule
  order by created_at desc limit 1
), true, 'created session is marked manual');
select is((
  select count(*)::integer from public.session_students ss
  join public.sessions s on s.id = ss.session_id
  where s.class_id = 'f0410000-0000-0000-0000-000000000303' and s.manual_schedule
), 2, 'manual session snapshots the active roster');
select is((
  select count(*)::integer from public.session_staff sf
  join public.sessions s on s.id = sf.session_id
  where s.class_id = 'f0410000-0000-0000-0000-000000000303' and s.manual_schedule
    and sf.staff_id = 'f0410000-0000-0000-0000-000000000101'
), 1, 'manual session receives its assigned teacher');

select lives_ok($$
  select public.admin_update_session_teachers(
    (select id from public.sessions where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule order by created_at desc limit 1),
    array['f0410000-0000-0000-0000-000000000102'::uuid]
  )
$$, 'Admin can override teachers for a single session');
select is((
  select staff_assignment_override from public.sessions
  where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule
  order by created_at desc limit 1
), true, 'individual teacher change is marked as an override');
select is((
  select count(*)::integer from public.session_staff sf
  join public.sessions s on s.id = sf.session_id
  where s.class_id = 'f0410000-0000-0000-0000-000000000303' and s.manual_schedule
    and sf.staff_id = 'f0410000-0000-0000-0000-000000000102'
), 1, 'teacher override replaces the previous assignment');

select throws_ok($$
  select public.admin_create_session(
    'f0410000-0000-0000-0000-000000000303',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
    array['f0410000-0000-0000-0000-000000000102'::uuid]
  )
$$, 'P0001', 'SCHEDULE_CONFLICT', 'Admin create rejects an overlapping class, teacher, or roster slot');

reset role;
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status)
select
  'f0410000-0000-0000-0000-000000000405',
  'f0410000-0000-0000-0000-000000000304',
  (d::date + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
  (d::date + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
  'SCHEDULED'
from generate_series(
  date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date,
  (date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '2 months')) - interval '1 day')::date,
  interval '1 day'
) d
where extract(isodow from d)::integer = extract(isodow from ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2))::integer
order by d limit 1;
insert into public.session_staff (session_id, staff_id, assignment_role)
values ('f0410000-0000-0000-0000-000000000405', 'f0410000-0000-0000-0000-000000000102', 'TEACHER');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0410000-0000-0000-0000-000000000001', true);
select throws_ok($$
  select public.admin_apply_week_to_month(
    array[(select id from public.sessions where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule order by created_at desc limit 1)],
    date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
  )
$$, 'P0001', format('SCHEDULE_CONFLICT: %s', (
  select d::date from generate_series(
    date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date,
    (date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '2 months')) - interval '1 day')::date,
    interval '1 day'
  ) d
  where extract(isodow from d)::integer = extract(isodow from ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2))::integer
  order by d limit 1
)), 'week copy rejects a conflict with the conflicting local calendar date');
select is((
  select count(*)::integer from public.sessions
  where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule
    and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
), 0, 'failed month copy rolls back every inserted session');

reset role;
delete from public.session_staff where session_id = 'f0410000-0000-0000-0000-000000000405';
delete from public.sessions where id = 'f0410000-0000-0000-0000-000000000405';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0410000-0000-0000-0000-000000000001', true);

select lives_ok($$
  select public.admin_apply_week_to_month(
    array[(select id from public.sessions where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule order by created_at desc limit 1)],
    date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
  )
$$, 'Admin can copy a source week into the selected month');
select ok((
  select count(*) > 0 from public.sessions
  where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule
    and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
), 'month copy creates date-specific sessions');
select is((
  select count(*)::integer from public.sessions s
  join public.session_staff sf on sf.session_id = s.id
  where s.class_id = 'f0410000-0000-0000-0000-000000000303' and s.manual_schedule
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
    and sf.staff_id = 'f0410000-0000-0000-0000-000000000102'
), (
  select count(*)::integer from public.sessions s
  where s.class_id = 'f0410000-0000-0000-0000-000000000303' and s.manual_schedule
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
), 'month copies inherit the source-week teacher');
select is((
  select count(*)::integer from public.sessions s
  where s.class_id = 'f0410000-0000-0000-0000-000000000303' and s.manual_schedule
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
), (
  select count(*)::integer from public.sessions s
  where s.class_id = 'f0410000-0000-0000-0000-000000000303' and s.manual_schedule
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date_trunc('month', ((now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month'))::date
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time = time '17:30'
    and (s.scheduled_end_at at time zone 'Asia/Ho_Chi_Minh')::time = time '19:30'
), 'month copies preserve local wall-clock times across the month boundary');

reset role;
insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, status, reviewed_at)
values (
  'f0410000-0000-0000-0000-000000000401',
  'f0410000-0000-0000-0000-000000000303',
  extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh')::date)::smallint,
  '08:00', '09:00', 'ACTIVE', now()
), (
  'f0410000-0000-0000-0000-000000000402',
  'f0410000-0000-0000-0000-000000000303',
  extract(isodow from ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2))::smallint,
  '17:30', '19:30', 'ACTIVE', now()
);
insert into public.class_schedule_staff (schedule_id, staff_id)
values
  ('f0410000-0000-0000-0000-000000000401', 'f0410000-0000-0000-0000-000000000101'),
  ('f0410000-0000-0000-0000-000000000402', 'f0410000-0000-0000-0000-000000000101');

with upcoming_occurrences as (
  select d::date as occurrence_date, row_number() over (order by d)::integer as position
  from generate_series(
    (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1,
    (now() at time zone 'Asia/Ho_Chi_Minh')::date + 30,
    interval '1 day'
  ) d
  where extract(isodow from d)::integer = extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh')::date)::integer
  order by d limit 2
)
insert into public.sessions (id, class_id, recurrence_schedule_id, recurrence_occurrence_date, scheduled_start_at, scheduled_end_at, status)
select
  case when position = 1 then 'f0410000-0000-0000-0000-000000000403'::uuid else 'f0410000-0000-0000-0000-000000000404'::uuid end,
  'f0410000-0000-0000-0000-000000000303', 'f0410000-0000-0000-0000-000000000401', occurrence_date,
  (occurrence_date + time '08:00') at time zone 'Asia/Ho_Chi_Minh',
  (occurrence_date + time '09:00') at time zone 'Asia/Ho_Chi_Minh',
  case when position = 1 then 'COMPLETED'::public.session_status else 'IN_PROGRESS'::public.session_status end
from upcoming_occurrences;
insert into public.session_students (session_id, student_id)
values ('f0410000-0000-0000-0000-000000000403', 'f0410000-0000-0000-0000-000000000201');
insert into public.student_attendances (session_id, student_id, status, comment, updated_by)
values ('f0410000-0000-0000-0000-000000000403', 'f0410000-0000-0000-0000-000000000201', 'PRESENT', 'QA attendance fixture', 'f0410000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0410000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.generate_upcoming_sessions(30)$$, 'recurring generation remains callable');
select is((
  select count(*)::integer from public.sessions
  where id in ('f0410000-0000-0000-0000-000000000403', 'f0410000-0000-0000-0000-000000000404')
    and status in ('COMPLETED', 'IN_PROGRESS')
), 2, 'recurring generation preserves completed and started sessions');
select is((
  select count(*)::integer from public.student_attendances
  where session_id = 'f0410000-0000-0000-0000-000000000403' and comment = 'QA attendance fixture'
), 1, 'recurring generation preserves completed attendance data');
select is((
  select count(*)::integer from public.sessions
  where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule
    and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date + 2
    and recurrence_schedule_id is null and status = 'SCHEDULED'
), 1, 'recurring generator does not attach or modify a manual source session');
select lives_ok($$
  select public.admin_update_session_teachers(
    (select id from public.sessions where recurrence_schedule_id = 'f0410000-0000-0000-0000-000000000401' and status = 'SCHEDULED' order by scheduled_start_at limit 1),
    array['f0410000-0000-0000-0000-000000000102'::uuid]
  )
$$, 'Admin can set a teacher override on a recurring occurrence');
select lives_ok($$select public.generate_upcoming_sessions(30)$$, 'recurring generation runs after a one-session teacher override');
select is((
  select count(*)::integer from public.sessions s
  join public.session_staff sf on sf.session_id = s.id
  where s.recurrence_schedule_id = 'f0410000-0000-0000-0000-000000000401'
    and s.staff_assignment_override and sf.staff_id = 'f0410000-0000-0000-0000-000000000102'
), 1, 'recurring generator preserves a per-session teacher override');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0410000-0000-0000-0000-000000000002', true);
select throws_ok($$
  select public.admin_update_session_teachers(
    (select id from public.sessions where recurrence_schedule_id = 'f0410000-0000-0000-0000-000000000401' and status = 'SCHEDULED' order by scheduled_start_at limit 1),
    array['f0410000-0000-0000-0000-000000000101'::uuid]
  )
$$, 'P0001', 'FORBIDDEN', 'teacher cannot change session assignments');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0410000-0000-0000-0000-000000000001', true);
update public.class_schedules
set status = 'ARCHIVED', reviewed_at = null, reviewed_by = null
where id = 'f0410000-0000-0000-0000-000000000401';
select lives_ok($$select public.generate_upcoming_sessions(30)$$, 'generator runs after a recurring schedule is archived');
select is((
  select count(*)::integer from public.sessions
  where recurrence_schedule_id = 'f0410000-0000-0000-0000-000000000401'
    and scheduled_start_at > now() and status = 'SCHEDULED'
), 0, 'archiving cancels every future scheduled occurrence, including teacher overrides');
select is((
  select count(*)::integer from public.sessions
  where id in ('f0410000-0000-0000-0000-000000000403', 'f0410000-0000-0000-0000-000000000404')
    and status in ('COMPLETED', 'IN_PROGRESS')
), 2, 'archiving leaves completed and in-progress history intact');
select is((
  select count(*)::integer from public.sessions
  where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule and status = 'SCHEDULED'
), (
  select count(*)::integer from public.sessions
  where class_id = 'f0410000-0000-0000-0000-000000000303' and manual_schedule
), 'recurring generation leaves manual sessions scheduled');

reset role;
select ok(
  not has_function_privilege('anon', 'public.admin_create_session(uuid,timestamp with time zone,timestamp with time zone,uuid[])', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_apply_week_to_month(uuid[],date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_update_session_teachers(uuid,uuid[])', 'EXECUTE'),
  'anonymous role cannot execute Admin scheduling RPCs'
);

select * from finish();
rollback;
