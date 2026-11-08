begin;

select plan(54);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0590000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-admin-attendance@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0590000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-teacher-attendance-1@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0590000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'qa-teacher-attendance-2@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0590000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'qa-student-attendance@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0590000-0000-0000-0000-000000000001', 'ROOT_ADMIN', 'QA-ATTENDANCE-ROOT', 'QA Attendance Root', 'ACTIVE', false),
  ('f0590000-0000-0000-0000-000000000002', 'TEACHER', 'QA-ATTENDANCE-T1', 'QA Attendance Teacher One', 'ACTIVE', false),
  ('f0590000-0000-0000-0000-000000000003', 'TEACHER', 'QA-ATTENDANCE-T2', 'QA Attendance Teacher Two', 'ACTIVE', false),
  ('f0590000-0000-0000-0000-000000000004', 'STUDENT', 'QA-ATTENDANCE-S1', 'QA Attendance Student', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0590000-0000-0000-0000-000000000101', 'f0590000-0000-0000-0000-000000000002', 'QA-ATTENDANCE-T1', 'TEACHER', 'QA Attendance Teacher One', 'ACTIVE'),
  ('f0590000-0000-0000-0000-000000000102', 'f0590000-0000-0000-0000-000000000003', 'QA-ATTENDANCE-T2', 'TEACHER', 'QA Attendance Teacher Two', 'ACTIVE');
insert into public.students (id, user_id, student_code, full_name, status)
values ('f0590000-0000-0000-0000-000000000201', 'f0590000-0000-0000-0000-000000000004', 'QA-ATTENDANCE-S1', 'QA Attendance Student', 'ACTIVE');
insert into public.subjects (id, code, name, status)
values ('f0590000-0000-0000-0000-000000000301', 'QA-ATTENDANCE-SUB', 'QA Attendance Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0590000-0000-0000-0000-000000000302', 'QA-ATTENDANCE-GRADE', 'QA Attendance Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status)
values ('f0590000-0000-0000-0000-000000000303', 'QA-ATTENDANCE-CLASS', 'QA Attendance Class', 'f0590000-0000-0000-0000-000000000301', 'f0590000-0000-0000-0000-000000000302', 'ACTIVE');
insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status) values
  ('f0590000-0000-0000-0000-000000000401', 'f0590000-0000-0000-0000-000000000303', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'SCHEDULED'),
  ('f0590000-0000-0000-0000-000000000402', 'f0590000-0000-0000-0000-000000000303', now() + interval '1 hour', now() + interval '3 hours', 'SCHEDULED'),
  ('f0590000-0000-0000-0000-000000000403', 'f0590000-0000-0000-0000-000000000303', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 'CANCELLED'),
  ('f0590000-0000-0000-0000-000000000404', 'f0590000-0000-0000-0000-000000000303', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 'COMPLETED'),
  ('f0590000-0000-0000-0000-000000000405', 'f0590000-0000-0000-0000-000000000303', now() - interval '30 minutes', now() + interval '1 hour', 'IN_PROGRESS'),
  ('f0590000-0000-0000-0000-000000000406', 'f0590000-0000-0000-0000-000000000303', now() - interval '3 hours', now() - interval '1 hour', 'IN_PROGRESS');
insert into public.session_students (session_id, student_id) values
  ('f0590000-0000-0000-0000-000000000401', 'f0590000-0000-0000-0000-000000000201'),
  ('f0590000-0000-0000-0000-000000000402', 'f0590000-0000-0000-0000-000000000201'),
  ('f0590000-0000-0000-0000-000000000403', 'f0590000-0000-0000-0000-000000000201'),
  ('f0590000-0000-0000-0000-000000000404', 'f0590000-0000-0000-0000-000000000201'),
  ('f0590000-0000-0000-0000-000000000405', 'f0590000-0000-0000-0000-000000000201'),
  ('f0590000-0000-0000-0000-000000000406', 'f0590000-0000-0000-0000-000000000201');
update public.session_students
set assessment_snapshot = '{"preserved":"QA snapshot"}'::jsonb
where session_id = 'f0590000-0000-0000-0000-000000000401'
  and student_id = 'f0590000-0000-0000-0000-000000000201';
insert into public.session_staff (session_id, staff_id, assignment_role) values
  ('f0590000-0000-0000-0000-000000000401', 'f0590000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0590000-0000-0000-0000-000000000401', 'f0590000-0000-0000-0000-000000000102', 'TEACHER'),
  ('f0590000-0000-0000-0000-000000000402', 'f0590000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0590000-0000-0000-0000-000000000403', 'f0590000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0590000-0000-0000-0000-000000000404', 'f0590000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0590000-0000-0000-0000-000000000405', 'f0590000-0000-0000-0000-000000000101', 'TEACHER'),
  ('f0590000-0000-0000-0000-000000000406', 'f0590000-0000-0000-0000-000000000101', 'TEACHER');
insert into public.timesheets (session_id, staff_id, status, approved_at, approved_by)
values ('f0590000-0000-0000-0000-000000000401', 'f0590000-0000-0000-0000-000000000101', 'APPROVED', now() - interval '1 day', 'f0590000-0000-0000-0000-000000000001');

select ok(not has_function_privilege('anon', 'public.admin_record_session_attendance(uuid,text,text,jsonb,jsonb)', 'EXECUTE'), 'anon cannot finalize attendance');
select ok(has_function_privilege('authenticated', 'public.admin_record_session_attendance(uuid,text,text,jsonb,jsonb)', 'EXECUTE'), 'authenticated can call the permission-checked admin RPC');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0590000-0000-0000-0000-000000000001', true);

select throws_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000402', null, null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true}]'::jsonb
)$$, 'P0001', 'ADMIN_SESSION_NOT_FINISHED', 'scheduled end time blocks future and in-progress admin finalization');
select is((select count(*)::integer from public.student_attendances where session_id = 'f0590000-0000-0000-0000-000000000402'), 0, 'future rejection leaves attendance untouched');
select lives_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000405', null, null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true}]'::jsonb
)$$, 'admin can end an in-progress session before its scheduled end');
select ok((select status = 'COMPLETED' and ended_at < scheduled_end_at and ended_by = 'f0590000-0000-0000-0000-000000000001' from public.sessions where id = 'f0590000-0000-0000-0000-000000000405'), 'early completion records the acting admin and actual end time');
select lives_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000406', null, null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true}]'::jsonb
)$$, 'an overdue in-progress session can also be ended by Admin');
select is((select status::text from public.sessions where id = 'f0590000-0000-0000-0000-000000000406'), 'COMPLETED'::text, 'overdue in-progress session is finalized');
select throws_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000403', null, null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true}]'::jsonb
)$$, 'P0001', 'SESSION_CANCELLED', 'cancelled sessions cannot be finalized');
select throws_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000401', null, null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201"}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true},{"staff_id":"f0590000-0000-0000-0000-000000000102","eligible":false}]'::jsonb
)$$, 'P0001', 'ATTENDANCE_STATUS_REQUIRED', 'every student needs an attendance status');
select is((select count(*)::integer from public.student_attendances where session_id = 'f0590000-0000-0000-0000-000000000401'), 0, 'missing attendance status leaves no partial writes');
select throws_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000401', null, null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true}]'::jsonb
)$$, 'P0001', 'SESSION_TEACHER_DECISION_REQUIRED', 'every assigned teacher needs an explicit decision');
select is((select status::text from public.sessions where id = 'f0590000-0000-0000-0000-000000000401'), 'SCHEDULED'::text, 'invalid decision leaves the session state unchanged');

