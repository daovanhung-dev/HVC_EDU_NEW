begin;

create or replace function public.prevent_admin_finalized_roster_assignment_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_delete_session_id uuid;
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
    v_delete_session_id := nullif(current_setting('hvc.admin_delete_session_id', true), '')::uuid;
    if v_delete_session_id = v_session_id
       and auth.uid() is not null
       and public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
      return old;
    end if;
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

create or replace function public._admin_apply_session_teacher_timesheet_decisions(
  p_session_id uuid,
  p_teacher_decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teacher record;
  v_timesheet public.timesheets%rowtype;
  v_teacher_count integer;
  v_decision_count integer;
  v_approved_count integer := 0;
  v_not_eligible_count integer := 0;
  v_timesheet_found boolean;
  v_old_status public.timesheet_status;
  v_old_eligible boolean;
  v_old_decisions jsonb;
  v_new_decisions jsonb;
  v_no_pay_reason constant text := 'Admin xác nhận buổi học không tính công.';
begin
  if auth.uid() is null
     or not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE')
     or not public.actor_has_permission(auth.uid(), 'TIMESHEET_APPROVE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null or p_teacher_decisions is null
     or jsonb_typeof(p_teacher_decisions) <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;

  select count(*)::integer into v_teacher_count
  from public.session_staff ss
  where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER';
  if v_teacher_count = 0 then raise exception 'ADMIN_SESSION_TEACHER_REQUIRED'; end if;

  select count(distinct x.staff_id)::integer into v_decision_count
  from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean);
  if v_decision_count <> jsonb_array_length(p_teacher_decisions) then
    raise exception 'DUPLICATE_TEACHER_DECISION';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean)
    where x.staff_id is null or x.eligible is null
  ) then raise exception 'SESSION_TEACHER_DECISION_REQUIRED'; end if;
  if v_decision_count <> v_teacher_count
     or exists (
       select 1 from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean)
       where not exists (
         select 1 from public.session_staff ss
         where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER' and ss.staff_id = x.staff_id
       )
     )
     or exists (
       select 1 from public.session_staff ss
       where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER'
         and not exists (
           select 1 from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean)
           where x.staff_id = ss.staff_id
         )
     ) then
    raise exception 'SESSION_TEACHER_DECISION_REQUIRED';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('staff_id', ss.staff_id, 'timesheet_eligible', ss.timesheet_eligible) order by ss.staff_id), '[]'::jsonb)
    into v_old_decisions
  from public.session_staff ss
  where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER';

  for v_teacher in
    select x.staff_id, x.eligible
    from jsonb_to_recordset(p_teacher_decisions) as x(staff_id uuid, eligible boolean)
    order by x.staff_id
  loop
    select ss.timesheet_eligible into v_old_eligible
    from public.session_staff ss
    where ss.session_id = p_session_id and ss.staff_id = v_teacher.staff_id and ss.assignment_role = 'TEACHER'
    for update;
    if not found then raise exception 'SESSION_TEACHER_DECISION_REQUIRED'; end if;

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

  select coalesce(jsonb_agg(jsonb_build_object('staff_id', ss.staff_id, 'timesheet_eligible', ss.timesheet_eligible) order by ss.staff_id), '[]'::jsonb)
    into v_new_decisions
  from public.session_staff ss
  where ss.session_id = p_session_id and ss.assignment_role = 'TEACHER';

  return jsonb_build_object(
    'old_decisions', v_old_decisions,
    'new_decisions', v_new_decisions,
    'timesheets_approved', v_approved_count,
    'teachers_not_eligible', v_not_eligible_count
  );
end;
$$;
revoke all on function public._admin_apply_session_teacher_timesheet_decisions(uuid, jsonb) from public, anon, authenticated;

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
  v_timesheet_result jsonb;
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
  if v_session.status = 'SCHEDULED' and v_session.scheduled_end_at > now() then
    raise exception 'ADMIN_SESSION_NOT_FINISHED';
  end if;

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

  v_timesheet_result := public._admin_apply_session_teacher_timesheet_decisions(p_session_id, p_teacher_decisions);
  v_approved_count := (v_timesheet_result->>'timesheets_approved')::integer;
  v_not_eligible_count := (v_timesheet_result->>'teachers_not_eligible')::integer;

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
    'teachers_not_eligible', v_not_eligible_count,
    'ended_at', (select s.ended_at from public.sessions s where s.id = p_session_id),
    'ended_by', (select s.ended_by from public.sessions s where s.id = p_session_id));
end;
$$;

