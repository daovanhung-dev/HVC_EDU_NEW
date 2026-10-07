begin;

select plan(29);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0500000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-schedule-reset-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0500000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-schedule-reset-denied@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0500000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-schedule-reset-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0500000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-SCHEDULE-RESET-ADMIN', 'QA Schedule Reset Admin', 'ACTIVE', false),
  ('f0500000-0000-0000-0000-000000000002', 'TEACHER', 'QA-SCHEDULE-RESET-DENIED', 'QA Schedule Reset Denied', 'ACTIVE', false),
  ('f0500000-0000-0000-0000-000000000003', 'STUDENT', 'QA-SCHEDULE-RESET-STUDENT', 'QA Schedule Reset Student', 'ACTIVE', false);

insert into public.students (id, user_id, student_code, full_name, status)
values ('f0500000-0000-0000-0000-000000000301', 'f0500000-0000-0000-0000-000000000003', 'QA-SCHEDULE-RESET-S1', 'QA Schedule Reset Student', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0500000-0000-0000-0000-000000000401', 'QA-SCHEDULE-RESET-SUBJECT', 'QA Schedule Reset Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0500000-0000-0000-0000-000000000402', 'QA-SCHEDULE-RESET-GRADE', 'QA Schedule Reset Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0500000-0000-0000-0000-000000000501', 'QA-SCHEDULE-RESET-CLASS', 'QA Schedule Reset Class', 'f0500000-0000-0000-0000-000000000401', 'f0500000-0000-0000-0000-000000000402', 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, status, reviewed_at, reviewed_by)
values
  ('f0500000-0000-0000-0000-000000000601', 'f0500000-0000-0000-0000-000000000501', 1, '17:30', '19:30', 'ACTIVE', now(), 'f0500000-0000-0000-0000-000000000001'),
  ('f0500000-0000-0000-0000-000000000602', 'f0500000-0000-0000-0000-000000000501', 2, '17:30', '19:30', 'INACTIVE', null, null);

insert into public.sessions (id, class_id, recurrence_schedule_id, recurrence_occurrence_date, scheduled_start_at, scheduled_end_at, status, manual_schedule)
values
  ('f0500000-0000-0000-0000-000000000701', 'f0500000-0000-0000-0000-000000000501', 'f0500000-0000-0000-0000-000000000601', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1, now() - interval '1 day', now() - interval '22 hours', 'SCHEDULED', false),
  ('f0500000-0000-0000-0000-000000000702', 'f0500000-0000-0000-0000-000000000501', null, null, now() + interval '2 days', now() + interval '2 days' + interval '2 hours', 'SCHEDULED', true),
  ('f0500000-0000-0000-0000-000000000703', 'f0500000-0000-0000-0000-000000000501', null, null, now() + interval '4 days', now() + interval '4 days' + interval '2 hours', 'SCHEDULED', false),
  ('f0500000-0000-0000-0000-000000000704', 'f0500000-0000-0000-0000-000000000501', null, null, now() + interval '1 day', now() + interval '1 day' + interval '2 hours', 'IN_PROGRESS', true),
  ('f0500000-0000-0000-0000-000000000705', 'f0500000-0000-0000-0000-000000000501', null, null, now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'COMPLETED', true),
  ('f0500000-0000-0000-0000-000000000706', 'f0500000-0000-0000-0000-000000000501', null, null, now() + interval '3 days', now() + interval '3 days' + interval '2 hours', 'CANCELLED', true);

insert into public.session_students (session_id, student_id)
values ('f0500000-0000-0000-0000-000000000705', 'f0500000-0000-0000-0000-000000000301');
insert into public.student_attendances (session_id, student_id, status)
values ('f0500000-0000-0000-0000-000000000705', 'f0500000-0000-0000-0000-000000000301', 'PRESENT');

select ok(
  has_function_privilege('authenticated', 'public.admin_preview_all_schedules_reset()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_reset_all_schedules()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_preview_all_schedules_reset()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_reset_all_schedules()', 'EXECUTE'),
  'only authenticated callers receive RPC execute grants'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0500000-0000-0000-0000-000000000002', true);
select throws_ok($$ select public.admin_preview_all_schedules_reset() $$, 'P0001', 'FORBIDDEN', 'a caller without CLASS_MANAGE cannot preview a reset');
select throws_ok($$ select public.admin_reset_all_schedules() $$, 'P0001', 'FORBIDDEN', 'a caller without CLASS_MANAGE cannot execute a reset');

select set_config('request.jwt.claim.sub', 'f0500000-0000-0000-0000-000000000001', true);
select is((public.admin_preview_all_schedules_reset()->>'schedule_count')::integer, 2, 'preview counts all non-archived recurring schedules');
select is((public.admin_preview_all_schedules_reset()->>'session_count')::integer, 3, 'preview counts every scheduled session, including overdue and manual sessions');
select is((select count(*)::integer from public.class_schedules where status <> 'ARCHIVED'), 2, 'preview does not archive schedules');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED'), 3, 'preview does not cancel sessions');
reset role;
select is((select count(*)::integer from public.audit_logs where action = 'SESSION_BULK_RESET_CANCEL'), 0, 'preview does not write session audit records');
create or replace function public.qa_reject_schedule_reset_audit()
returns trigger
language plpgsql
as $$
begin
  if new.action = 'SESSION_BULK_RESET_CANCEL' then
    raise exception 'QA_AUDIT_REJECTED';
  end if;
  return new;
end;
$$;
create trigger qa_reject_schedule_reset_audit
before insert on public.audit_logs
for each row execute function public.qa_reject_schedule_reset_audit();

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0500000-0000-0000-0000-000000000001', true);
select throws_ok($$ select public.admin_reset_all_schedules() $$, 'P0001', 'QA_AUDIT_REJECTED', 'an audit failure aborts and rolls back the reset');
reset role;
select is((select count(*)::integer from public.class_schedules where status <> 'ARCHIVED'), 2, 'audit failure rolls schedule archival back');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED'), 3, 'audit failure rolls session cancellation back');
select is((select count(*)::integer from public.audit_logs where action = 'SESSION_BULK_RESET_CANCEL'), 0, 'failed reset leaves no partial session audit');
select is((select count(*)::integer from public.audit_logs where action = 'UPDATE_CLASS_SCHEDULES'), 0, 'failed reset rolls schedule audit records back');

drop trigger qa_reject_schedule_reset_audit on public.audit_logs;
drop function public.qa_reject_schedule_reset_audit();

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0500000-0000-0000-0000-000000000001', true);
with reset_result as materialized (
  select public.admin_reset_all_schedules() as result
)
select
  is((result->>'archived_schedules')::integer, 2, 'reset returns the actual number of archived schedules'),
  is((result->>'cancelled_sessions')::integer, 3, 'reset returns the actual number of cancelled sessions')
from reset_result;
select is((select count(*)::integer from public.class_schedules where status = 'ARCHIVED'), 2, 'all recurring schedules are archived');
select is((select count(*)::integer from public.class_schedules where status = 'ARCHIVED' and reviewed_at is null and reviewed_by is null), 2, 'archived schedules have review metadata cleared');
select is((select count(*)::integer from public.sessions where status = 'SCHEDULED'), 0, 'all scheduled sessions are cancelled regardless of date or origin');
select is((select status::text from public.sessions where id = 'f0500000-0000-0000-0000-000000000701'), 'CANCELLED'::text, 'an overdue recurring scheduled session is cancelled');
select is((select status::text from public.sessions where id = 'f0500000-0000-0000-0000-000000000702'), 'CANCELLED'::text, 'a future manually created scheduled session is cancelled');
select is((select status::text from public.sessions where id = 'f0500000-0000-0000-0000-000000000703'), 'CANCELLED'::text, 'a future scheduled session is cancelled');
select is((select status::text from public.sessions where id = 'f0500000-0000-0000-0000-000000000704'), 'IN_PROGRESS'::text, 'an in-progress session is preserved');
select is((select status::text from public.sessions where id = 'f0500000-0000-0000-0000-000000000705'), 'COMPLETED'::text, 'a completed session is preserved');
select is((select status::text from public.sessions where id = 'f0500000-0000-0000-0000-000000000706'), 'CANCELLED'::text, 'a previously cancelled session remains unchanged');
select is((select count(*)::integer from public.student_attendances where session_id = 'f0500000-0000-0000-0000-000000000705'), 1, 'existing attendance remains attached to completed history');
select is((select count(*)::integer from public.sessions), 6, 'reset does not physically delete session history');
select lives_ok($$
  insert into public.class_schedules (class_id, day_of_week, start_time, end_time, status)
  values ('f0500000-0000-0000-0000-000000000501', 1, '17:30', '19:30', 'INACTIVE')
$$, 'Admin can create a replacement schedule in a slot whose prior schedule was archived');
reset role;
select is((select count(*)::integer from public.audit_logs where action = 'SESSION_BULK_RESET_CANCEL'), 3, 'each newly cancelled session has an audit record');
select is((select count(*)::integer from public.audit_logs where action = 'UPDATE_CLASS_SCHEDULES'), 2, 'each archived recurring schedule has an audit record');

select * from finish();
rollback;
