begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0530000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-week-template-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0530000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-week-template-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0530000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-week-template-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0530000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-week-template-replacement@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0530000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-WEEK-TEMPLATE-ADMIN', 'QA Week Template Admin', 'ACTIVE', false),
  ('f0530000-0000-0000-0000-000000000002', 'TEACHER', 'QA-WEEK-TEMPLATE-TEACHER', 'QA Week Template Teacher', 'ACTIVE', false),
  ('f0530000-0000-0000-0000-000000000003', 'STUDENT', 'QA-WEEK-TEMPLATE-STUDENT', 'QA Week Template Student', 'ACTIVE', false),
  ('f0530000-0000-0000-0000-000000000004', 'TEACHER', 'QA-WEEK-TEMPLATE-REPLACEMENT', 'QA Week Template Replacement Teacher', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status)
values
  ('f0530000-0000-0000-0000-000000000101', 'f0530000-0000-0000-0000-000000000002', 'QA-WEEK-TEMPLATE-T1', 'TEACHER', 'QA Week Template Teacher', 'ACTIVE'),
  ('f0530000-0000-0000-0000-000000000102', 'f0530000-0000-0000-0000-000000000004', 'QA-WEEK-TEMPLATE-T2', 'TEACHER', 'QA Week Template Replacement Teacher', 'ACTIVE');
