begin;

select plan(15);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0620000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-session-delete-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0620000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-session-delete-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0620000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-session-delete-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0620000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-SESSION-DELETE-ADMIN', 'QA Session Delete Admin', 'ACTIVE', false),
  ('f0620000-0000-0000-0000-000000000002', 'TEACHER', 'QA-SESSION-DELETE-TEACHER', 'QA Session Delete Teacher', 'ACTIVE', false),
  ('f0620000-0000-0000-0000-000000000003', 'STUDENT', 'QA-SESSION-DELETE-STUDENT', 'QA Session Delete Student', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0620000-0000-0000-0000-000000000101', 'f0620000-0000-0000-0000-000000000002', 'QA-SESSION-DELETE-T1', 'TEACHER', 'QA Session Delete Teacher', 'ACTIVE'),
  ('f0620000-0000-0000-0000-000000000102', null, 'QA-SESSION-DELETE-T2', 'TEACHER', 'QA Session Delete Replacement', 'ACTIVE');
insert into public.students (id, user_id, student_code, full_name, status)
values ('f0620000-0000-0000-0000-000000000201', 'f0620000-0000-0000-0000-000000000003', 'QA-SESSION-DELETE-S1', 'QA Session Delete Student', 'ACTIVE');
insert into public.subjects (id, code, name, status)
values ('f0620000-0000-0000-0000-000000000301', 'QA-SESSION-DELETE-SUB', 'QA Session Delete Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0620000-0000-0000-0000-000000000302', 'QA-SESSION-DELETE-GRADE', 'QA Session Delete Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0620000-0000-0000-0000-000000000303', 'QA-SESSION-DELETE-CLASS', 'QA Session Delete Class', 'f0620000-0000-0000-0000-000000000301', 'f0620000-0000-0000-0000-000000000302', 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, status)
values (
  'f0620000-0000-0000-0000-000000000304',
  'f0620000-0000-0000-0000-000000000303',
  extract(isodow from ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 2))::smallint,
  '10:00', '12:00', 'ACTIVE'
);
insert into public.sessions (
  id, class_id, recurrence_schedule_id, recurrence_occurrence_date,
  scheduled_start_at, scheduled_end_at, status, started_at, ended_at,
  ended_by, session_note, import_metadata, revenue_snapshot
) values
  (
    'f0620000-0000-0000-0000-000000000401',
    'f0620000-0000-0000-0000-000000000303',
    'f0620000-0000-0000-0000-000000000304',
    (now() at time zone 'Asia/Ho_Chi_Minh')::date - 2,
    now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'COMPLETED',
    now() - interval '2 days', now() - interval '2 days' + interval '2 hours',
    'f0620000-0000-0000-0000-000000000001', 'QA completed session to delete', '{"source":"QA"}'::jsonb, 2000
  ),
  (
    'f0620000-0000-0000-0000-000000000402',
    'f0620000-0000-0000-0000-000000000303', null, null,
    now() + interval '1 day', now() + interval '1 day 2 hours', 'SCHEDULED',
    null, null, null, 'QA upcoming session has history', '{}'::jsonb, null
  ),
  (
    'f0620000-0000-0000-0000-000000000403',
    'f0620000-0000-0000-0000-000000000303', null, null,
    now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 'CANCELLED',
    null, null, null, null, '{}'::jsonb, null
  );
insert into public.session_students (
  session_id, student_id, monthly_fee_snapshot, session_unit_value, assessment_snapshot
) values (
  'f0620000-0000-0000-0000-000000000401',
  'f0620000-0000-0000-0000-000000000201',
  10000, 1000, '{"source":"QA assessment"}'::jsonb
);
insert into public.session_staff (session_id, staff_id, assignment_role, timesheet_eligible) values
  ('f0620000-0000-0000-0000-000000000401', 'f0620000-0000-0000-0000-000000000101', 'TEACHER', true);
insert into public.staff_replacements (session_id, original_staff_id, replacement_staff_id, reason, changed_by)
values ('f0620000-0000-0000-0000-000000000401', 'f0620000-0000-0000-0000-000000000101', 'f0620000-0000-0000-0000-000000000102', 'QA replacement', 'f0620000-0000-0000-0000-000000000001');
insert into public.student_attendances (session_id, student_id, status, homework_score, updated_by)
values ('f0620000-0000-0000-0000-000000000401', 'f0620000-0000-0000-0000-000000000201', 'PRESENT', 9, 'f0620000-0000-0000-0000-000000000001');
insert into public.timesheets (id, session_id, staff_id, status, approved_at, approved_by)
values ('f0620000-0000-0000-0000-000000000501', 'f0620000-0000-0000-0000-000000000401', 'f0620000-0000-0000-0000-000000000101', 'APPROVED', now(), 'f0620000-0000-0000-0000-000000000001');
insert into public.payroll_periods (id, year, month, status)
values ('f0620000-0000-0000-0000-000000000601', 2200, 12, 'DRAFT');
insert into public.payroll_items (
  id, payroll_period_id, staff_id, session_id, timesheet_id,
  salary_method, revenue_snapshot, salary_percentage, base_salary
) values (
  'f0620000-0000-0000-0000-000000000602', 'f0620000-0000-0000-0000-000000000601',
  'f0620000-0000-0000-0000-000000000101', 'f0620000-0000-0000-0000-000000000401',
  'f0620000-0000-0000-0000-000000000501', 'PERCENTAGE', 2000, 50, 1000
);
insert into public.month_week_schedule_templates (month_start, slots)
values (date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 2)::date, '[]'::jsonb);
insert into public.month_week_schedule_occurrences (month_start, slot_id, occurrence_date, session_id)
values (
  date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 2)::date,
  'f0620000-0000-0000-0000-000000000701',
  (now() at time zone 'Asia/Ho_Chi_Minh')::date - 2,
  'f0620000-0000-0000-0000-000000000401'
);
insert into public.session_students (session_id, student_id)
values ('f0620000-0000-0000-0000-000000000402', 'f0620000-0000-0000-0000-000000000201');