select lives_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000401', 'QA admin makeup attendance', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"LATE","late_minutes":5}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true},{"staff_id":"f0590000-0000-0000-0000-000000000102","eligible":false}]'::jsonb
)$$, 'Admin atomically records a backdated makeup session and teacher decisions');
select is((select status::text from public.sessions where id = 'f0590000-0000-0000-0000-000000000401'), 'COMPLETED'::text, 'admin finalization completes the session');
select is((select ended_by from public.sessions where id = 'f0590000-0000-0000-0000-000000000401'), 'f0590000-0000-0000-0000-000000000001'::uuid, 'admin finalization records the acting admin');
select is((select status::text from public.student_attendances where session_id = 'f0590000-0000-0000-0000-000000000401' and student_id = 'f0590000-0000-0000-0000-000000000201'), 'LATE'::text, 'full roster attendance is persisted');
reset role;
select is((select timesheet_eligible from public.session_staff where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), true, 'eligible teacher decision is stored per assignment');
select is((select timesheet_eligible from public.session_staff where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000102'), false, 'ineligible teacher decision is stored per assignment');
select is((select status::text from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), 'APPROVED'::text, 'eligible teacher timesheet is approved immediately');
select is((select count(*)::integer from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000102'), 0, 'ineligible teacher receives no payable timesheet');

set local role service_role;
select throws_ok($$select public.submit_timesheet('f0590000-0000-0000-0000-000000000401', 'f0590000-0000-0000-0000-000000000102', 'f0590000-0000-0000-0000-000000000003', null)$$,
  'P0001', 'TIMESHEET_NOT_ELIGIBLE', 'ineligible teacher cannot submit a timesheet');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0590000-0000-0000-0000-000000000001', true);
select throws_ok($$select public.admin_update_session_teachers('f0590000-0000-0000-0000-000000000401', array['f0590000-0000-0000-0000-000000000101'::uuid])$$,
  'P0001', 'ADMIN_ATTENDANCE_ASSIGNMENTS_LOCKED', 'teacher assignments are locked after admin finalization');

select lives_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000401', 'QA admin makeup attendance', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"LATE","late_minutes":5}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":false},{"staff_id":"f0590000-0000-0000-0000-000000000102","eligible":false}]'::jsonb
)$$, 'admin can change an approved teacher to not eligible');
select is((select status::text from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), 'REVOKED'::text, 'changing approved to not eligible revokes the timesheet');
select ok((select revoked_at is not null and revoked_by = 'f0590000-0000-0000-0000-000000000001' and revoked_reason is not null from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), 'revocation keeps actor, time, and reason');
select lives_ok($$select public.admin_record_session_attendance(
  'f0590000-0000-0000-0000-000000000401', 'QA admin makeup attendance', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"LATE","late_minutes":5}]'::jsonb,
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":true},{"staff_id":"f0590000-0000-0000-0000-000000000102","eligible":false}]'::jsonb
)$$, 'admin can restore a revoked teacher to eligible');
select is((select status::text from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), 'APPROVED'::text, 'restored eligibility approves the timesheet again');
select ok((select revoked_at is null and revoked_by is null and revoked_reason is null from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), 'restored approval clears current revocation metadata while audit keeps history');
reset role;
select ok((select count(*) >= 5 from public.audit_logs where entity_id = 'f0590000-0000-0000-0000-000000000401' or old_data->>'session_id' = 'f0590000-0000-0000-0000-000000000401' or new_data->>'session_id' = 'f0590000-0000-0000-0000-000000000401'), 'session and timesheet decision changes are audited');
select throws_ok($$select public.admin_correct_session_learning(
  'f0590000-0000-0000-0000-000000000401', null, null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb
)$$, 'P0001', 'ADMIN_ATTENDANCE_REQUIRES_TIMESHEET_DECISION', 'legacy learning RPC cannot write attendance without teacher decisions');

