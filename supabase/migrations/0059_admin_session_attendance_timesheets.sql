begin;

alter type public.timesheet_status add value if not exists 'REVOKED';

alter table public.session_staff
  add column if not exists timesheet_eligible boolean;

alter table public.timesheets
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists revoked_reason text;

create or replace function public.prevent_admin_finalized_roster_assignment_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
begin
  if tg_op = 'UPDATE' then
    if exists (
      select 1 from public.session_staff ss
      where ss.session_id in (old.session_id, new.session_id) and ss.timesheet_eligible is not null
    ) then
      raise exception 'ADMIN_ATTENDANCE_ASSIGNMENTS_LOCKED';
    end if;
  elsif tg_op = 'DELETE' then
    v_session_id := old.session_id;
  else
    v_session_id := new.session_id;
  end if;
  if tg_op <> 'UPDATE' and exists (
    select 1 from public.session_staff ss
    where ss.session_id = v_session_id and ss.timesheet_eligible is not null
  ) then
    raise exception 'ADMIN_ATTENDANCE_ASSIGNMENTS_LOCKED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists session_staff_admin_attendance_lock on public.session_staff;
create trigger session_staff_admin_attendance_lock
before insert or delete or update of session_id, staff_id, assignment_role on public.session_staff
for each row execute function public.prevent_admin_finalized_roster_assignment_changes();

drop trigger if exists session_students_admin_attendance_lock on public.session_students;
create trigger session_students_admin_attendance_lock
before insert or delete or update of session_id, student_id on public.session_students
for each row execute function public.prevent_admin_finalized_roster_assignment_changes();

