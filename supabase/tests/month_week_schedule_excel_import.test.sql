begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0580000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-month-import-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0580000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-month-import-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0580000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-month-import-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0580000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-month-import-student-2@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0580000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-MONTH-IMPORT-ADMIN', 'QA Month Import Admin', 'ACTIVE', false),
  ('f0580000-0000-0000-0000-000000000002', 'TEACHER', 'QA-MONTH-IMPORT-TEACHER', 'QA Month Import Teacher', 'ACTIVE', false),
  ('f0580000-0000-0000-0000-000000000003', 'STUDENT', 'QA-MONTH-IMPORT-STUDENT', 'QA Month Import Student', 'ACTIVE', false),
  ('f0580000-0000-0000-0000-000000000004', 'STUDENT', 'QA-MONTH-IMPORT-STUDENT-2', 'QA Month Import Student 2', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status)
values ('f0580000-0000-0000-0000-000000000101', 'f0580000-0000-0000-0000-000000000002', 'QA-MONTH-IMPORT-T1', 'TEACHER', 'QA Month Import Teacher', 'ACTIVE');
insert into public.students (id, user_id, student_code, full_name, status)
values
  ('f0580000-0000-0000-0000-000000000201', 'f0580000-0000-0000-0000-000000000003', 'QA-MONTH-IMPORT-S1', 'QA Month Import Student', 'ACTIVE'),
  ('f0580000-0000-0000-0000-000000000202', 'f0580000-0000-0000-0000-000000000004', 'QA-MONTH-IMPORT-S2', 'QA Month Import Student 2', 'ACTIVE');
insert into public.subjects (id, code, name, status)
values ('f0580000-0000-0000-0000-000000000301', 'QA-MONTH-IMPORT-SUBJECT', 'QA Month Import Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0580000-0000-0000-0000-000000000302', 'QA-MONTH-IMPORT-GRADE', 'QA Month Import Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values
  ('f0580000-0000-0000-0000-000000000303', 'QA-MONTH-IMPORT-CLASS', 'QA Month Import Class', 'f0580000-0000-0000-0000-000000000301', 'f0580000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0580000-0000-0000-0000-000000000304', 'QA-MONTH-IMPORT-CLASS-2', 'QA Month Import Class 2', 'f0580000-0000-0000-0000-000000000301', 'f0580000-0000-0000-0000-000000000302', 'ACTIVE');

select set_config('qa.month_import_month', date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date::text, true);
select set_config('qa.month_import_weekday', extract(isodow from now() at time zone 'Asia/Ho_Chi_Minh')::integer::text, true);

insert into public.class_memberships (class_id, student_id, start_date, status)
values
  ('f0580000-0000-0000-0000-000000000303', 'f0580000-0000-0000-0000-000000000201', current_setting('qa.month_import_month')::date, 'ACTIVE'),
  ('f0580000-0000-0000-0000-000000000304', 'f0580000-0000-0000-0000-000000000202', current_setting('qa.month_import_month')::date, 'ACTIVE');

-- An existing class uses the same teacher at a different time; a new overlapping
-- row must still be blocked if that teacher would be double-booked.
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, room, manual_schedule)
values ('f0580000-0000-0000-0000-000000000501', 'f0580000-0000-0000-0000-000000000303',
  ((current_setting('qa.month_import_month')::date + ((current_setting('qa.month_import_weekday')::integer - extract(isodow from current_setting('qa.month_import_month')::date)::integer + 7) % 7)) + time '08:00') at time zone 'Asia/Ho_Chi_Minh',
  ((current_setting('qa.month_import_month')::date + ((current_setting('qa.month_import_weekday')::integer - extract(isodow from current_setting('qa.month_import_month')::date)::integer + 7) % 7)) + time '09:00') at time zone 'Asia/Ho_Chi_Minh',
  'QA-MONTH-IMPORT-OUTSIDE', true);
insert into public.session_students (session_id, student_id)
values ('f0580000-0000-0000-0000-000000000501', 'f0580000-0000-0000-0000-000000000201');
insert into public.session_staff (session_id, staff_id, assignment_role)
values ('f0580000-0000-0000-0000-000000000501', 'f0580000-0000-0000-0000-000000000101', 'TEACHER');

select ok(
  has_function_privilege('authenticated', 'public.admin_get_month_week_schedule_template(date)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_preview_month_week_schedule_import(date,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_import_month_week_schedule(date,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_get_month_week_schedule_template(date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_preview_month_week_schedule_import(date,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_import_month_week_schedule(date,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public._build_month_week_schedule_import_plan(date,jsonb)', 'EXECUTE'),
  'month template RPCs require authenticated callers and the planner stays private'
);

select set_config('request.jwt.claim.sub', 'f0580000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.admin_preview_month_week_schedule_import(current_setting('qa.month_import_month')::date, '[]'::jsonb) $$,
  'P0001', 'FORBIDDEN', 'a teacher cannot preview a month import'
);