select ok(
  not has_function_privilege('anon', 'public.admin_preview_delete_session(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_preview_delete_session(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_delete_session(uuid)', 'EXECUTE'),
  'authenticated can call the permission-checked delete preview and RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0620000-0000-0000-0000-000000000001', true);

select is((public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'can_delete'), 'true'::text, 'completed session with linked records can be deleted after preview');
select ok(
  (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'session_students')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'session_staff')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'staff_replacements')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'attendances')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'timesheets')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'payroll_items')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'month_week_occurrences')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'financial_snapshot_rows')::integer = 1
  and (public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')->>'has_revenue_snapshot')::boolean,
  'preview reports all linked records and financial snapshots'
);
select is((public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000403')->>'blocked_reason'), 'SESSION_DELETE_NOT_ALLOWED'::text, 'cancelled session is outside the deletion scope');
select is((public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000402')->>'blocked_reason'), 'SESSION_HAS_HISTORY'::text, 'future scheduled session with history is blocked');
select throws_ok($$select public.admin_delete_session('f0620000-0000-0000-0000-000000000403')$$, 'P0001', 'SESSION_DELETE_NOT_ALLOWED', 'cancelled sessions cannot be deleted');
select throws_ok($$select public.admin_delete_session('f0620000-0000-0000-0000-000000000402')$$, 'P0001', 'SESSION_HAS_HISTORY', 'future scheduled session with history cannot be deleted');
select set_config('request.jwt.claim.sub', 'f0620000-0000-0000-0000-000000000002', true);
select throws_ok($$select public.admin_preview_delete_session('f0620000-0000-0000-0000-000000000401')$$, 'P0001', 'FORBIDDEN', 'teachers cannot preview Admin session deletion');
select throws_ok($$select public.admin_delete_session('f0620000-0000-0000-0000-000000000401')$$, 'P0001', 'FORBIDDEN', 'teachers cannot delete Admin sessions');
select set_config('request.jwt.claim.sub', 'f0620000-0000-0000-0000-000000000001', true);

select is((public.admin_delete_session('f0620000-0000-0000-0000-000000000401')->>'deleted'), 'true'::text, 'Admin confirms deletion atomically');
reset role;

select is((select count(*)::integer from public.sessions where id = 'f0620000-0000-0000-0000-000000000401'), 0, 'session row is deleted');
select ok(
  (select count(*) = 0 from public.session_students where session_id = 'f0620000-0000-0000-0000-000000000401')
  and (select count(*) = 0 from public.session_staff where session_id = 'f0620000-0000-0000-0000-000000000401')
  and (select count(*) = 0 from public.staff_replacements where session_id = 'f0620000-0000-0000-0000-000000000401')
  and (select count(*) = 0 from public.student_attendances where session_id = 'f0620000-0000-0000-0000-000000000401')
  and (select count(*) = 0 from public.timesheets where session_id = 'f0620000-0000-0000-0000-000000000401')
  and (select count(*) = 0 from public.payroll_items where session_id = 'f0620000-0000-0000-0000-000000000401')
  and (select count(*) = 0 from public.month_week_schedule_occurrences where session_id = 'f0620000-0000-0000-0000-000000000401'),
  'roster, teacher, replacement, attendance, timesheet, payroll item, and month occurrence rows are removed'
);
select is((select count(*)::integer from public.payroll_periods where id = 'f0620000-0000-0000-0000-000000000601'), 1, 'payroll period is retained');
select is((select count(*)::integer from public.audit_logs where entity_id = 'f0620000-0000-0000-0000-000000000401' and action = 'SESSION_DELETE'), 1, 'delete audit survives session removal');
select is((select count(*)::integer from public.deleted_session_occurrences where class_schedule_id = 'f0620000-0000-0000-0000-000000000304' and occurrence_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date - 2), 1, 'recurring occurrence tombstone survives session removal');

select * from finish();
rollback;