create or replace function public.admin_record_session_attendance(
  p_session_id uuid,
  p_session_note text,
  p_lesson_youtube_url text,
  p_students jsonb,
  p_teacher_decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_item record;
  v_teacher record;
  v_timesheet public.timesheets%rowtype;
  v_url text := nullif(btrim(p_lesson_youtube_url), '');
  v_video_valid boolean := false;
  v_note text := nullif(btrim(p_session_note), '');
  v_roster_count integer;
  v_student_count integer;
  v_teacher_count integer;
  v_decision_count integer;
  v_updated_students integer := 0;
  v_approved_count integer := 0;
  v_not_eligible_count integer := 0;
  v_timesheet_found boolean;
  v_old_attendance jsonb;
  v_new_attendance jsonb;
  v_old_decisions jsonb;
  v_new_decisions jsonb;
  v_old_status public.timesheet_status;
  v_old_eligible boolean;
  v_no_pay_reason constant text := 'Admin xác nhận buổi học không tính công.';
begin
  if auth.uid() is null
     or not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE')
     or not public.actor_has_permission(auth.uid(), 'TIMESHEET_APPROVE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null
     or p_students is null or jsonb_typeof(p_students) <> 'array'
     or p_teacher_decisions is null or jsonb_typeof(p_teacher_decisions) <> 'array'
     or length(coalesce(p_session_note, '')) > 10000 then
    raise exception 'INVALID_INPUT';
  end if;

  select * into v_session
  from public.sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status = 'CANCELLED' then raise exception 'SESSION_CANCELLED'; end if;
  if v_session.status = 'IN_PROGRESS' then raise exception 'ADMIN_SESSION_IN_PROGRESS'; end if;
  if v_session.scheduled_end_at > now() then raise exception 'ADMIN_SESSION_NOT_FINISHED'; end if;

  if v_url is not null then
    if v_url ~* '^https?://(www\.)?youtu\.be/[A-Za-z0-9_-]{11}([?#].*)?$' then
      v_video_valid := true;
    elsif v_url ~* '^https?://(www\.)?(youtube\.com|m\.youtube\.com|youtube-nocookie\.com)/(watch\?[^#]*v=[A-Za-z0-9_-]{11}(&[^#]*)?|embed/[A-Za-z0-9_-]{11}([?#].*)?|shorts/[A-Za-z0-9_-]{11}([?#].*)?|live/[A-Za-z0-9_-]{11}([?#].*)?)$' then
      v_video_valid := true;
    end if;
    if not v_video_valid then raise exception 'INVALID_YOUTUBE_URL'; end if;
  end if;

  select count(*)::integer into v_roster_count
  from public.session_students ss
  where ss.session_id = p_session_id;
  select count(distinct x.student_id)::integer into v_student_count
  from jsonb_to_recordset(p_students) as x(student_id uuid);
  if v_student_count <> jsonb_array_length(p_students) then raise exception 'DUPLICATE_STUDENT'; end if;
  if exists (select 1 from jsonb_to_recordset(p_students) as x(student_id uuid) where x.student_id is null) then
    raise exception 'SESSION_ROSTER_MISMATCH';
  end if;
  if v_student_count <> v_roster_count
     or exists (
       select 1 from jsonb_to_recordset(p_students) as x(student_id uuid)
       where not exists (select 1 from public.session_students ss where ss.session_id = p_session_id and ss.student_id = x.student_id)
     )
     or exists (
       select 1 from public.session_students ss
       where ss.session_id = p_session_id
         and not exists (select 1 from jsonb_to_recordset(p_students) as x(student_id uuid) where x.student_id = ss.student_id)
     ) then
    raise exception 'SESSION_ROSTER_MISMATCH';
  end if;

  select count(*)::integer into v_teacher_count
  from public.session_staff ss
  where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER';
  if v_teacher_count = 0 then raise exception 'ADMIN_SESSION_TEACHER_REQUIRED'; end if;
  select count(distinct x.staff_id)::integer into v_decision_count
  from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean);
  if v_decision_count <> jsonb_array_length(p_teacher_decisions) then raise exception 'DUPLICATE_TEACHER_DECISION'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean)
    where x.staff_id is null or x.eligible is null
  ) then raise exception 'SESSION_TEACHER_DECISION_REQUIRED'; end if;
  if v_decision_count <> v_teacher_count
     or exists (
       select 1 from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean)
       where not exists (select 1 from public.session_staff ss where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER' and ss.staff_id = x.staff_id)
     )
     or exists (
       select 1 from public.session_staff ss
       where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
         and not exists (select 1 from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean) where x.staff_id = ss.staff_id)
     ) then
    raise exception 'SESSION_TEACHER_DECISION_REQUIRED';
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_students) as x(
      student_id uuid, status public.attendance_status, late_minutes integer,
      absence_reason text, homework_score numeric, homework_note text,
      understanding_score smallint, attitude_score smallint,
      positive_feedback_count integer, positive_feedback_raw text, comment text
    )
  loop
    if v_item.status is null then raise exception 'ATTENDANCE_STATUS_REQUIRED'; end if;
    if v_item.late_minutes is not null and v_item.late_minutes < 0 then raise exception 'INVALID_LATE_MINUTES'; end if;
    if v_item.homework_score is not null and (v_item.homework_score < 0 or v_item.homework_score > 10) then raise exception 'INVALID_HOMEWORK_SCORE'; end if;
    if v_item.understanding_score is not null and (v_item.understanding_score < 1 or v_item.understanding_score > 5) then raise exception 'INVALID_UNDERSTANDING_SCORE'; end if;
    if v_item.attitude_score is not null and (v_item.attitude_score < 1 or v_item.attitude_score > 5) then raise exception 'INVALID_ATTITUDE_SCORE'; end if;
    if v_item.positive_feedback_count is not null and v_item.positive_feedback_count < 0 then raise exception 'INVALID_FEEDBACK_COUNT'; end if;
    if v_item.comment is not null and length(v_item.comment) > 2000 then raise exception 'INVALID_COMMENT'; end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(sa) order by sa.student_id), '[]'::jsonb)
    into v_old_attendance
  from public.student_attendances sa where sa.session_id = p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('staff_id', ss.staff_id, 'timesheet_eligible', ss.timesheet_eligible) order by ss.staff_id), '[]'::jsonb)
    into v_old_decisions
  from public.session_staff ss where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER';

  update public.sessions
  set session_note = v_note,
      lesson_youtube_url = v_url,
      status = 'COMPLETED',
      ended_at = coalesce(ended_at, now()),
      ended_by = case when ended_at is null then auth.uid() else ended_by end
  where id = p_session_id;

  for v_item in
    select * from jsonb_to_recordset(p_students) as x(
      student_id uuid, status public.attendance_status, late_minutes integer,
      absence_reason text, homework_score numeric, homework_note text,
      understanding_score smallint, attitude_score smallint,
      positive_feedback_count integer, positive_feedback_raw text, comment text
    )
  loop
    insert into public.student_attendances(
      session_id, student_id, status, late_minutes, absence_reason, homework_score,
      homework_note, understanding_score, attitude_score, positive_feedback_count,
      positive_feedback_raw, comment, updated_by
    ) values (
      p_session_id, v_item.student_id, v_item.status, v_item.late_minutes,
      nullif(btrim(v_item.absence_reason), ''), v_item.homework_score,
      nullif(btrim(v_item.homework_note), ''), v_item.understanding_score,
      v_item.attitude_score, v_item.positive_feedback_count,
      nullif(btrim(v_item.positive_feedback_raw), ''), nullif(btrim(v_item.comment), ''), auth.uid()
    )
    on conflict (session_id, student_id) do update set
      status = excluded.status,
      late_minutes = excluded.late_minutes,
      absence_reason = excluded.absence_reason,
      homework_score = excluded.homework_score,
      homework_note = excluded.homework_note,
      understanding_score = excluded.understanding_score,
      attitude_score = excluded.attitude_score,
      positive_feedback_count = excluded.positive_feedback_count,
      positive_feedback_raw = excluded.positive_feedback_raw,
      comment = excluded.comment,
      updated_by = excluded.updated_by;
    v_updated_students := v_updated_students + 1;
  end loop;

  for v_teacher in
    select x.staff_id, x.eligible
    from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean)
    order by x.staff_id
  loop
    select ss.timesheet_eligible into v_old_eligible
    from public.session_staff ss
    where ss.session_id = p_session_id and ss.staff_id = v_teacher.staff_id and ss.assignment_role = 'TEACHER'
    for update;

    update public.session_staff
    set timesheet_eligible = v_teacher.eligible
    where session_id = p_session_id and staff_id = v_teacher.staff_id and assignment_role = 'TEACHER';

    select t.* into v_timesheet
    from public.timesheets t
    where t.session_id = p_session_id and t.staff_id = v_teacher.staff_id
    for update;
    v_timesheet_found := found;
    if v_timesheet_found then v_old_status := v_timesheet.status; else v_old_status := null; end if;

    if v_teacher.eligible then
      v_approved_count := v_approved_count + 1;
      if not v_timesheet_found then
        insert into public.timesheets(session_id, staff_id, status, approved_at, approved_by)
        values (p_session_id, v_teacher.staff_id, 'APPROVED', now(), auth.uid())
        returning * into v_timesheet;
        perform public.write_audit(auth.uid(), 'TIMESHEET_ADMIN_APPROVE', 'timesheets', v_timesheet.id, null,
          jsonb_build_object('status', 'APPROVED', 'session_id', p_session_id, 'staff_id', v_teacher.staff_id));
      elsif v_old_status <> 'APPROVED' or v_old_eligible is distinct from true then
        update public.timesheets
        set status = 'APPROVED', approved_at = now(), approved_by = auth.uid(), rejection_reason = null,
            revoked_at = null, revoked_by = null, revoked_reason = null
        where id = v_timesheet.id
        returning * into v_timesheet;
        perform public.write_audit(auth.uid(), 'TIMESHEET_ADMIN_APPROVE', 'timesheets', v_timesheet.id,
          jsonb_build_object('status', v_old_status, 'timesheet_eligible', v_old_eligible),
          jsonb_build_object('status', 'APPROVED', 'timesheet_eligible', true, 'session_id', p_session_id, 'staff_id', v_teacher.staff_id));
      end if;
    else
      v_not_eligible_count := v_not_eligible_count + 1;
      if v_timesheet_found and v_timesheet.status = 'APPROVED' then
        update public.timesheets
        set status = 'REVOKED', revoked_at = now(), revoked_by = auth.uid(), revoked_reason = v_no_pay_reason,
            rejection_reason = null
        where id = v_timesheet.id
        returning * into v_timesheet;
        perform public.write_audit(auth.uid(), 'TIMESHEET_ADMIN_REVOKE', 'timesheets', v_timesheet.id,
          jsonb_build_object('status', v_old_status, 'timesheet_eligible', v_old_eligible),
          jsonb_build_object('status', 'REVOKED', 'timesheet_eligible', false, 'session_id', p_session_id, 'staff_id', v_teacher.staff_id), v_no_pay_reason);
      elsif v_timesheet_found and (v_timesheet.status = 'PENDING' or (v_timesheet.status = 'REJECTED' and v_old_eligible is distinct from false)) then
        update public.timesheets
        set status = 'REJECTED', approved_at = null, approved_by = null, rejection_reason = v_no_pay_reason,
            revoked_at = null, revoked_by = null, revoked_reason = null
        where id = v_timesheet.id
        returning * into v_timesheet;
        perform public.write_audit(auth.uid(), 'TIMESHEET_ADMIN_NOT_ELIGIBLE', 'timesheets', v_timesheet.id,
          jsonb_build_object('status', v_old_status, 'timesheet_eligible', v_old_eligible),
          jsonb_build_object('status', 'REJECTED', 'timesheet_eligible', false, 'session_id', p_session_id, 'staff_id', v_teacher.staff_id), v_no_pay_reason);
      end if;
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(sa) order by sa.student_id), '[]'::jsonb)
    into v_new_attendance
  from public.student_attendances sa where sa.session_id = p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('staff_id', ss.staff_id, 'timesheet_eligible', ss.timesheet_eligible) order by ss.staff_id), '[]'::jsonb)
    into v_new_decisions
  from public.session_staff ss where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER';

  perform public.write_audit(auth.uid(), 'SESSION_ADMIN_ATTENDANCE_AND_TIMESHEETS', 'sessions', p_session_id,
    jsonb_build_object('status', v_session.status, 'session_note', v_session.session_note,
      'lesson_youtube_url', v_session.lesson_youtube_url, 'attendance', v_old_attendance, 'teacher_decisions', v_old_decisions),
    jsonb_build_object('status', 'COMPLETED', 'session_note', v_note,
      'lesson_youtube_url', v_url, 'attendance', v_new_attendance, 'teacher_decisions', v_new_decisions,
      'students_updated', v_updated_students, 'timesheets_approved', v_approved_count, 'teachers_not_eligible', v_not_eligible_count));

  return jsonb_build_object('session_id', p_session_id, 'status', 'COMPLETED',
    'students_updated', v_updated_students, 'timesheets_approved', v_approved_count,
    'teachers_not_eligible', v_not_eligible_count);
