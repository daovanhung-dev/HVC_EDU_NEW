begin;

select plan(12);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0600000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-eligibility-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0600000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-eligibility-teacher-1@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0600000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-eligibility-teacher-2@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0600000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-eligibility-unassigned@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0600000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-eligibility-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0600000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'qa-eligibility-forced-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0600000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-ELIGIBILITY-ROOT', 'QA Eligibility Root', 'ACTIVE', false),
  ('f0600000-0000-0000-0000-000000000002', 'TEACHER', 'QA-ELIGIBILITY-T1', 'QA Eligibility Teacher One', 'ACTIVE', false),
  ('f0600000-0000-0000-0000-000000000003', 'TEACHER', 'QA-ELIGIBILITY-T2', 'QA Eligibility Teacher Two', 'ACTIVE', false),
  ('f0600000-0000-0000-0000-000000000004', 'TEACHER', 'QA-ELIGIBILITY-T3', 'QA Eligibility Unassigned', 'ACTIVE', false),
  ('f0600000-0000-0000-0000-000000000005', 'STUDENT', 'QA-ELIGIBILITY-S1', 'QA Eligibility Student', 'ACTIVE', false),
  ('f0600000-0000-0000-0000-000000000006', 'TEACHER', 'QA-ELIGIBILITY-T4', 'QA Eligibility Forced Teacher', 'ACTIVE', true);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0600000-0000-0000-0000-000000000101', 'f0600000-0000-0000-0000-000000000002', 'QA-ELIGIBILITY-T1', 'TEACHER', 'QA Eligibility Teacher One', 'ACTIVE'),
  ('f0600000-0000-0000-0000-000000000102', 'f0600000-0000-0000-0000-000000000003', 'QA-ELIGIBILITY-T2', 'TEACHER', 'QA Eligibility Teacher Two', 'ACTIVE'),
  ('f0600000-0000-0000-0000-000000000103', 'f0600000-0000-0000-0000-000000000004', 'QA-ELIGIBILITY-T3', 'TEACHER', 'QA Eligibility Unassigned', 'ACTIVE'),
  ('f0600000-0000-0000-0000-000000000104', 'f0600000-0000-0000-0000-000000000006', 'QA-ELIGIBILITY-T4', 'TEACHER', 'QA Eligibility Forced Teacher', 'ACTIVE');

insert into public.students (id, user_id, student_code, full_name, status)
values ('f0600000-0000-0000-0000-000000000201', 'f0600000-0000-0000-0000-000000000005', 'QA-ELIGIBILITY-S1', 'QA Eligibility Student', 'ACTIVE');
insert into public.subjects (id, code, name, status)
values ('f0600000-0000-0000-0000-000000000301', 'QA-ELIGIBILITY-SUB', 'QA Eligibility Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0600000-0000-0000-0000-000000000302', 'QA-ELIGIBILITY-GRADE', 'QA Eligibility Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0600000-0000-0000-0000-000000000303', 'QA-ELIGIBILITY-CLASS', 'QA Eligibility Class', 'f0600000-0000-0000-0000-000000000301', 'f0600000-0000-0000-0000-000000000302', 'ACTIVE');
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status) values
  ('f0600000-0000-0000-0000-000000000401', 'f0600000-0000-0000-0000-000000000303', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'COMPLETED'),
  ('f0600000-0000-0000-0000-000000000402', 'f0600000-0000-0000-0000-000000000303', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 'COMPLETED'),
  ('f0600000-0000-0000-0000-000000000403', 'f0600000-0000-0000-0000-000000000303', now() - interval '3 hours', now() - interval '1 hour', 'COMPLETED');
insert into public.session_students (session_id, student_id)
values ('f0600000-0000-0000-0000-000000000401', 'f0600000-0000-0000-0000-000000000201');
insert into public.session_staff (session_id, staff_id, assignment_role, timesheet_eligible) values
  ('f0600000-0000-0000-0000-000000000401', 'f0600000-0000-0000-0000-000000000101', 'TEACHER', null),
  ('f0600000-0000-0000-0000-000000000401', 'f0600000-0000-0000-0000-000000000102', 'TEACHER', null),
  ('f0600000-0000-0000-0000-000000000402', 'f0600000-0000-0000-0000-000000000102', 'TEACHER', null),
  ('f0600000-0000-0000-0000-000000000403', 'f0600000-0000-0000-0000-000000000104', 'TEACHER', null);