select ok(
  not has_function_privilege('anon', 'public.admin_correct_completed_session(uuid,timestamptz,timestamptz,text,text,text,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_correct_completed_session(uuid,timestamptz,timestamptz,text,text,text,jsonb)', 'EXECUTE'),
  'completed-session correction is available only through the permission-checked authenticated RPC'
);
select set_config('request.jwt.claim.sub', 'f0590000-0000-0000-0000-000000000004', true);
select throws_ok($$select public.admin_correct_completed_session(
  'f0590000-0000-0000-0000-000000000404', now() - interval '3 days', now() - interval '3 days' + interval '2 hours',
  'QA-ROOM', 'QA forbidden', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb
)$$, 'P0001', 'FORBIDDEN', 'students cannot correct completed sessions');
select set_config('request.jwt.claim.sub', 'f0590000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.admin_correct_completed_session(
  'f0590000-0000-0000-0000-000000000401', now() - interval '3 days', now() - interval '3 days' + interval '2 hours',
  'QA-CORRECTED-ROOM', 'QA corrected session note', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT","homework_score":8.5,"homework_note":"QA corrected homework","understanding_score":4,"attitude_score":5,"positive_feedback_count":1,"positive_feedback_raw":"QA feedback","comment":"QA corrected comment"}]'::jsonb
)$$, 'completed session attendance and session information can be corrected atomically');
select is((select status::text from public.sessions where id = 'f0590000-0000-0000-0000-000000000401'), 'COMPLETED'::text, 'correction preserves lifecycle status');
select ok((select scheduled_start_at < now() and room = 'QA-CORRECTED-ROOM' and session_note = 'QA corrected session note' from public.sessions where id = 'f0590000-0000-0000-0000-000000000401'), 'correction updates historical schedule, room, and session note');
select ok((select status = 'PRESENT' and homework_score = 8.5 and homework_note = 'QA corrected homework' and understanding_score = 4 and attitude_score = 5 and positive_feedback_count = 1 and positive_feedback_raw = 'QA feedback' and comment = 'QA corrected comment' from public.student_attendances where session_id = 'f0590000-0000-0000-0000-000000000401' and student_id = 'f0590000-0000-0000-0000-000000000201'), 'all Excel assessment columns are updated');
select ok(
  (select count(*) = 1 from public.session_students where session_id = 'f0590000-0000-0000-0000-000000000401' and student_id = 'f0590000-0000-0000-0000-000000000201')
  and (select assessment_snapshot = '{"preserved":"QA snapshot"}'::jsonb from public.session_students where session_id = 'f0590000-0000-0000-0000-000000000401' and student_id = 'f0590000-0000-0000-0000-000000000201')
  and (select timesheet_eligible from public.session_staff where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101')
  and (select status::text = 'APPROVED' from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'),
  'correction preserves roster, teacher eligibility, and approved timesheet'
);
select is((select count(*)::integer from public.audit_logs where entity_id = 'f0590000-0000-0000-0000-000000000401' and action = 'SESSION_COMPLETED_CORRECTION'), 1, 'completed-session correction writes an audit entry');
select throws_ok($$select public.admin_correct_completed_session(
  'f0590000-0000-0000-0000-000000000401', now() - interval '3 days', now() - interval '3 days' + interval '2 hours',
  'QA-CORRECTED-ROOM', 'QA must roll back', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT","homework_score":11}]'::jsonb
)$$, 'P0001', 'INVALID_HOMEWORK_SCORE', 'invalid scores reject the whole correction');
select ok((select session_note = 'QA corrected session note' from public.sessions where id = 'f0590000-0000-0000-0000-000000000401') and (select homework_score = 8.5 from public.student_attendances where session_id = 'f0590000-0000-0000-0000-000000000401'), 'invalid correction leaves existing session and attendance values unchanged');
select throws_ok($$select public.admin_correct_completed_session(
  'f0590000-0000-0000-0000-000000000401', now() - interval '3 days', now() - interval '3 days' + interval '2 hours',
  'QA-CORRECTED-ROOM', 'QA wrong roster', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000202","status":"PRESENT"}]'::jsonb
)$$, 'P0001', 'SESSION_ROSTER_MISMATCH', 'correction cannot change the saved student roster');
select throws_ok($$select public.admin_correct_completed_session(
  'f0590000-0000-0000-0000-000000000401', now() - interval '1 day', now() - interval '1 day' + interval '2 hours',
  'QA-CORRECTED-ROOM', 'QA schedule conflict', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb
)$$, 'P0001', 'SCHEDULE_CONFLICT', 'overlapping completed session cannot be moved into a class conflict');
select is((select scheduled_start_at < now() - interval '2 days' and session_note = 'QA corrected session note' from public.sessions where id = 'f0590000-0000-0000-0000-000000000401'), true, 'schedule conflict rolls back the attempted correction');
select throws_ok($$select public.admin_correct_completed_session(
  'f0590000-0000-0000-0000-000000000404', now() - interval '1 day', now() - interval '1 day' + interval '2 hours',
  'QA-ROOM', 'QA attendance incomplete', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb
)$$, 'P0001', 'SESSION_ATTENDANCE_INCOMPLETE', 'completed session without complete attendance cannot be corrected');
select throws_ok($$select public.admin_correct_completed_session(
  'f0590000-0000-0000-0000-000000000402', now() - interval '3 days', now() - interval '3 days' + interval '2 hours',
  'QA-ROOM', 'QA not completed', null,
  '[{"student_id":"f0590000-0000-0000-0000-000000000201","status":"PRESENT"}]'::jsonb
)$$, 'P0001', 'SESSION_NOT_COMPLETED', 'scheduled sessions cannot use the completed-session correction RPC');

select ok(
  not has_function_privilege('anon', 'public.admin_set_completed_session_timesheets(uuid,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_set_completed_session_timesheets(uuid,jsonb)', 'EXECUTE'),
  'completed-session timesheet updates are available only through the permission-checked authenticated RPC'
);
select set_config('request.jwt.claim.sub', 'f0590000-0000-0000-0000-000000000004', true);
select throws_ok($$select public.admin_set_completed_session_timesheets(
  'f0590000-0000-0000-0000-000000000401',
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":false},{"staff_id":"f0590000-0000-0000-0000-000000000102","eligible":false}]'::jsonb
)$$, 'P0001', 'FORBIDDEN', 'students cannot update completed-session timesheets');
select set_config('request.jwt.claim.sub', 'f0590000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.admin_set_completed_session_timesheets(
  'f0590000-0000-0000-0000-000000000401',
  '[{"staff_id":"f0590000-0000-0000-0000-000000000101","eligible":false},{"staff_id":"f0590000-0000-0000-0000-000000000102","eligible":false}]'::jsonb
)$$, 'Admin can update completed-session timesheets without submitting attendance');
select is((select comment from public.student_attendances where session_id = 'f0590000-0000-0000-0000-000000000401' and student_id = 'f0590000-0000-0000-0000-000000000201'), 'QA corrected comment'::text, 'timesheet-only update leaves the attendance comment untouched');
select is((select timesheet_eligible from public.session_staff where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), false, 'timesheet-only update stores the teacher decision');
select is((select status::text from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000401' and staff_id = 'f0590000-0000-0000-0000-000000000101'), 'REVOKED'::text, 'timesheet-only update revokes a previously approved timesheet');

reset role;
set local role service_role;
select lives_ok($$select public.submit_timesheet('f0590000-0000-0000-0000-000000000404', 'f0590000-0000-0000-0000-000000000101', 'f0590000-0000-0000-0000-000000000002', 'QA normal teacher flow')$$,
  'admin-unhandled completed session remains eligible for teacher submission');
select is((select status::text from public.timesheets where session_id = 'f0590000-0000-0000-0000-000000000404' and staff_id = 'f0590000-0000-0000-0000-000000000101'), 'PENDING'::text, 'normal teacher workflow still creates pending request');

select * from finish();
rollback;
