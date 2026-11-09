begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0640000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-template-add-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0640000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-template-add-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0640000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-template-add-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0640000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-template-add-second-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0640000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-TEMPLATE-ADD-ADMIN', 'QA Template Add Admin', 'ACTIVE', false),
  ('f0640000-0000-0000-0000-000000000002', 'TEACHER', 'QA-TEMPLATE-ADD-TEACHER', 'QA Template Add Teacher', 'ACTIVE', false),
  ('f0640000-0000-0000-0000-000000000003', 'STUDENT', 'QA-TEMPLATE-ADD-STUDENT', 'QA Template Add Student', 'ACTIVE', false),
  ('f0640000-0000-0000-0000-000000000004', 'TEACHER', 'QA-TEMPLATE-ADD-SECOND-TEACHER', 'QA Template Add Second Teacher', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0640000-0000-0000-0000-000000000101', 'f0640000-0000-0000-0000-000000000002', 'QA-TEMPLATE-ADD-T1', 'TEACHER', 'QA Template Add Teacher', 'ACTIVE'),
  ('f0640000-0000-0000-0000-000000000102', 'f0640000-0000-0000-0000-000000000004', 'QA-TEMPLATE-ADD-T2', 'TEACHER', 'QA Template Add Second Teacher', 'ACTIVE');
insert into public.students (id, user_id, student_code, full_name, status)
values ('f0640000-0000-0000-0000-000000000201', 'f0640000-0000-0000-0000-000000000003', 'QA-TEMPLATE-ADD-S1', 'QA Template Add Student', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0640000-0000-0000-0000-000000000301', 'QA-TEMPLATE-ADD-SUBJECT', 'QA Template Add Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0640000-0000-0000-0000-000000000302', 'QA-TEMPLATE-ADD-GRADE', 'QA Template Add Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0640000-0000-0000-0000-000000000303', 'QA-TEMPLATE-ADD-CLASS', 'QA Template Add Class', 'f0640000-0000-0000-0000-000000000301', 'f0640000-0000-0000-0000-000000000302', 'ACTIVE');

select set_config(
  'qa.template_add_month',
  date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month')::date::text,
  true
);
select set_config(
  'qa.template_add_first_monday',
  (current_setting('qa.template_add_month')::date
    + ((8 - extract(isodow from current_setting('qa.template_add_month')::date)::integer) % 7))::text,
  true
);
select set_config(
  'qa.template_add_second_monday',
  (current_setting('qa.template_add_first_monday')::date + 7)::text,
  true
);

insert into public.class_memberships (class_id, student_id, start_date, status)
values ('f0640000-0000-0000-0000-000000000303', 'f0640000-0000-0000-0000-000000000201', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'ACTIVE');
insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at, reviewed_by)
values ('f0640000-0000-0000-0000-000000000401', 'f0640000-0000-0000-0000-000000000303', 5, '14:00', '15:00', 'QA-FRIDAY', 'ACTIVE', now(), 'f0640000-0000-0000-0000-000000000001');
insert into public.class_schedule_staff (schedule_id, staff_id)
values ('f0640000-0000-0000-0000-000000000401', 'f0640000-0000-0000-0000-000000000101');

insert into public.sessions (
  id, class_id, scheduled_start_at, scheduled_end_at, status, manual_schedule, room
) values
  ('f0640000-0000-0000-0000-000000000501', 'f0640000-0000-0000-0000-000000000303',
    (current_setting('qa.template_add_first_monday')::date + time '08:00') at time zone 'Asia/Ho_Chi_Minh',
    (current_setting('qa.template_add_first_monday')::date + time '09:00') at time zone 'Asia/Ho_Chi_Minh',
    'SCHEDULED', true, 'QA-OLD-ROOM'),
  ('f0640000-0000-0000-0000-000000000502', 'f0640000-0000-0000-0000-000000000303',
    (current_setting('qa.template_add_second_monday')::date + time '08:00') at time zone 'Asia/Ho_Chi_Minh',
    (current_setting('qa.template_add_second_monday')::date + time '09:00') at time zone 'Asia/Ho_Chi_Minh',
    'CANCELLED', true, 'QA-CANCELLED-ROOM');
insert into public.session_students (session_id, student_id)
values ('f0640000-0000-0000-0000-000000000501', 'f0640000-0000-0000-0000-000000000201');
insert into public.session_staff (session_id, staff_id, assignment_role)
values ('f0640000-0000-0000-0000-000000000501', 'f0640000-0000-0000-0000-000000000101', 'TEACHER');

select ok(
  has_function_privilege('authenticated', 'public.admin_preview_month_week_template_addition(date,jsonb,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_add_month_week_template(date,jsonb,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_preview_month_week_template_addition(date,jsonb,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_add_month_week_template(date,jsonb,text,text)', 'EXECUTE'),
  'only authenticated callers can execute the additive template RPCs'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0640000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.admin_preview_month_week_template_addition(current_setting('qa.template_add_month')::date, '[]'::jsonb, 'FULL_MONTH', 'SKIP') $$,
  'P0001', 'FORBIDDEN', 'a teacher cannot preview additive schedules'
);

select set_config('request.jwt.claim.sub', 'f0640000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.admin_preview_month_week_template_addition(current_setting('qa.template_add_month')::date, '[]'::jsonb, 'FULL_MONTH', 'SKIP') $$,
  'P0001', 'EMPTY_TEMPLATE', 'an empty additive template is rejected'
);
select throws_ok(
  $$ select public.admin_preview_month_week_template_addition(current_setting('qa.template_add_month')::date, '[]'::jsonb, 'FULL_MONTH', 'INVALID') $$,
  'P0001', 'INVALID_INPUT', 'the duplicate action must be explicit'
);

with preview as materialized (
  select public.admin_preview_month_week_template_addition(
    current_setting('qa.template_add_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1, 'class_id', 'f0640000-0000-0000-0000-000000000303',
      'start_time', '08:00', 'end_time', '09:00', 'room', 'QA-NEW-ROOM',
      'staff_ids', jsonb_build_array('f0640000-0000-0000-0000-000000000102')
    )),
    'FULL_MONTH', 'SKIP'
  ) as result
)
select
  is((result->>'overwriteable_duplicate_count')::integer, 1, 'preview identifies a safe exact duplicate even when skip is selected'),
  is((result->>'update_count')::integer, 0, 'skip preview does not count a duplicate as an update'),
  is((result->>'skipped_duplicate_count')::integer, 1, 'skip preview counts the exact duplicate as skipped'),
  is((result->>'protected_duplicate_count')::integer, 1, 'preview identifies a cancelled exact duplicate to preserve'),
  is((result->>'create_count')::integer, (
    select count(*)::integer from generate_series(
      current_setting('qa.template_add_month')::date,
      (current_setting('qa.template_add_month')::date + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d where extract(isodow from d)::integer = 1
  ) - 2, 'preview counts only the remaining Mondays as new sessions')
from preview;

with result as materialized (
  select public.admin_preview_month_week_template_addition(
    current_setting('qa.template_add_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1, 'class_id', 'f0640000-0000-0000-0000-000000000303',
      'start_time', '08:00', 'end_time', '09:00', 'room', 'QA-NEW-ROOM',
      'staff_ids', jsonb_build_array('f0640000-0000-0000-0000-000000000102')
    )),
    'FULL_MONTH', 'OVERWRITE_SAFE'
  ) as value
)
select
  is((value->>'create_count')::integer, (
    select count(*)::integer from generate_series(
      current_setting('qa.template_add_month')::date,
      (current_setting('qa.template_add_month')::date + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d where extract(isodow from d)::integer = 1
  ) - 2, 'overwrite preview counts new sessions separately from the duplicate'),
  is((value->>'update_count')::integer, 1, 'overwrite preview counts the safe exact duplicate as an update'),
  ok((value->'matches') @> jsonb_build_array(jsonb_build_object(
    'date', current_setting('qa.template_add_first_monday')::date,
    'class_id', 'f0640000-0000-0000-0000-000000000303', 'action', 'UPDATE', 'reason', null
  )), 'preview lists the exact duplicate and selected action')
from result;

with added as materialized (
  select public.admin_add_month_week_template(
    current_setting('qa.template_add_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1, 'class_id', 'f0640000-0000-0000-0000-000000000303',
      'start_time', '08:00', 'end_time', '09:00', 'room', 'QA-NEW-ROOM',
      'staff_ids', jsonb_build_array('f0640000-0000-0000-0000-000000000102')
    )),
    'FULL_MONTH', 'OVERWRITE_SAFE'
  ) as result
)
select
  is((result->>'created_sessions')::integer, (
    select count(*)::integer from generate_series(
      current_setting('qa.template_add_month')::date,
      (current_setting('qa.template_add_month')::date + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d where extract(isodow from d)::integer = 1
  ) - 2, 'apply adds every nonduplicate Monday'),
  is((result->>'updated_sessions')::integer, 1, 'apply updates the safe exact duplicate'),
  is((result->>'protected_duplicates')::integer, 1, 'apply keeps the cancelled exact duplicate'),
  is((select room from public.sessions where id = 'f0640000-0000-0000-0000-000000000501'), 'QA-NEW-ROOM', 'safe duplicate receives the requested room'),
  is((select staff_id from public.session_staff where session_id = 'f0640000-0000-0000-0000-000000000501' and assignment_role = 'TEACHER'), 'f0640000-0000-0000-0000-000000000102'::uuid, 'safe duplicate receives the requested teacher'),
  is((select count(*)::integer from public.session_students where session_id = 'f0640000-0000-0000-0000-000000000501'), 1, 'safe duplicate roster follows effective membership'),
  is((select room from public.sessions where id = 'f0640000-0000-0000-0000-000000000502'), 'QA-CANCELLED-ROOM', 'cancelled duplicate remains unchanged'),
  is((select count(*)::integer from public.class_schedule_month_overrides where month_start = current_setting('qa.template_add_month')::date), 0, 'additive template does not suppress recurring generation for the whole month'),
  is((select count(*)::integer from public.audit_logs where action = 'SESSION_MONTH_TEMPLATE_ADD_UPDATE' and entity_id = 'f0640000-0000-0000-0000-000000000501'), 1, 'safe duplicate update is audited')
from added;

select lives_ok($$ select public.generate_upcoming_sessions(90) $$, 'recurring generation still runs after additive template application');
select ok((
  select count(*) > 0 from public.sessions s
  where s.recurrence_schedule_id = 'f0640000-0000-0000-0000-000000000401'
    and s.recurrence_occurrence_date >= current_setting('qa.template_add_month')::date
), 'the recurring schedule continues to generate sessions for this and later months');

select set_config('qa.template_add_session_count', (
  select count(*)::text from public.sessions s
  where s.class_id = 'f0640000-0000-0000-0000-000000000303'
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= current_setting('qa.template_add_month')::date
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < (current_setting('qa.template_add_month')::date + interval '1 month')::date
), true);
select throws_ok(
  $$ select public.admin_add_month_week_template(
    current_setting('qa.template_add_month')::date,
    jsonb_build_array(jsonb_build_object(
      'day_of_week', 1, 'class_id', 'f0640000-0000-0000-0000-000000000303',
      'start_time', '08:30', 'end_time', '09:30', 'room', 'QA-OVERLAP',
      'staff_ids', jsonb_build_array('f0640000-0000-0000-0000-000000000102')
    )),
    'FULL_MONTH', 'OVERWRITE_SAFE'
  ) $$,
  'P0001', 'TEMPLATE_ADDITION_BLOCKED', 'a nonexact schedule conflict rejects the entire additive batch'
);
select is((
  select count(*)::text from public.sessions s
  where s.class_id = 'f0640000-0000-0000-0000-000000000303'
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date >= current_setting('qa.template_add_month')::date
    and (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date < (current_setting('qa.template_add_month')::date + interval '1 month')::date
), current_setting('qa.template_add_session_count'), 'a conflict leaves all existing and previously added sessions unchanged');

reset role;
select * from finish();
rollback;