select set_config('request.jwt.claim.sub', 'f0580000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.admin_preview_month_week_schedule_import(current_setting('qa.month_import_month')::date, '[]'::jsonb) $$,
  'P0001', 'EMPTY_TEMPLATE', 'an empty workbook cannot be previewed'
);

select set_config('qa.month_import_template', jsonb_build_array(
  jsonb_build_object('slot_id', 'f0580000-0000-0000-0000-000000000401', 'day_of_week', current_setting('qa.month_import_weekday')::integer,
    'class_id', 'f0580000-0000-0000-0000-000000000303', 'start_time', '00:01', 'end_time', '00:30', 'room', 'QA-MONTH-IMPORT-A',
    'staff_ids', jsonb_build_array('f0580000-0000-0000-0000-000000000101')),
  jsonb_build_object('slot_id', 'f0580000-0000-0000-0000-000000000402', 'day_of_week', current_setting('qa.month_import_weekday')::integer,
    'class_id', 'f0580000-0000-0000-0000-000000000303', 'start_time', '23:00', 'end_time', '23:30', 'room', 'QA-MONTH-IMPORT-B',
    'staff_ids', jsonb_build_array('f0580000-0000-0000-0000-000000000101'))
)::text, true);

select set_config('qa.month_import_preview', public.admin_preview_month_week_schedule_import(
  current_setting('qa.month_import_month')::date, current_setting('qa.month_import_template')::jsonb
)::text, true);
select ok(not (current_setting('qa.month_import_preview')::jsonb ? 'actions'), 'preview does not expose internal roster or session IDs');
select is(jsonb_array_length(current_setting('qa.month_import_preview')::jsonb->'blockers'), 0, 'a valid weekly template has no blockers');
select ok((current_setting('qa.month_import_preview')::jsonb->>'create_count')::integer > 0, 'preview expands the weekday over the selected month');

select set_config('qa.month_import_result', public.admin_import_month_week_schedule(
  current_setting('qa.month_import_month')::date, current_setting('qa.month_import_template')::jsonb
)::text, true);
select ok((current_setting('qa.month_import_result')::jsonb->>'created_sessions')::integer > 0, 'import creates month occurrences');
select is((select count(*)::integer from public.month_week_schedule_templates where month_start = current_setting('qa.month_import_month')::date), 1, 'latest template is stored for the selected month');
select is((select count(*)::integer from public.month_week_schedule_occurrences where month_start = current_setting('qa.month_import_month')::date),
  (current_setting('qa.month_import_preview')::jsonb->>'create_count')::integer, 'every occurrence is mapped back to its stable template slot');
select ok(exists (
  select 1 from public.sessions s
  where s.class_id = 'f0580000-0000-0000-0000-000000000303'
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
    and s.status = 'SCHEDULED' and s.manual_schedule
), 'past dates are created as scheduled make-up sessions');
select ok(exists (
  select 1 from public.session_students ss join public.sessions s on s.id = ss.session_id
  where s.class_id = 'f0580000-0000-0000-0000-000000000303'
    and ss.student_id = 'f0580000-0000-0000-0000-000000000201'
), 'new sessions use the membership effective on their occurrence date');

-- Add protected learning data to an omitted past occurrence; reimport must retain it.
with target as (
  select s.id from public.month_week_schedule_occurrences o
  join public.sessions s on s.id = o.session_id
  where s.class_id = 'f0580000-0000-0000-0000-000000000303'
    and o.month_start = current_setting('qa.month_import_month')::date
    and o.slot_id = 'f0580000-0000-0000-0000-000000000402'
    and s.scheduled_start_at < now() and s.status = 'SCHEDULED'
  order by s.scheduled_start_at limit 1
)
update public.sessions set status = 'COMPLETED' where id in (select id from target);
insert into public.student_attendances (session_id, student_id, status)
select o.session_id, 'f0580000-0000-0000-0000-000000000201', 'PRESENT'
from public.month_week_schedule_occurrences o
join public.sessions s on s.id = o.session_id
where o.month_start = current_setting('qa.month_import_month')::date
  and o.slot_id = 'f0580000-0000-0000-0000-000000000401'
  and s.status = 'COMPLETED'
on conflict (session_id, student_id) do nothing;