insert into public.students (id, user_id, student_code, full_name, status)
values ('f0530000-0000-0000-0000-000000000201', 'f0530000-0000-0000-0000-000000000003', 'QA-WEEK-TEMPLATE-S1', 'QA Week Template Student', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0530000-0000-0000-0000-000000000301', 'QA-WEEK-TEMPLATE-SUBJECT', 'QA Week Template Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0530000-0000-0000-0000-000000000302', 'QA-WEEK-TEMPLATE-GRADE', 'QA Week Template Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values
  ('f0530000-0000-0000-0000-000000000303', 'QA-WEEK-TEMPLATE-CLASS', 'QA Week Template Class', 'f0530000-0000-0000-0000-000000000301', 'f0530000-0000-0000-0000-000000000302', 'ACTIVE'),
  ('f0530000-0000-0000-0000-000000000304', 'QA-WEEK-TEMPLATE-EMPTY', 'QA Week Template Empty Class', 'f0530000-0000-0000-0000-000000000301', 'f0530000-0000-0000-0000-000000000302', 'ACTIVE');

select set_config(
  'qa.week_template_month',
  date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month')::date::text,
  true
);

insert into public.class_memberships (class_id, student_id, start_date, status)
values ('f0530000-0000-0000-0000-000000000303', 'f0530000-0000-0000-0000-000000000201', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE');

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at, reviewed_by)
values ('f0530000-0000-0000-0000-000000000401', 'f0530000-0000-0000-0000-000000000303', 1, '08:00', '09:00', 'QA-A1', 'ACTIVE', now(), 'f0530000-0000-0000-0000-000000000001');
insert into public.class_schedule_staff (schedule_id, staff_id)
values ('f0530000-0000-0000-0000-000000000401', 'f0530000-0000-0000-0000-000000000101');

insert into public.sessions (
  id, class_id, recurrence_schedule_id, recurrence_occurrence_date,
  scheduled_start_at, scheduled_end_at, status, manual_schedule, room
) values
  ('f0530000-0000-0000-0000-000000000501', 'f0530000-0000-0000-0000-000000000303', null, null, (current_setting('qa.week_template_month')::date + time '06:00') at time zone 'Asia/Ho_Chi_Minh', (current_setting('qa.week_template_month')::date + time '07:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', true, 'QA-X1'),
  ('f0530000-0000-0000-0000-000000000502', 'f0530000-0000-0000-0000-000000000303', null, null, ((current_setting('qa.week_template_month')::date + 2) + time '06:00') at time zone 'Asia/Ho_Chi_Minh', ((current_setting('qa.week_template_month')::date + 2) + time '07:00') at time zone 'Asia/Ho_Chi_Minh', 'IN_PROGRESS', true, 'QA-X1'),
  ('f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000303', null, null, (((current_setting('qa.week_template_month')::date + interval '1 month - 2 days')::date) + time '06:00') at time zone 'Asia/Ho_Chi_Minh', (((current_setting('qa.week_template_month')::date + interval '1 month - 2 days')::date) + time '07:00') at time zone 'Asia/Ho_Chi_Minh', 'COMPLETED', true, 'QA-X1'),
  ('f0530000-0000-0000-0000-000000000504', 'f0530000-0000-0000-0000-000000000303', null, null, (((current_setting('qa.week_template_month')::date + interval '1 month - 1 day')::date) + time '06:00') at time zone 'Asia/Ho_Chi_Minh', (((current_setting('qa.week_template_month')::date + interval '1 month - 1 day')::date) + time '07:00') at time zone 'Asia/Ho_Chi_Minh', 'CANCELLED', true, 'QA-X1'),
  ('f0530000-0000-0000-0000-000000000508', 'f0530000-0000-0000-0000-000000000303', null, null, ((current_setting('qa.week_template_month')::date - 1 + time '23:59') at time zone 'Asia/Ho_Chi_Minh'), ((current_setting('qa.week_template_month')::date - 1 + time '23:59') at time zone 'Asia/Ho_Chi_Minh') + interval '1 hour', 'SCHEDULED', true, 'QA-X1'),
  ('f0530000-0000-0000-0000-000000000509', 'f0530000-0000-0000-0000-000000000303', null, null, ((current_setting('qa.week_template_month')::date + interval '1 month')::date + time '00:00') at time zone 'Asia/Ho_Chi_Minh', ((current_setting('qa.week_template_month')::date + interval '1 month')::date + time '01:00') at time zone 'Asia/Ho_Chi_Minh', 'SCHEDULED', true, 'QA-X1');

insert into public.session_students (session_id, student_id)
values
  ('f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000201'),
  ('f0530000-0000-0000-0000-000000000509', 'f0530000-0000-0000-0000-000000000201');
update public.session_students set assessment_snapshot = jsonb_build_object('QA- score', 9)
where session_id in ('f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000509');
insert into public.session_staff (session_id, staff_id, assignment_role)
values
  ('f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0530000-0000-0000-0000-000000000509', 'f0530000-0000-0000-0000-000000000101', 'TEACHER');
insert into public.staff_replacements (id, session_id, original_staff_id, replacement_staff_id, reason, changed_by)
values ('f0530000-0000-0000-0000-000000000601', 'f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000101', 'f0530000-0000-0000-0000-000000000102', 'QA- replacement', 'f0530000-0000-0000-0000-000000000001');
insert into public.student_attendances (session_id, student_id, status)
values
  ('f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000201', 'PRESENT'),
  ('f0530000-0000-0000-0000-000000000509', 'f0530000-0000-0000-0000-000000000201', 'PRESENT');
insert into public.timesheets (id, session_id, staff_id, status)
values
  ('f0530000-0000-0000-0000-000000000701', 'f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000101', 'PENDING'),
  ('f0530000-0000-0000-0000-000000000702', 'f0530000-0000-0000-0000-000000000509', 'f0530000-0000-0000-0000-000000000101', 'PENDING');
insert into public.payroll_periods (id, year, month)
values ('f0530000-0000-0000-0000-000000000801', extract(year from current_setting('qa.week_template_month')::date)::integer, extract(month from current_setting('qa.week_template_month')::date)::integer);
insert into public.payroll_items (
  id, payroll_period_id, staff_id, session_id, timesheet_id, salary_method, fixed_amount, base_salary
) values
  ('f0530000-0000-0000-0000-000000000901', 'f0530000-0000-0000-0000-000000000801', 'f0530000-0000-0000-0000-000000000101', 'f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000701', 'FIXED', 1000, 1000),
  ('f0530000-0000-0000-0000-000000000902', 'f0530000-0000-0000-0000-000000000801', 'f0530000-0000-0000-0000-000000000101', 'f0530000-0000-0000-0000-000000000509', 'f0530000-0000-0000-0000-000000000702', 'FIXED', 1000, 1000);

select ok(
  has_function_privilege('authenticated', 'public.admin_preview_month_week_template_replacement(date,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_replace_month_with_week_template(date,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_preview_month_week_template_replacement(date,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_replace_month_with_week_template(date,jsonb)', 'EXECUTE'),
  'only authenticated callers can execute the Admin template RPCs'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0530000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.admin_preview_month_week_template_replacement(current_setting('qa.week_template_month')::date, '[]'::jsonb) $$,
  'P0001', 'FORBIDDEN', 'a teacher cannot preview a month replacement'
);

select set_config('request.jwt.claim.sub', 'f0530000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.admin_preview_month_week_template_replacement(current_setting('qa.week_template_month')::date + 1, '[]'::jsonb) $$,
  'P0001', 'INVALID_INPUT', 'preview requires the first day of a month'
);
select throws_ok(
  $$ select public.admin_replace_month_with_week_template(current_setting('qa.week_template_month')::date, '[]'::jsonb) $$,
  'P0001', 'EMPTY_TEMPLATE', 'an empty template cannot trigger a destructive replacement'
);

with preview as materialized (
  select public.admin_preview_month_week_template_replacement(
    current_setting('qa.week_template_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1,
      'class_id', 'f0530000-0000-0000-0000-000000000303',
      'start_time', '17:30', 'end_time', '19:30', 'room', 'QA-B1',
      'staff_ids', jsonb_build_array('f0530000-0000-0000-0000-000000000101')
    ))
  ) as result
)
select
  is((result->>'session_count')::integer, 4, 'preview counts all target sessions and excludes the next-month midnight boundary'),
  is((result->'status_counts'->>'SCHEDULED')::integer, 1, 'preview counts scheduled sessions'),
  is((result->'status_counts'->>'IN_PROGRESS')::integer, 1, 'preview counts in-progress sessions'),
  is((result->'status_counts'->>'COMPLETED')::integer, 1, 'preview counts completed sessions'),
  is((result->'status_counts'->>'CANCELLED')::integer, 1, 'preview counts cancelled sessions'),
  is((result->>'session_student_count')::integer, 1, 'preview counts target roster rows'),
  is((result->>'assessment_count')::integer, 1, 'preview counts target learning results'),
  is((result->>'session_staff_count')::integer, 1, 'preview counts target assigned teachers'),
  is((result->>'staff_replacement_count')::integer, 1, 'preview counts target replacements'),
  is((result->>'attendance_count')::integer, 1, 'preview counts target attendance'),
  is((result->>'timesheet_count')::integer, 1, 'preview counts target timesheets'),
  is((result->>'payroll_item_count')::integer, 1, 'preview counts target payroll items'),
  is((result->>'new_session_count')::integer, (
    select count(*)::integer from generate_series(
      current_setting('qa.week_template_month')::date,
      (current_setting('qa.week_template_month')::date + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d where extract(isodow from d)::integer = 1
  ), 'preview expands a weekly slot across every Monday of the selected month')
from preview;

select throws_ok(
  $$ select public.admin_replace_month_with_week_template(
    current_setting('qa.week_template_month')::date,
    jsonb_build_array(
      jsonb_build_object('day_of_week', 1, 'class_id', 'f0530000-0000-0000-0000-000000000303', 'start_time', '17:30', 'end_time', '19:30', 'room', 'QA-B1', 'staff_ids', jsonb_build_array('f0530000-0000-0000-0000-000000000101')),
      jsonb_build_object('day_of_week', 1, 'class_id', 'f0530000-0000-0000-0000-000000000303', 'start_time', '17:30', 'end_time', '19:30', 'room', 'QA-B1', 'staff_ids', jsonb_build_array('f0530000-0000-0000-0000-000000000101'))
    )
  ) $$,
  'P0001', 'SCHEDULE_CONFLICT', 'a conflict in the new template aborts the replacement'
);
select throws_ok(
  $$ select public.admin_replace_month_with_week_template(
    current_setting('qa.week_template_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1,
      'class_id', 'f0530000-0000-0000-0000-000000000304',
      'start_time', '17:30', 'end_time', '19:30', 'room', 'QA-C1',
      'staff_ids', jsonb_build_array('f0530000-0000-0000-0000-000000000101')
    ))
  ) $$,
  'P0001', 'NO_ACTIVE_STUDENTS', 'a class without eligible students aborts the replacement'
);
select throws_ok(
  $$ select public.admin_replace_month_with_week_template(
    current_setting('qa.week_template_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1,
      'class_id', 'f0530000-0000-0000-0000-000000000303',
      'start_time', '17:30', 'end_time', '19:30', 'room', 'QA-B1',
      'staff_ids', jsonb_build_array('f0530000-0000-0000-0000-000000000103')
    ))
  ) $$,
  'P0001', 'TEACHER_NOT_ACTIVE', 'a missing or inactive teacher aborts the replacement'
);
select is((select count(*)::integer from public.sessions where id in ('f0530000-0000-0000-0000-000000000501', 'f0530000-0000-0000-0000-000000000502', 'f0530000-0000-0000-0000-000000000503', 'f0530000-0000-0000-0000-000000000504')), 4, 'failed replacement restores all original sessions');
select is((select count(*)::integer from public.payroll_items where id = 'f0530000-0000-0000-0000-000000000901'), 1, 'failed replacement restores linked payroll data');

with replacement as materialized (
  select public.admin_replace_month_with_week_template(
    current_setting('qa.week_template_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1,
      'class_id', 'f0530000-0000-0000-0000-000000000303',
      'start_time', '17:30', 'end_time', '19:30', 'room', 'QA-B1',
      'staff_ids', jsonb_build_array('f0530000-0000-0000-0000-000000000101')
    ))
  ) as result
)
select
  is((result->>'deleted_sessions')::integer, 4, 'replacement permanently deletes every old session status'),
  is((result->'deleted_status_counts'->>'SCHEDULED')::integer, 1, 'replacement reports old scheduled count'),
  is((result->'deleted_status_counts'->>'IN_PROGRESS')::integer, 1, 'replacement reports old in-progress count'),
  is((result->'deleted_status_counts'->>'COMPLETED')::integer, 1, 'replacement reports old completed count'),
  is((result->'deleted_status_counts'->>'CANCELLED')::integer, 1, 'replacement reports old cancelled count'),
  is((result->>'deleted_session_students')::integer, 1, 'replacement deletes old roster and learning results'),
  is((result->>'deleted_session_staff')::integer, 1, 'replacement deletes old teacher assignments'),
  is((result->>'deleted_staff_replacements')::integer, 1, 'replacement deletes old staff replacements'),
  is((result->>'deleted_attendances')::integer, 1, 'replacement deletes old attendance'),
  is((result->>'deleted_timesheets')::integer, 1, 'replacement deletes old timesheets'),
  is((result->>'deleted_payroll_items')::integer, 1, 'replacement deletes old payroll items'),
  is((result->>'created_sessions')::integer, (
    select count(*)::integer from generate_series(
      current_setting('qa.week_template_month')::date,
      (current_setting('qa.week_template_month')::date + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d where extract(isodow from d)::integer = 1
  ), 'replacement creates one session for every Monday in the month')
from replacement;

select ok(
  (select count(*)::integer from public.sessions s
   where (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= current_setting('qa.week_template_month')::date
     and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < (current_setting('qa.week_template_month')::date + interval '1 month')::date
     and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::time = time '17:30'
     and extract(isodow from s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::integer = 1
     and s.manual_schedule and s.status = 'SCHEDULED') = (
       select count(*)::integer from generate_series(
         current_setting('qa.week_template_month')::date,
         (current_setting('qa.week_template_month')::date + interval '1 month - 1 day')::date,
         interval '1 day'
       ) d where extract(isodow from d)::integer = 1
     ),
  'every occurrence in the selected month matches the Monday template'
);
select is((select count(*)::integer from public.sessions where id = 'f0530000-0000-0000-0000-000000000509'), 1, 'the next-month midnight session is preserved');
select is((select count(*)::integer from public.sessions where id = 'f0530000-0000-0000-0000-000000000508'), 1, 'the previous-month final minute is preserved');
select is((select count(*)::integer from public.student_attendances where session_id = 'f0530000-0000-0000-0000-000000000509'), 1, 'outside-month attendance is preserved');
select is((select count(*)::integer from public.timesheets where session_id = 'f0530000-0000-0000-0000-000000000509'), 1, 'outside-month timesheets are preserved');
select is((select count(*)::integer from public.payroll_items where session_id = 'f0530000-0000-0000-0000-000000000509'), 1, 'outside-month payroll data is preserved');
select is((select count(*)::integer from public.classes where id = 'f0530000-0000-0000-0000-000000000303'), 1, 'class records are preserved');
select is((select count(*)::integer from public.students where id = 'f0530000-0000-0000-0000-000000000201'), 1, 'student records are preserved');
select is((select count(*)::integer from public.staff where id = 'f0530000-0000-0000-0000-000000000101'), 1, 'teacher records are preserved');
select is((select count(*)::integer from public.class_schedules where id = 'f0530000-0000-0000-0000-000000000401'), 1, 'recurring templates are preserved for other months');
select is((select count(*)::integer from public.class_schedule_month_overrides where month_start = current_setting('qa.week_template_month')::date), 1, 'the replaced month is marked so recurring generation skips it');
select is((select count(*)::integer from public.audit_logs where action = 'SESSION_MONTH_TEMPLATE_REPLACE_DELETE'), 4, 'each permanently deleted session is audited');

select lives_ok($$ select public.generate_upcoming_sessions(90) $$, 'recurring generation still runs after a one-month replacement');
select is((
  select count(*)::integer from public.sessions s
  where s.recurrence_schedule_id = 'f0530000-0000-0000-0000-000000000401'
    and s.recurrence_occurrence_date >= current_setting('qa.week_template_month')::date
    and s.recurrence_occurrence_date < (current_setting('qa.week_template_month')::date + interval '1 month')::date
), 0, 'recurring generation does not recreate sessions in the replaced month');
select ok((
  select count(*) > 0 from public.sessions s
  where s.recurrence_schedule_id = 'f0530000-0000-0000-0000-000000000401'
    and s.recurrence_occurrence_date >= (current_setting('qa.week_template_month')::date + interval '1 month')::date
), 'recurring generation continues in later months');

reset role;
select * from finish();
rollback;