revoke all on function public.admin_record_session_attendance(uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.admin_record_session_attendance(uuid, text, text, jsonb, jsonb) to authenticated;


create or replace function public.admin_set_completed_session_timesheets(
  p_session_id uuid,
  p_teacher_decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_decisions jsonb;
begin
  if auth.uid() is null
     or not public.actor_has_permission(auth.uid(), 'ACADEMIC_MANAGE')
     or not public.actor_has_permission(auth.uid(), 'TIMESHEET_APPROVE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null or p_teacher_decisions is null
     or jsonb_typeof(p_teacher_decisions) <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;

  select * into v_session
  from public.sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'COMPLETED' then raise exception 'SESSION_NOT_COMPLETED'; end if;

  v_decisions := public._admin_apply_session_teacher_timesheet_decisions(p_session_id, p_teacher_decisions);
  perform public.write_audit(auth.uid(), 'SESSION_ADMIN_TIMESHEETS_UPDATE', 'sessions', p_session_id,
    jsonb_build_object('teacher_decisions', v_decisions->'old_decisions'),
    jsonb_build_object('teacher_decisions', v_decisions->'new_decisions',
      'timesheets_approved', v_decisions->'timesheets_approved',
      'teachers_not_eligible', v_decisions->'teachers_not_eligible'));

  return jsonb_build_object(
    'session_id', p_session_id,
    'status', 'COMPLETED',
    'timesheets_approved', (v_decisions->>'timesheets_approved')::integer,
    'teachers_not_eligible', (v_decisions->>'teachers_not_eligible')::integer
  );
end;
$$;
revoke all on function public.admin_set_completed_session_timesheets(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_completed_session_timesheets(uuid, jsonb) to authenticated;

create or replace function public.admin_preview_delete_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_has_history boolean;
  v_can_delete boolean;
  v_blocked_reason text;
  v_session_students integer;
  v_session_staff integer;
  v_staff_replacements integer;
  v_attendances integer;
  v_timesheets integer;
  v_payroll_items integer;
  v_month_occurrences integer;
  v_financial_snapshot_rows integer;
  v_has_revenue_snapshot boolean;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null then raise exception 'INVALID_INPUT'; end if;
  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  select exists (select 1 from public.student_attendances where session_id = p_session_id)
      or exists (select 1 from public.timesheets where session_id = p_session_id)
      or exists (select 1 from public.staff_replacements where session_id = p_session_id)
      or exists (select 1 from public.payroll_items where session_id = p_session_id)
      or exists (
        select 1 from public.session_students ss
        where ss.session_id = p_session_id
          and (ss.assessment_snapshot <> '{}'::jsonb
            or ss.monthly_fee_snapshot is not null
            or ss.session_unit_value is not null)
      )
      or nullif(btrim(v_session.lesson_content), '') is not null
      or nullif(btrim(v_session.session_note), '') is not null
      or nullif(btrim(v_session.lesson_youtube_url), '') is not null
      or v_session.import_metadata <> '{}'::jsonb
      or coalesce(v_session.revenue_snapshot, 0) <> 0
    into v_has_history;

  v_can_delete := v_session.status <> 'CANCELLED' and (
    v_session.status <> 'SCHEDULED'
    or v_session.scheduled_start_at <= now()
    or (v_session.started_at is null and v_session.ended_at is null and not v_has_history)
  );
  if not v_can_delete then
    if v_session.status = 'CANCELLED' then
      v_blocked_reason := 'SESSION_DELETE_NOT_ALLOWED';
    else
      v_blocked_reason := 'SESSION_HAS_HISTORY';
    end if;
  end if;

  select count(*)::integer into v_session_students from public.session_students where session_id = p_session_id;
  select count(*)::integer into v_session_staff from public.session_staff where session_id = p_session_id;
  select count(*)::integer into v_staff_replacements from public.staff_replacements where session_id = p_session_id;
  select count(*)::integer into v_attendances from public.student_attendances where session_id = p_session_id;
  select count(*)::integer into v_timesheets from public.timesheets where session_id = p_session_id;
  select count(*)::integer into v_payroll_items from public.payroll_items p
    where p.session_id = p_session_id or p.timesheet_id in (
      select t.id from public.timesheets t where t.session_id = p_session_id
    );
  select count(*)::integer into v_month_occurrences from public.month_week_schedule_occurrences where session_id = p_session_id;
  select count(*)::integer into v_financial_snapshot_rows from public.session_students ss
    where ss.session_id = p_session_id and (ss.monthly_fee_snapshot is not null or ss.session_unit_value is not null);
  v_has_revenue_snapshot := coalesce(v_session.revenue_snapshot, 0) <> 0;

  return jsonb_build_object(
    'session_id', p_session_id,
    'class_id', v_session.class_id,
    'status', v_session.status,
    'scheduled_start_at', v_session.scheduled_start_at,
    'scheduled_end_at', v_session.scheduled_end_at,
    'recurring', v_session.recurrence_schedule_id is not null,
    'can_delete', v_can_delete,
    'blocked_reason', v_blocked_reason,
    'session_students', v_session_students,
    'session_staff', v_session_staff,
    'staff_replacements', v_staff_replacements,
    'attendances', v_attendances,
    'timesheets', v_timesheets,
    'payroll_items', v_payroll_items,
    'month_week_occurrences', v_month_occurrences,
    'financial_snapshot_rows', v_financial_snapshot_rows,
    'has_revenue_snapshot', v_has_revenue_snapshot
  );
end;
$$;

create or replace function public.admin_delete_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_preview jsonb;
  v_excluded_date date;
  v_deleted_payroll_items integer := 0;
  v_deleted_timesheets integer := 0;
  v_deleted_attendances integer := 0;
  v_deleted_staff_replacements integer := 0;
  v_deleted_session_students integer := 0;
  v_deleted_session_staff integer := 0;
  v_deleted_sessions integer := 0;
  v_deleted_month_occurrences integer := 0;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_session_id is null then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  v_preview := public.admin_preview_delete_session(p_session_id);
  if coalesce((v_preview->>'can_delete')::boolean, false) is not true then
    raise exception '%', coalesce(v_preview->>'blocked_reason', 'SESSION_DELETE_NOT_ALLOWED');
  end if;

  if v_session.recurrence_schedule_id is not null then
    v_excluded_date := coalesce(
      v_session.recurrence_occurrence_date,
      (v_session.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
    );
    insert into public.deleted_session_occurrences(class_schedule_id, occurrence_date, deleted_by)
    values (v_session.recurrence_schedule_id, v_excluded_date, v_actor)
    on conflict (class_schedule_id, occurrence_date) do update
      set deleted_by = excluded.deleted_by, deleted_at = now();
  end if;

  perform public.write_audit(v_actor, 'SESSION_DELETE', 'sessions', p_session_id,
    jsonb_build_object(
      'class_id', v_session.class_id,
      'status', v_session.status,
      'recurrence_schedule_id', v_session.recurrence_schedule_id,
      'recurrence_occurrence_date', v_session.recurrence_occurrence_date,
      'scheduled_start_at', v_session.scheduled_start_at,
      'scheduled_end_at', v_session.scheduled_end_at,
      'room', v_session.room,
      'preview', v_preview
    ), null);

  perform set_config('hvc.admin_delete_session_id', p_session_id::text, true);
  delete from public.payroll_items p
  where p.session_id = p_session_id
     or p.timesheet_id in (select t.id from public.timesheets t where t.session_id = p_session_id);
  get diagnostics v_deleted_payroll_items = row_count;
  delete from public.timesheets where session_id = p_session_id;
  get diagnostics v_deleted_timesheets = row_count;
  delete from public.student_attendances where session_id = p_session_id;
  get diagnostics v_deleted_attendances = row_count;
  delete from public.staff_replacements where session_id = p_session_id;
  get diagnostics v_deleted_staff_replacements = row_count;
  select count(*)::integer into v_deleted_month_occurrences
  from public.month_week_schedule_occurrences where session_id = p_session_id;
  delete from public.session_students where session_id = p_session_id;
  get diagnostics v_deleted_session_students = row_count;
  delete from public.session_staff where session_id = p_session_id;
  get diagnostics v_deleted_session_staff = row_count;
  delete from public.sessions where id = p_session_id;
  get diagnostics v_deleted_sessions = row_count;
  perform set_config('hvc.admin_delete_session_id', '', true);

  if v_deleted_sessions <> 1 then raise exception 'DELETE_COUNT_MISMATCH'; end if;
  return jsonb_build_object(
    'session_id', p_session_id,
    'deleted', true,
    'excluded_occurrence', v_session.recurrence_schedule_id is not null,
    'deleted_sessions', v_deleted_sessions,
    'deleted_session_students', v_deleted_session_students,
    'deleted_session_staff', v_deleted_session_staff,
    'deleted_staff_replacements', v_deleted_staff_replacements,
    'deleted_attendances', v_deleted_attendances,
    'deleted_timesheets', v_deleted_timesheets,
    'deleted_payroll_items', v_deleted_payroll_items,
    'deleted_month_week_occurrences', v_deleted_month_occurrences
  );
end;
$$;

revoke all on function public.admin_preview_delete_session(uuid) from public, anon;
grant execute on function public.admin_preview_delete_session(uuid) to authenticated;
revoke all on function public.admin_delete_session(uuid) from public, anon;
grant execute on function public.admin_delete_session(uuid) to authenticated;

comment on function public.admin_preview_delete_session(uuid) is
  'Preview a single Admin session deletion, including attendance, timesheet, payroll, roster, and financial snapshot counts.';
comment on function public.admin_delete_session(uuid) is
  'Delete a non-cancelled session and its session-linked records atomically; preserve audit history and recurring occurrence tombstones.';

commit;