select set_config('qa.month_import_reduced_template', jsonb_build_array(
  jsonb_build_object('slot_id', 'f0580000-0000-0000-0000-000000000401', 'day_of_week', current_setting('qa.month_import_weekday')::integer,
    'class_id', 'f0580000-0000-0000-0000-000000000303', 'start_time', '00:01', 'end_time', '00:30', 'room', 'QA-MONTH-IMPORT-A',
    'staff_ids', jsonb_build_array('f0580000-0000-0000-0000-000000000101'))
)::text, true);
select set_config('qa.month_import_reduced_preview', public.admin_preview_month_week_schedule_import(
  current_setting('qa.month_import_month')::date, current_setting('qa.month_import_reduced_template')::jsonb
)::text, true);
select ok((current_setting('qa.month_import_reduced_preview')::jsonb->>'cancel_future_count')::integer > 0, 'preview reports safely cancellable future omitted sessions');
select ok((current_setting('qa.month_import_reduced_preview')::jsonb->>'preserve_history_count')::integer > 0, 'preview reports the omitted session with history that will be retained');
select is((current_setting('qa.month_import_reduced_preview')::jsonb->>'blockers')::jsonb, '[]'::jsonb, 'a valid reduced template remains atomic and conflict-free');
select set_config('qa.month_import_reduced_result', public.admin_import_month_week_schedule(
  current_setting('qa.month_import_month')::date, current_setting('qa.month_import_reduced_template')::jsonb
)::text, true);
select ok((current_setting('qa.month_import_reduced_result')::jsonb->>'cancelled_sessions')::integer > 0, 'future omitted sessions are reported after import');
select ok((current_setting('qa.month_import_reduced_result')::jsonb->>'updated_sessions')::integer > 0, 'matching month occurrences are updated');
select ok((select count(*) > 0 from public.month_week_schedule_occurrences o
  join public.sessions s on s.id = o.session_id
  join public.student_attendances a on a.session_id = s.id
  where o.month_start = current_setting('qa.month_import_month')::date
    and o.slot_id = 'f0580000-0000-0000-0000-000000000402'
    and s.status = 'COMPLETED' and a.student_id = 'f0580000-0000-0000-0000-000000000201'),
  'an omitted completed occurrence retains its status, roster mapping, and attendance');
select is((select count(*)::integer from public.class_schedule_month_overrides where month_start = current_setting('qa.month_import_month')::date), 1,
  'successful import marks the month so recurring generation skips it');
select ok((select count(*) > 0 from public.audit_logs where action in ('SESSION_MONTH_EXCEL_CREATE', 'SESSION_MONTH_EXCEL_IMPORT')),
  'successful imports write audit records');

-- Overlapping use of a teacher in a different class is rejected.
select set_config('qa.month_import_teacher_conflict_template', jsonb_build_array(
  jsonb_build_object('slot_id', 'f0580000-0000-0000-0000-000000000405', 'day_of_week', current_setting('qa.month_import_weekday')::integer,
    'class_id', 'f0580000-0000-0000-0000-000000000304', 'start_time', '08:30', 'end_time', '09:30', 'room', 'QA-MONTH-IMPORT-E',
    'staff_ids', jsonb_build_array('f0580000-0000-0000-0000-000000000101'))
)::text, true);
select ok(exists (
  select 1 from jsonb_array_elements(public.admin_preview_month_week_schedule_import(
    current_setting('qa.month_import_month')::date, current_setting('qa.month_import_teacher_conflict_template')::jsonb
  )->'blockers') blocker where blocker->>'code' = 'TEACHER_SCHEDULE_CONFLICT'
), 'overlapping teacher assignments are blocked before apply');
select throws_ok(
  $$ select public.admin_import_month_week_schedule(current_setting('qa.month_import_month')::date, current_setting('qa.month_import_teacher_conflict_template')::jsonb) $$,
  'P0001', 'IMPORT_BLOCKED', 'server rechecks teacher conflicts before writing'
);
select is((select slots from public.month_week_schedule_templates where month_start = current_setting('qa.month_import_month')::date),
  current_setting('qa.month_import_reduced_template')::jsonb, 'teacher conflict leaves the last successful template unchanged');

-- Same-class overlapping rows are rejected in preview and the previous saved template remains intact.
select set_config('qa.month_import_conflicting_template', jsonb_build_array(
  jsonb_build_object('slot_id', 'f0580000-0000-0000-0000-000000000403', 'day_of_week', current_setting('qa.month_import_weekday')::integer,
    'class_id', 'f0580000-0000-0000-0000-000000000303', 'start_time', '08:00', 'end_time', '09:00', 'room', 'QA-MONTH-IMPORT-C',
    'staff_ids', jsonb_build_array('f0580000-0000-0000-0000-000000000101')),
  jsonb_build_object('slot_id', 'f0580000-0000-0000-0000-000000000404', 'day_of_week', current_setting('qa.month_import_weekday')::integer,
    'class_id', 'f0580000-0000-0000-0000-000000000303', 'start_time', '08:30', 'end_time', '09:30', 'room', 'QA-MONTH-IMPORT-D',
    'staff_ids', jsonb_build_array('f0580000-0000-0000-0000-000000000101'))
)::text, true);
select ok(jsonb_array_length((public.admin_preview_month_week_schedule_import(
  current_setting('qa.month_import_month')::date, current_setting('qa.month_import_conflicting_template')::jsonb
)->'blockers')) > 0, 'overlapping same-class rows are blocked before apply');
select throws_ok(
  $$ select public.admin_import_month_week_schedule(current_setting('qa.month_import_month')::date, current_setting('qa.month_import_conflicting_template')::jsonb) $$,
  'P0001', 'IMPORT_BLOCKED', 'the server rechecks blockers and refuses the full transaction'
);
select is((select slots from public.month_week_schedule_templates where month_start = current_setting('qa.month_import_month')::date),
  current_setting('qa.month_import_reduced_template')::jsonb, 'failed import leaves the last successful template unchanged');

select * from finish();
rollback;