end;
$$;

revoke all on function public.admin_record_session_attendance(uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.admin_record_session_attendance(uuid, text, text, jsonb, jsonb) to authenticated;

-- Keep the existing metadata editor, but require all attendance and teacher
-- eligibility decisions to go through the atomic finalization RPC above.
create or replace function public.admin_correct_session_learning(
  p_session_id uuid,
  p_session_note text,
  p_lesson_youtube_url text,
  p_students jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_url text := nullif(btrim(p_lesson_youtube_url), '');
  v_video_valid boolean := false;
  v_note text := nullif(btrim(p_session_note), '');
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null or p_students is null or jsonb_typeof(p_students) <> 'array'
     or jsonb_array_length(p_students) <> 0 or length(coalesce(p_session_note, '')) > 10000 then
    raise exception 'ADMIN_ATTENDANCE_REQUIRES_TIMESHEET_DECISION';
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status = 'CANCELLED'
     or (v_session.status = 'SCHEDULED' and v_session.scheduled_start_at > now()) then
    raise exception 'SESSION_LOCKED';
  end if;
  if v_url is not null then
    if v_url ~* '^https?://(www\.)?youtu\.be/[A-Za-z0-9_-]{11}([?#].*)?$' then
      v_video_valid := true;
    elsif v_url ~* '^https?://(www\.)?(youtube\.com|m\.youtube\.com|youtube-nocookie\.com)/(watch\?[^#]*v=[A-Za-z0-9_-]{11}(&[^#]*)?|embed/[A-Za-z0-9_-]{11}([?#].*)?|shorts/[A-Za-z0-9_-]{11}([?#].*)?|live/[A-Za-z0-9_-]{11}([?#].*)?)$' then
      v_video_valid := true;
    end if;
    if not v_video_valid then raise exception 'INVALID_YOUTUBE_URL'; end if;
  end if;

  update public.sessions set session_note = v_note, lesson_youtube_url = v_url where id = p_session_id;
  perform public.write_audit(auth.uid(), 'SESSION_ADMIN_LEARNING_CORRECTION', 'sessions', p_session_id,
    jsonb_build_object('session_note', v_session.session_note, 'lesson_youtube_url', v_session.lesson_youtube_url),
    jsonb_build_object('session_note', v_note, 'lesson_youtube_url', v_url, 'attendance_managed_separately', true));
  return jsonb_build_object('session_id', p_session_id, 'students_updated', 0);
end;
$$;

revoke all on function public.admin_correct_session_learning(uuid, text, text, jsonb) from public, anon;
grant execute on function public.admin_correct_session_learning(uuid, text, text, jsonb) to authenticated;

create or replace function public.submit_timesheet(
  p_session_id uuid,
  p_staff_id uuid,
  p_actor_user_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_status public.session_status;
  v_existing public.timesheets%rowtype;
  v_timesheet_id uuid;
  v_eligible boolean;
begin
  if p_session_id is null or p_staff_id is null or p_actor_user_id is null
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;
  if not exists (
    select 1 from public.staff st
    where st.id = p_staff_id and st.user_id = p_actor_user_id
      and st.staff_type = 'TEACHER' and st.status = 'ACTIVE'
  ) then raise exception 'FORBIDDEN'; end if;

  select s.status into v_session_status
  from public.sessions s where s.id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session_status <> 'COMPLETED' then raise exception 'SESSION_NOT_COMPLETED'; end if;

  select ss.timesheet_eligible into v_eligible
  from public.session_staff ss
  where ss.session_id = p_session_id and ss.staff_id = p_staff_id and ss.assignment_role = 'TEACHER';
  if not found then raise exception 'SESSION_STAFF_REQUIRED'; end if;
  if v_eligible is false then raise exception 'TIMESHEET_NOT_ELIGIBLE'; end if;

  select * into v_existing from public.timesheets t
  where t.session_id = p_session_id and t.staff_id = p_staff_id for update;
  if found and v_existing.status <> 'REJECTED' then raise exception 'TIMESHEET_ALREADY_SUBMITTED'; end if;
  if found then
    update public.timesheets
    set status = 'PENDING', submitted_at = now(), approved_at = null, approved_by = null,
        rejection_reason = null, revoked_at = null, revoked_by = null, revoked_reason = null,
        notes = nullif(trim(p_notes), '')
    where id = v_existing.id returning id into v_timesheet_id;
  else
    insert into public.timesheets(session_id, staff_id, notes)
    values (p_session_id, p_staff_id, nullif(trim(p_notes), ''))
    returning id into v_timesheet_id;
  end if;
  perform public.write_audit(p_actor_user_id, 'TIMESHEET_SUBMIT', 'timesheets', v_timesheet_id, null,
    jsonb_build_object('status', 'PENDING', 'session_id', p_session_id), null);
  return jsonb_build_object('timesheet_id', v_timesheet_id, 'status', 'PENDING');
end;
$$;

revoke all on function public.submit_timesheet(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_timesheet(uuid, uuid, uuid, text) to service_role;

commit;
