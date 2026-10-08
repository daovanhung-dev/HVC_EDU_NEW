begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0520000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-delete-month-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0520000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-delete-month-denied@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0520000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-delete-month-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0520000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-delete-month-teacher-one@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0520000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-delete-month-teacher-two@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0520000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-DELETE-MONTH-ADMIN', 'QA Delete Month Admin', 'ACTIVE', false),
  ('f0520000-0000-0000-0000-000000000002', 'TEACHER', 'QA-DELETE-MONTH-DENIED', 'QA Delete Month Denied', 'ACTIVE', false),
  ('f0520000-0000-0000-0000-000000000003', 'STUDENT', 'QA-DELETE-MONTH-STUDENT', 'QA Delete Month Student', 'ACTIVE', false),
  ('f0520000-0000-0000-0000-000000000004', 'TEACHER', 'QA-DELETE-MONTH-T1', 'QA Delete Month Teacher One', 'ACTIVE', false),
  ('f0520000-0000-0000-0000-000000000005', 'TEACHER', 'QA-DELETE-MONTH-T2', 'QA Delete Month Teacher Two', 'ACTIVE', false);

insert into public.students (id, user_id, student_code, full_name, status)
values ('f0520000-0000-0000-0000-000000000301', 'f0520000-0000-0000-0000-000000000003', 'QA-DELETE-MONTH-S1', 'QA Delete Month Student', 'ACTIVE');
insert into public.staff (id, user_id, staff_code, staff_type, full_name, status)
values
  ('f0520000-0000-0000-0000-000000000302', 'f0520000-0000-0000-0000-000000000004', 'QA-DELETE-MONTH-T1', 'TEACHER', 'QA Delete Month Teacher One', 'ACTIVE'),
  ('f0520000-0000-0000-0000-000000000303', 'f0520000-0000-0000-0000-000000000005', 'QA-DELETE-MONTH-T2', 'TEACHER', 'QA Delete Month Teacher Two', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0520000-0000-0000-0000-000000000401', 'QA-DELETE-MONTH-SUBJECT', 'QA Delete Month Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0520000-0000-0000-0000-000000000402', 'QA-DELETE-MONTH-GRADE', 'QA Delete Month Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values
  ('f0520000-0000-0000-0000-000000000501', 'QA-DELETE-MONTH-CLASS-1', 'QA Delete Month Class One', 'f0520000-0000-0000-0000-000000000401', 'f0520000-0000-0000-0000-000000000402', 'ACTIVE'),
  ('f0520000-0000-0000-0000-000000000502', 'QA-DELETE-MONTH-CLASS-2', 'QA Delete Month Class Two', 'f0520000-0000-0000-0000-000000000401', 'f0520000-0000-0000-0000-000000000402', 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, status, reviewed_at, reviewed_by)
values
  ('f0520000-0000-0000-0000-000000000601', 'f0520000-0000-0000-0000-000000000501', 1, '17:30', '19:30', 'ACTIVE', now(), 'f0520000-0000-0000-0000-000000000001'),
  ('f0520000-0000-0000-0000-000000000602', 'f0520000-0000-0000-0000-000000000502', 2, '17:30', '19:30', 'INACTIVE', null, null),
  ('f0520000-0000-0000-0000-000000000603', 'f0520000-0000-0000-0000-000000000501', 3, '18:00', '20:00', 'ARCHIVED', null, null);
insert into public.class_schedule_staff (schedule_id, staff_id)
values
  ('f0520000-0000-0000-0000-000000000601', 'f0520000-0000-0000-0000-000000000302'),
  ('f0520000-0000-0000-0000-000000000602', 'f0520000-0000-0000-0000-000000000303');

insert into public.sessions (
  id, class_id, recurrence_schedule_id, recurrence_occurrence_date,
  scheduled_start_at, scheduled_end_at, status, manual_schedule
) values
  ('f0520000-0000-0000-0000-000000000701', 'f0520000-0000-0000-0000-000000000501', 'f0520000-0000-0000-0000-000000000601', '2026-10-01', ('2026-10-01 00:05'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-10-01 01:05'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'SCHEDULED', false),
  ('f0520000-0000-0000-0000-000000000702', 'f0520000-0000-0000-0000-000000000501', null, null, ('2026-10-15 17:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-10-15 19:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'SCHEDULED', true),
  ('f0520000-0000-0000-0000-000000000703', 'f0520000-0000-0000-0000-000000000501', null, null, ('2026-11-01 00:01'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-11-01 01:01'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'SCHEDULED', true),
  ('f0520000-0000-0000-0000-000000000704', 'f0520000-0000-0000-0000-000000000502', 'f0520000-0000-0000-0000-000000000602', '2026-11-02', ('2026-11-02 17:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-11-02 19:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'SCHEDULED', false),
  ('f0520000-0000-0000-0000-000000000705', 'f0520000-0000-0000-0000-000000000502', 'f0520000-0000-0000-0000-000000000602', '2026-10-31', ('2026-10-31 17:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-10-31 19:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'IN_PROGRESS', false),
  ('f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000501', 'f0520000-0000-0000-0000-000000000601', '2026-10-30', ('2026-10-30 17:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-10-30 19:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'COMPLETED', false),
  ('f0520000-0000-0000-0000-000000000707', 'f0520000-0000-0000-0000-000000000502', null, null, ('2026-10-02 17:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-10-02 19:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'CANCELLED', true),
  ('f0520000-0000-0000-0000-000000000708', 'f0520000-0000-0000-0000-000000000501', null, null, ('2026-10-31 17:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-10-31 19:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'SCHEDULED', true),
  ('f0520000-0000-0000-0000-000000000709', 'f0520000-0000-0000-0000-000000000501', 'f0520000-0000-0000-0000-000000000601', '2026-09-30', ('2026-09-30 17:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), ('2026-09-30 19:30'::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'COMPLETED', false);

insert into public.session_students (session_id, student_id)
values
  ('f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000301'),
  ('f0520000-0000-0000-0000-000000000708', 'f0520000-0000-0000-0000-000000000301'),
  ('f0520000-0000-0000-0000-000000000709', 'f0520000-0000-0000-0000-000000000301');
update public.session_students
set assessment_snapshot = jsonb_build_object('QA- result', 'remove with target session')
where session_id in ('f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000708');
update public.session_students
set assessment_snapshot = jsonb_build_object('QA- result', 'preserve outside month')
where session_id = 'f0520000-0000-0000-0000-000000000709';

insert into public.session_staff (session_id, staff_id, assignment_role)
values
  ('f0520000-0000-0000-0000-000000000708', 'f0520000-0000-0000-0000-000000000302', 'TEACHER'),
  ('f0520000-0000-0000-0000-000000000709', 'f0520000-0000-0000-0000-000000000303', 'TEACHER');
insert into public.staff_replacements (id, session_id, original_staff_id, replacement_staff_id, reason, changed_by)
values ('f0520000-0000-0000-0000-000000000801', 'f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000302', 'f0520000-0000-0000-0000-000000000303', 'QA- replacement', 'f0520000-0000-0000-0000-000000000001');
insert into public.student_attendances (session_id, student_id, status)
values
  ('f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000301', 'PRESENT'),
  ('f0520000-0000-0000-0000-000000000708', 'f0520000-0000-0000-0000-000000000301', 'PRESENT'),
  ('f0520000-0000-0000-0000-000000000709', 'f0520000-0000-0000-0000-000000000301', 'PRESENT');

insert into public.timesheets (id, session_id, staff_id, status)
values
  ('f0520000-0000-0000-0000-000000000811', 'f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000302', 'PENDING'),
  ('f0520000-0000-0000-0000-000000000812', 'f0520000-0000-0000-0000-000000000709', 'f0520000-0000-0000-0000-000000000303', 'PENDING');
insert into public.payroll_periods (id, year, month)
values ('f0520000-0000-0000-0000-000000000821', 2026, 10);
insert into public.payroll_items (
  id, payroll_period_id, staff_id, session_id, timesheet_id, salary_method, fixed_amount, base_salary
) values
  ('f0520000-0000-0000-0000-000000000831', 'f0520000-0000-0000-0000-000000000821', 'f0520000-0000-0000-0000-000000000302', 'f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000811', 'FIXED', 1000, 1000),
  ('f0520000-0000-0000-0000-000000000832', 'f0520000-0000-0000-0000-000000000821', 'f0520000-0000-0000-0000-000000000303', 'f0520000-0000-0000-0000-000000000709', 'f0520000-0000-0000-0000-000000000812', 'FIXED', 1000, 1000);

select ok(
  has_function_privilege('authenticated', 'public.admin_preview_delete_sessions_for_month(date)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_delete_sessions_for_month(date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_preview_delete_sessions_for_month(date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_delete_sessions_for_month(date)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.admin_preview_schedule_reset_for_month(date)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.admin_delete_schedule_reset_for_month(date)', 'EXECUTE'),
  'only authenticated callers may execute the new Admin delete RPCs; reset RPCs are disabled'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0520000-0000-0000-0000-000000000002', true);
select throws_ok($$ select public.admin_preview_delete_sessions_for_month(date '2026-10-01') $$, 'P0001', 'FORBIDDEN', 'a caller without CLASS_MANAGE cannot preview deletion');
select throws_ok($$ select public.admin_delete_sessions_for_month(date '2026-10-01') $$, 'P0001', 'FORBIDDEN', 'a caller without CLASS_MANAGE cannot delete sessions');

select set_config('request.jwt.claim.sub', 'f0520000-0000-0000-0000-000000000001', true);
select throws_ok($$ select public.admin_preview_delete_sessions_for_month(date '2026-10-02') $$, 'P0001', 'INVALID_INPUT', 'preview requires the first day of a month');
select throws_ok($$ select public.admin_delete_sessions_for_month(date '2026-10-02') $$, 'P0001', 'INVALID_INPUT', 'delete requires the first day of a month');

with preview as materialized (
  select public.admin_preview_delete_sessions_for_month(date '2026-10-01') as result
)
select
  is((result->>'schedule_count')::integer, 3, 'preview counts recurring templates across all classes'),
  is((result->>'schedule_staff_count')::integer, 2, 'preview counts teachers assigned to recurring templates'),
  is((result->>'session_count')::integer, 6, 'preview counts every session in the selected Vietnam month'),
  is((result->'status_counts'->>'SCHEDULED')::integer, 3, 'preview counts scheduled sessions'),
  is((result->'status_counts'->>'IN_PROGRESS')::integer, 1, 'preview counts in-progress sessions'),
  is((result->'status_counts'->>'COMPLETED')::integer, 1, 'preview counts completed sessions'),
  is((result->'status_counts'->>'CANCELLED')::integer, 1, 'preview counts cancelled sessions'),
  is((result->>'session_student_count')::integer, 2, 'preview counts session rosters in month'),
  is((result->>'assessment_count')::integer, 2, 'preview counts learning results linked through the roster'),
  is((result->>'session_staff_count')::integer, 1, 'preview counts assigned staff'),
  is((result->>'staff_replacement_count')::integer, 1, 'preview counts staff replacements'),
  is((result->>'attendance_count')::integer, 2, 'preview counts attendance records'),
  is((result->>'timesheet_count')::integer, 1, 'preview counts timesheets'),
  is((result->>'payroll_item_count')::integer, 1, 'preview counts payroll items linked to target sessions')
from preview;

create or replace function public.qa_block_month_session_delete()
returns trigger
language plpgsql
as $$
begin
  if old.id = 'f0520000-0000-0000-0000-000000000701'::uuid then
    raise exception 'QA_DELETE_BLOCK';
  end if;
  return old;
end;
$$;
create trigger qa_block_month_session_delete
before delete on public.sessions
for each row execute function public.qa_block_month_session_delete();

select throws_ok(
  $$ select public.admin_delete_sessions_for_month(date '2026-10-01') $$,
  'P0001',
  'QA_DELETE_BLOCK',
  'a failure partway through deletion aborts the transaction'
);
select is((select count(*)::integer from public.sessions where (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date '2026-10-01' and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < date '2026-11-01'), 6, 'failed deletion leaves all target sessions intact');
select is((select count(*)::integer from public.class_schedules), 3, 'failed deletion leaves all recurring templates intact');
select is((select count(*)::integer from public.payroll_items where session_id = 'f0520000-0000-0000-0000-000000000706'), 1, 'failed deletion restores dependent payroll items');
select is((select count(*)::integer from public.audit_logs where action in ('SESSION_MONTH_BULK_DELETE', 'CLASS_SCHEDULE_BULK_DELETE')), 0, 'failed deletion rolls back its audit records');
drop trigger qa_block_month_session_delete on public.sessions;
drop function public.qa_block_month_session_delete();

with deletion as materialized (
  select public.admin_delete_sessions_for_month(date '2026-10-01') as result
)
select
  is((result->>'deleted_sessions')::integer, 6, 'delete returns all removed sessions'),
  is((result->>'deleted_schedules')::integer, 3, 'delete returns the global recurring-template count'),
  is((result->>'deleted_schedule_staff')::integer, 2, 'delete returns the removed recurring-template teacher assignments'),
  is((result->'deleted_status_counts'->>'SCHEDULED')::integer, 3, 'delete returns scheduled count'),
  is((result->'deleted_status_counts'->>'IN_PROGRESS')::integer, 1, 'delete returns in-progress count'),
  is((result->'deleted_status_counts'->>'COMPLETED')::integer, 1, 'delete returns completed count'),
  is((result->'deleted_status_counts'->>'CANCELLED')::integer, 1, 'delete returns cancelled count'),
  is((result->>'deleted_session_students')::integer, 2, 'delete removes target session rosters and learning results'),
  is((result->>'deleted_session_staff')::integer, 1, 'delete removes target staff assignments'),
  is((result->>'deleted_staff_replacements')::integer, 1, 'delete removes target staff replacements'),
  is((result->>'deleted_attendances')::integer, 2, 'delete removes target attendance records'),
  is((result->>'deleted_timesheets')::integer, 1, 'delete removes target timesheets'),
  is((result->>'deleted_payroll_items')::integer, 1, 'delete removes target payroll items')
from deletion;

select is((select count(*)::integer from public.sessions where (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= date '2026-10-01' and (scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < date '2026-11-01'), 0, 'no session of any status remains in the selected Vietnam month');
select is((select count(*)::integer from public.class_schedules), 0, 'all recurring templates are physically deleted');
select is((select count(*)::integer from public.classes), 2, 'class records are preserved');
select is((select count(*)::integer from public.students where student_code = 'QA-DELETE-MONTH-S1'), 1, 'student profiles are preserved');
select is((select status::text from public.sessions where id = 'f0520000-0000-0000-0000-000000000703'), 'SCHEDULED'::text, 'manual session after the selected month is preserved');
select is((select status::text from public.sessions where id = 'f0520000-0000-0000-0000-000000000704'), 'SCHEDULED'::text, 'recurring session after the selected month is preserved');
select is((select status::text from public.sessions where id = 'f0520000-0000-0000-0000-000000000709'), 'COMPLETED'::text, 'completed session before the selected month is preserved');
select is((select count(*)::integer from public.student_attendances where session_id = 'f0520000-0000-0000-0000-000000000709'), 1, 'outside-month attendance is preserved');
select is((select count(*)::integer from public.timesheets where session_id = 'f0520000-0000-0000-0000-000000000709'), 1, 'outside-month timesheet is preserved');
select is((select count(*)::integer from public.payroll_items where session_id = 'f0520000-0000-0000-0000-000000000709'), 1, 'outside-month payroll item is preserved');
select ok(
  (select recurrence_schedule_id is null and recurrence_schedule_snapshot->>'schedule_id' = 'f0520000-0000-0000-0000-000000000602'
   from public.sessions where id = 'f0520000-0000-0000-0000-000000000704')
  and (select recurrence_schedule_id is null and recurrence_schedule_snapshot->>'schedule_id' = 'f0520000-0000-0000-0000-000000000601'
   from public.sessions where id = 'f0520000-0000-0000-0000-000000000709'),
  'outside-month sessions retain schedule provenance after templates are deleted'
);
select is((select count(*)::integer from public.audit_logs where action = 'SESSION_MONTH_BULK_DELETE'), 6, 'each deleted session is audited before deletion');
select is((select count(*)::integer from public.audit_logs where action = 'CLASS_SCHEDULE_BULK_DELETE'), 3, 'each deleted recurring template is audited before deletion');
select is((select count(*)::integer from public.session_students where session_id in ('f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000708')), 0, 'target learning snapshots are deleted');
select is((select count(*)::integer from public.student_attendances where session_id in ('f0520000-0000-0000-0000-000000000706', 'f0520000-0000-0000-0000-000000000708')), 0, 'target attendance rows are deleted');
select lives_ok($$ select public.generate_upcoming_sessions(30) $$, 'generator still runs after recurring templates are removed');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED' and not manual_schedule), 1, 'the generator does not recreate deleted recurring sessions');

reset role;
select * from finish();
rollback;
