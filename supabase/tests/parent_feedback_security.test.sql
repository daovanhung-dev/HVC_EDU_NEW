begin;

select plan(13);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0680000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-parent-feedback-root@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0680000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-parent-feedback-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0680000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-parent-feedback-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0680000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-parent-feedback-student@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0680000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'qa-parent-feedback-inactive-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0680000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-PF-ROOT', 'QA Feedback Root', 'ACTIVE', false),
  ('f0680000-0000-0000-0000-000000000002', 'ADMIN', 'QA-PF-ADMIN', 'QA Feedback Admin', 'ACTIVE', false),
  ('f0680000-0000-0000-0000-000000000003', 'TEACHER', 'QA-PF-TEACHER', 'QA Feedback Teacher', 'ACTIVE', false),
  ('f0680000-0000-0000-0000-000000000004', 'STUDENT', 'QA-PF-STUDENT', 'QA Feedback Student', 'ACTIVE', false),
  ('f0680000-0000-0000-0000-000000000005', 'ADMIN', 'QA-PF-INACTIVE', 'QA Feedback Inactive Admin', 'LOCKED', false);

insert into public.parent_feedback (parent_name, student_name, class_name, feedback)
values ('QA Parent', 'QA Student', 'QA-Class', 'QA feedback only visible to active admins');

select is(has_table_privilege('anon', 'public.parent_feedback', 'SELECT'), false, 'anon cannot read parent feedback');
select is(has_table_privilege('anon', 'public.parent_feedback', 'INSERT'), false, 'anon cannot insert parent feedback directly');
select is(has_table_privilege('authenticated', 'public.parent_feedback', 'SELECT'), true, 'authenticated reads are filtered by RLS');
select is(has_table_privilege('authenticated', 'public.parent_feedback', 'INSERT'), false, 'authenticated cannot insert directly');
select is(has_table_privilege('authenticated', 'public.parent_feedback', 'UPDATE'), false, 'authenticated cannot update feedback');
select is(has_table_privilege('authenticated', 'public.parent_feedback', 'DELETE'), false, 'authenticated cannot delete feedback');
select is(has_table_privilege('service_role', 'public.parent_feedback', 'SELECT'), false, 'service role cannot read feedback through the Data API');
select is(has_schema_privilege('authenticated', 'private', 'USAGE'), false, 'authenticated cannot access private rate-limit data');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0680000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.parent_feedback), 1, 'active ROOT_ADMIN can read feedback');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0680000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.parent_feedback), 1, 'active ADMIN can read feedback');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0680000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.parent_feedback), 0, 'TEACHER cannot read feedback');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0680000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.parent_feedback), 0, 'STUDENT cannot read feedback');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0680000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.parent_feedback), 0, 'inactive ADMIN cannot read feedback');

select * from finish();
rollback;