update public.session_staff
set timesheet_eligible = case staff_id
  when 'f0600000-0000-0000-0000-000000000101'::uuid then true
  when 'f0600000-0000-0000-0000-000000000102'::uuid then false
  when 'f0600000-0000-0000-0000-000000000104'::uuid then true
end
where session_id in (
  'f0600000-0000-0000-0000-000000000401'::uuid,
  'f0600000-0000-0000-0000-000000000403'::uuid
);

select ok(has_function_privilege('authenticated', 'public.get_session_staff_timesheet_eligibility(uuid[])', 'EXECUTE'), 'authenticated can execute the permission-checked RPC');
select ok(not has_column_privilege('authenticated', 'public.session_staff', 'timesheet_eligible', 'SELECT'), 'authenticated still cannot select the eligibility column directly');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0600000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select session_id, staff_id, timesheet_eligible
    from public.get_session_staff_timesheet_eligibility(array[
      'f0600000-0000-0000-0000-000000000401'::uuid,
      'f0600000-0000-0000-0000-000000000402'::uuid,
      'f0600000-0000-0000-0000-000000000403'::uuid
    ]) order by session_id, staff_id$$,
  $$values
    ('f0600000-0000-0000-0000-000000000401'::uuid, 'f0600000-0000-0000-0000-000000000101'::uuid, true),
    ('f0600000-0000-0000-0000-000000000401'::uuid, 'f0600000-0000-0000-0000-000000000102'::uuid, false),
    ('f0600000-0000-0000-0000-000000000402'::uuid, 'f0600000-0000-0000-0000-000000000102'::uuid, null::boolean),
    ('f0600000-0000-0000-0000-000000000403'::uuid, 'f0600000-0000-0000-0000-000000000104'::uuid, true)$$,
  'Admin can read all decisions for requested sessions');
select is((select count(*)::integer from public.get_session_staff_timesheet_eligibility(array[]::uuid[])), 0, 'an empty session list returns no eligibility rows');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0600000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select session_id, staff_id, timesheet_eligible
    from public.get_session_staff_timesheet_eligibility(array[
      'f0600000-0000-0000-0000-000000000401'::uuid,
      'f0600000-0000-0000-0000-000000000402'::uuid
    ]) order by session_id, staff_id$$,
  $$values ('f0600000-0000-0000-0000-000000000401'::uuid, 'f0600000-0000-0000-0000-000000000101'::uuid, true)$$,
  'assigned teacher can read only their own assignment decision');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0600000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select session_id, staff_id, timesheet_eligible
    from public.get_session_staff_timesheet_eligibility(array[
      'f0600000-0000-0000-0000-000000000401'::uuid,
      'f0600000-0000-0000-0000-000000000402'::uuid
    ]) order by session_id, staff_id$$,
  $$values
    ('f0600000-0000-0000-0000-000000000401'::uuid, 'f0600000-0000-0000-0000-000000000102'::uuid, false),
    ('f0600000-0000-0000-0000-000000000402'::uuid, 'f0600000-0000-0000-0000-000000000102'::uuid, null::boolean)$$,
  'teacher can read decisions only for sessions where they are assigned');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0600000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.get_session_staff_timesheet_eligibility(array[
  'f0600000-0000-0000-0000-000000000401'::uuid,
  'f0600000-0000-0000-0000-000000000402'::uuid
])), 0, 'unassigned teacher receives no eligibility rows');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0600000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.get_session_staff_timesheet_eligibility(array[
  'f0600000-0000-0000-0000-000000000401'::uuid
])), 0, 'student receives no teacher eligibility rows');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0600000-0000-0000-0000-000000000006', true);
select is((select count(*)::integer from public.get_session_staff_timesheet_eligibility(array[
  'f0600000-0000-0000-0000-000000000403'::uuid
])), 0, 'teacher required to change password receives no eligibility rows');

reset role;
select ok(not has_function_privilege('anon', 'public.get_session_staff_timesheet_eligibility(uuid[])', 'EXECUTE'), 'anon cannot execute the eligibility RPC');
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select throws_ok(
  $$select * from public.get_session_staff_timesheet_eligibility(array['f0600000-0000-0000-0000-000000000401'::uuid])$$,
  '42501',
  'anon RPC invocation is rejected');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0600000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select timesheet_eligible from public.session_staff limit 1$$,
  '42501',
  'authenticated cannot select the eligibility column directly');

select * from finish();
rollback;
