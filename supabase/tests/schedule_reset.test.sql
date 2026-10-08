begin;

select plan(40);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0510000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-schedule-delete-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0510000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-schedule-delete-denied@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0510000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-schedule-delete-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0510000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-schedule-delete-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0510000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-SCHEDULE-DELETE-ADMIN', 'QA Schedule Delete Admin', 'ACTIVE', false),
  ('f0510000-0000-0000-0000-000000000002', 'TEACHER', 'QA-SCHEDULE-DELETE-DENIED', 'QA Schedule Delete Denied', 'ACTIVE', false),
  ('f0510000-0000-0000-0000-000000000003', 'STUDENT', 'QA-SCHEDULE-DELETE-STUDENT', 'QA Schedule Delete Student', 'ACTIVE', false),
  ('f0510000-0000-0000-0000-000000000004', 'TEACHER', 'QA-SCHEDULE-DELETE-TEACHER', 'QA Schedule Delete Teacher', 'ACTIVE', false);

insert into public.students (id, user_id, student_code, full_name, status)
values ('f0510000-0000-0000-0000-000000000301', 'f0510000-0000-0000-0000-000000000003', 'QA-SCHEDULE-DELETE-S1', 'QA Schedule Delete Student', 'ACTIVE');
insert into public.staff (id, user_id, staff_code, staff_type, full_name, status)
values ('f0510000-0000-0000-0000-000000000302', 'f0510000-0000-0000-0000-000000000004', 'QA-SCHEDULE-DELETE-T1', 'TEACHER', 'QA Schedule Delete Teacher', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0510000-0000-0000-0000-000000000401', 'QA-SCHEDULE-DELETE-SUBJECT', 'QA Schedule Delete Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0510000-0000-0000-0000-000000000402', 'QA-SCHEDULE-DELETE-GRADE', 'QA Schedule Delete Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0510000-0000-0000-0000-000000000501', 'QA-SCHEDULE-DELETE-CLASS', 'QA Schedule Delete Class', 'f0510000-0000-0000-0000-000000000401', 'f0510000-0000-0000-0000-000000000402', 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, status, reviewed_at, reviewed_by)
values
  ('f0510000-0000-0000-0000-000000000601', 'f0510000-0000-0000-0000-000000000501', 1, '17:30', '19:30', 'ACTIVE', now(), 'f0510000-0000-0000-0000-000000000001'),
  ('f0510000-0000-0000-0000-000000000602', 'f0510000-0000-0000-0000-000000000501', 2, '17:30', '19:30', 'INACTIVE', null, null);

insert into public.class_schedule_staff (schedule_id, staff_id)
values ('f0510000-0000-0000-0000-000000000601', 'f0510000-0000-0000-0000-000000000302');

with month_anchor as (
  select date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date as month_start
), session_rows(id, schedule_id, day_offset, status, manual_schedule) as (
  values
    ('f0510000-0000-0000-0000-000000000701'::uuid, 'f0510000-0000-0000-0000-000000000601'::uuid, -1, 'SCHEDULED'::public.session_status, false),
    ('f0510000-0000-0000-0000-000000000702'::uuid, null::uuid, 2, 'SCHEDULED'::public.session_status, true),
    ('f0510000-0000-0000-0000-000000000703'::uuid, null::uuid, 35, 'SCHEDULED'::public.session_status, true),
    ('f0510000-0000-0000-0000-000000000704'::uuid, 'f0510000-0000-0000-0000-000000000602'::uuid, 36, 'SCHEDULED'::public.session_status, false),
    ('f0510000-0000-0000-0000-000000000705'::uuid, 'f0510000-0000-0000-0000-000000000601'::uuid, 4, 'IN_PROGRESS'::public.session_status, false),
    ('f0510000-0000-0000-0000-000000000706'::uuid, 'f0510000-0000-0000-0000-000000000601'::uuid, 5, 'COMPLETED'::public.session_status, false),
    ('f0510000-0000-0000-0000-000000000707'::uuid, null::uuid, 6, 'CANCELLED'::public.session_status, true),
    ('f0510000-0000-0000-0000-000000000708'::uuid, null::uuid, 7, 'SCHEDULED'::public.session_status, true)
)
insert into public.sessions (
  id, class_id, recurrence_schedule_id, recurrence_occurrence_date,
  scheduled_start_at, scheduled_end_at, status, manual_schedule
)
select r.id, 'f0510000-0000-0000-0000-000000000501', r.schedule_id,
  case when r.schedule_id is null then null else a.month_start + r.day_offset end,
  ((a.month_start + r.day_offset) + time '17:30') at time zone 'Asia/Ho_Chi_Minh',
  ((a.month_start + r.day_offset) + time '19:30') at time zone 'Asia/Ho_Chi_Minh',
  r.status, r.manual_schedule
from session_rows r cross join month_anchor a;

insert into public.session_students (session_id, student_id)
values
  ('f0510000-0000-0000-0000-000000000702', 'f0510000-0000-0000-0000-000000000301'),
  ('f0510000-0000-0000-0000-000000000706', 'f0510000-0000-0000-0000-000000000301'),
  ('f0510000-0000-0000-0000-000000000708', 'f0510000-0000-0000-0000-000000000301');
update public.session_students
set assessment_snapshot = jsonb_build_object('QA- result', 'preserve')
where session_id in ('f0510000-0000-0000-0000-000000000702', 'f0510000-0000-0000-0000-000000000706');
insert into public.session_staff (session_id, staff_id, assignment_role)
values ('f0510000-0000-0000-0000-000000000702', 'f0510000-0000-0000-0000-000000000302', 'TEACHER');
insert into public.student_attendances (session_id, student_id, status)
values
  ('f0510000-0000-0000-0000-000000000706', 'f0510000-0000-0000-0000-000000000301', 'PRESENT'),
  ('f0510000-0000-0000-0000-000000000708', 'f0510000-0000-0000-0000-000000000301', 'PRESENT');

select ok(
  has_function_privilege('authenticated', 'public.admin_preview_schedule_reset_for_month(date)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_delete_schedule_reset_for_month(date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_preview_schedule_reset_for_month(date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_delete_schedule_reset_for_month(date)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.admin_reset_all_schedules()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.admin_preview_all_schedules_reset()', 'EXECUTE'),
  'only authenticated callers may use the new Admin RPCs and the old global reset is disabled'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0510000-0000-0000-0000-000000000002', true);
select throws_ok($$ select public.admin_preview_schedule_reset_for_month(date '2026-10-01') $$, 'P0001', 'FORBIDDEN', 'a caller without CLASS_MANAGE cannot preview deletion');
select throws_ok($$ select public.admin_delete_schedule_reset_for_month(date '2026-10-01') $$, 'P0001', 'FORBIDDEN', 'a caller without CLASS_MANAGE cannot delete schedules');

select set_config('request.jwt.claim.sub', 'f0510000-0000-0000-0000-000000000001', true);
select throws_ok($$ select public.admin_preview_schedule_reset_for_month(date '2026-10-02') $$, 'P0001', 'INVALID_INPUT', 'preview requires the first day of a month');
select throws_ok($$ select public.admin_delete_schedule_reset_for_month(date '2026-10-02') $$, 'P0001', 'INVALID_INPUT', 'delete requires the first day of a month');

with month_anchor as (
  select date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date as month_start
), preview as materialized (
  select public.admin_preview_schedule_reset_for_month(month_start) as result from month_anchor
)
select
  is((result->>'schedule_count')::integer, 2, 'preview counts every recurring schedule across all classes and statuses'),
  is((result->>'recurring_session_count')::integer, 2, 'preview counts generated scheduled sessions at all dates'),
  is((result->>'month_manual_session_count')::integer, 2, 'preview counts manual scheduled sessions in the selected Vietnam month'),
  is((result->>'protected_session_count')::integer, 2, 'preview identifies scheduled sessions with linked attendance or assessment history')
from preview;
select is((select count(*)::integer from public.class_schedules), 2, 'preview does not delete schedules');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED'), 5, 'preview does not delete sessions');

select throws_ok(
  $$ select public.admin_delete_schedule_reset_for_month(date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date) $$,
  'P0001', 'RESET_PROTECTED_HISTORY', 'delete refuses the whole operation when a target session has attendance history'
);
reset role;
select is((select count(*)::integer from public.class_schedules), 2, 'a protected-history rejection leaves schedules unchanged');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED'), 5, 'a protected-history rejection leaves sessions unchanged');
select is((select count(*)::integer from public.audit_logs where action = 'SESSION_BULK_RESET_DELETE'), 0, 'a rejected delete leaves no audit or partial deletion');

delete from public.student_attendances where session_id = 'f0510000-0000-0000-0000-000000000708';
update public.session_students
set assessment_snapshot = '{}'::jsonb
where session_id = 'f0510000-0000-0000-0000-000000000702';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0510000-0000-0000-0000-000000000001', true);
with month_anchor as (
  select date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date as month_start
), preview as materialized (
  select public.admin_preview_schedule_reset_for_month(month_start) as result from month_anchor
)
select is((result->>'protected_session_count')::integer, 0, 'preview clears the protection count after the QA attendance link is removed')
from preview;

with month_anchor as (
  select date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date as month_start
), deletion as materialized (
  select public.admin_delete_schedule_reset_for_month(month_start) as result from month_anchor
)
select
  is((result->>'deleted_schedules')::integer, 2, 'delete returns the actual schedule count'),
  is((result->>'deleted_recurring_sessions')::integer, 2, 'delete returns generated sessions from every month'),
  is((result->>'deleted_month_manual_sessions')::integer, 2, 'delete returns manual sessions only from the selected month')
from deletion;

select is((select count(*)::integer from public.class_schedules), 0, 'all recurring schedules are physically deleted');
select is((select count(*)::integer from public.sessions where id = 'f0510000-0000-0000-0000-000000000701'), 0, 'an overdue generated scheduled session is deleted');
select is((select count(*)::integer from public.sessions where id = 'f0510000-0000-0000-0000-000000000704'), 0, 'a generated scheduled session outside the selected month is deleted');
select is((select count(*)::integer from public.sessions where id = 'f0510000-0000-0000-0000-000000000702'), 0, 'a manual scheduled session in the selected month is deleted');
select is((select count(*)::integer from public.sessions where id = 'f0510000-0000-0000-0000-000000000708'), 0, 'a previously protected manual session is deleted only after its QA history link is removed');
select is((select status::text from public.sessions where id = 'f0510000-0000-0000-0000-000000000703'), 'SCHEDULED'::text, 'a manual scheduled session outside the selected month is preserved');
select is((select status::text from public.sessions where id = 'f0510000-0000-0000-0000-000000000705'), 'IN_PROGRESS'::text, 'an in-progress session is preserved');
select is((select status::text from public.sessions where id = 'f0510000-0000-0000-0000-000000000706'), 'COMPLETED'::text, 'a completed session is preserved');
select is((select status::text from public.sessions where id = 'f0510000-0000-0000-0000-000000000707'), 'CANCELLED'::text, 'a previously cancelled session is preserved');
select ok(
  (select recurrence_schedule_id is null
      and recurrence_schedule_snapshot->>'schedule_id' = 'f0510000-0000-0000-0000-000000000601'
      and recurrence_schedule_snapshot->>'start_time' = '17:30:00'
   from public.sessions where id = 'f0510000-0000-0000-0000-000000000705')
  and (select recurrence_schedule_id is null
      and recurrence_schedule_snapshot->>'schedule_id' = 'f0510000-0000-0000-0000-000000000601'
   from public.sessions where id = 'f0510000-0000-0000-0000-000000000706'),
  'preserved sessions retain schedule provenance snapshots after templates are deleted'
);
select is(
  (select assessment_snapshot from public.session_students where session_id = 'f0510000-0000-0000-0000-000000000706'),
  jsonb_build_object('QA- result', 'preserve'),
  'completed learning assessment remains attached to history'
);
select is((select count(*)::integer from public.student_attendances where session_id = 'f0510000-0000-0000-0000-000000000706'), 1, 'completed attendance remains attached to history');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED'), 1, 'only the manual scheduled session outside the selected month remains');
select lives_ok($$ select public.generate_upcoming_sessions(30) $$, 'the session generator still runs after the schedules are deleted');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED' and not manual_schedule), 0, 'deleted schedules do not generate new recurring sessions');
select is((select count(*)::integer from public.session_students where session_id = 'f0510000-0000-0000-0000-000000000702'), 0, 'the deleted manual session roster is removed to satisfy session foreign keys');
select is((select count(*)::integer from public.session_staff where session_id = 'f0510000-0000-0000-0000-000000000702'), 0, 'the deleted manual session assignments are removed to satisfy session foreign keys');
select is((select count(*)::integer from public.audit_logs where action = 'SESSION_BULK_RESET_DELETE'), 4, 'every deleted session has an audit record');
select is((select count(*)::integer from public.audit_logs where action = 'CLASS_SCHEDULE_BULK_RESET_DELETE'), 2, 'every deleted recurring schedule has an audit record');
select is(
  (select old_data->'staff_ids' from public.audit_logs
   where action = 'CLASS_SCHEDULE_BULK_RESET_DELETE' and entity_id = 'f0510000-0000-0000-0000-000000000601'),
  jsonb_build_array('f0510000-0000-0000-0000-000000000302'),
  'schedule deletion audit preserves its assigned teacher IDs'
);
select lives_ok($$
  insert into public.class_schedules (class_id, day_of_week, start_time, end_time, status)
  values ('f0510000-0000-0000-0000-000000000501', 1, '17:30', '19:30', 'INACTIVE')
$$, 'Admin can create a new schedule in a slot freed by deletion');

select * from finish();
rollback;
