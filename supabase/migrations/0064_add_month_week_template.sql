create or replace function public._build_month_week_template_addition_plan(
  p_month_start date,
  p_template jsonb,
  p_range text,
  p_duplicate_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_month_end date;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_slot jsonb;
  v_slot_count integer := 0;
  v_day integer;
  v_class_id uuid;
  v_start_time time;
  v_end_time time;
  v_room text;
  v_staff_ids uuid[];
  v_students uuid[];
  v_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_exact_ids uuid[];
  v_session_id uuid;
  v_session record;
  v_source_schedule_ids uuid[];
  v_source_schedule_id uuid;
  v_schedule record;
  v_schedule_students uuid[];
  v_action jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_matches jsonb := '[]'::jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_blocker text;
  v_created integer := 0;
  v_updated integer := 0;
  v_overwriteable integer := 0;
  v_recurring_duplicates integer := 0;
  v_skipped integer := 0;
  v_protected integer := 0;
  v_teacher_count integer;
  v_candidate record;
  v_prior record;
  v_target_students uuid[];
  v_prior_students uuid[];
  v_target_room text;
  v_prior_room text;
  v_candidate_session_id uuid;
  v_conflict text;
  v_previous jsonb;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or p_range is null or p_duplicate_action is null
     or date_trunc('month', p_month_start)::date <> p_month_start
     or coalesce(jsonb_typeof(p_template), '') <> 'array'
     or p_range not in ('FULL_MONTH', 'REMAINING_DAYS')
     or p_duplicate_action not in ('OVERWRITE_SAFE', 'SKIP') then
    raise exception 'INVALID_INPUT';
  end if;
  if jsonb_array_length(p_template) = 0 then raise exception 'EMPTY_TEMPLATE'; end if;
  if jsonb_array_length(p_template) > 100 then raise exception 'TEMPLATE_LIMIT_EXCEEDED'; end if;

  v_month_end := (p_month_start + interval '1 month')::date;

  for v_slot in select value from jsonb_array_elements(p_template)
  loop
    v_slot_count := v_slot_count + 1;
    if jsonb_typeof(v_slot) <> 'object'
       or coalesce(v_slot->>'day_of_week', '') !~ '^[1-7]$'
       or coalesce(v_slot->>'class_id', '') !~* '^[0-9a-f-]{36}$'
       or jsonb_typeof(v_slot->'start_time') <> 'string'
       or jsonb_typeof(v_slot->'end_time') <> 'string'
       or jsonb_typeof(v_slot->'staff_ids') <> 'array' then
      raise exception 'INVALID_TEMPLATE';
    end if;
    v_day := (v_slot->>'day_of_week')::integer;
    v_class_id := (v_slot->>'class_id')::uuid;
    v_start_time := (v_slot->>'start_time')::time;
    v_end_time := (v_slot->>'end_time')::time;
    v_room := nullif(btrim(v_slot->>'room'), '');
    select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
      into v_staff_ids
    from jsonb_array_elements_text(v_slot->'staff_ids') with ordinality staff(value, ordinality);
    if v_start_time is null or v_end_time <= v_start_time
       or cardinality(v_staff_ids) = 0 or cardinality(v_staff_ids) > 5 then
      raise exception 'INVALID_TEMPLATE';
    end if;
    select count(distinct staff_id)::integer into v_teacher_count
    from unnest(v_staff_ids) staff(staff_id);
    if v_teacher_count <> cardinality(v_staff_ids) then raise exception 'DUPLICATE_TEACHER'; end if;
    if not exists (select 1 from public.classes c where c.id = v_class_id) then
      raise exception 'CLASS_NOT_FOUND';
    end if;
    if (select count(*)::integer from public.staff st
        where st.id = any(v_staff_ids) and st.status = 'ACTIVE' and st.staff_type = 'TEACHER')
       <> cardinality(v_staff_ids) then
      raise exception 'TEACHER_NOT_ACTIVE';
    end if;
  end loop;

  for v_slot in select value from jsonb_array_elements(p_template)
  loop
    v_day := (v_slot->>'day_of_week')::integer;
    v_class_id := (v_slot->>'class_id')::uuid;
    v_start_time := (v_slot->>'start_time')::time;
    v_end_time := (v_slot->>'end_time')::time;
    v_room := nullif(btrim(v_slot->>'room'), '');
    select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
      into v_staff_ids
    from jsonb_array_elements_text(v_slot->'staff_ids') with ordinality staff(value, ordinality);

    for v_date in
      select d::date
      from generate_series(p_month_start, v_month_end - 1, interval '1 day') d
      where extract(isodow from d)::integer = v_day
        and (p_range = 'FULL_MONTH' or d::date >= v_today)
    loop
      v_start_at := (v_date + v_start_time) at time zone 'Asia/Ho_Chi_Minh';
      v_end_at := (v_date + v_end_time) at time zone 'Asia/Ho_Chi_Minh';
      if p_range = 'REMAINING_DAYS' and v_start_at <= now() then continue; end if;

      if v_start_at > now() and not exists (
        select 1 from public.classes c where c.id = v_class_id and c.status = 'ACTIVE'
      ) then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'date', v_date, 'class_id', v_class_id, 'code', 'CLASS_NOT_ACTIVE',
          'message', 'Lớp đã ngừng hoạt động nên không thể thêm buổi tương lai.'));
        continue;
      end if;

      if v_start_at <= now() then
        select coalesce(array_agg(distinct cm.student_id order by cm.student_id), '{}'::uuid[])
          into v_students
        from public.class_memberships cm
        where cm.class_id = v_class_id and cm.start_date <= v_date
          and coalesce(cm.end_date, 'infinity'::date) >= v_date;
      else
        select coalesce(array_agg(distinct cm.student_id order by cm.student_id), '{}'::uuid[])
          into v_students
        from public.class_memberships cm
        join public.students st on st.id = cm.student_id
        where cm.class_id = v_class_id and cm.status = 'ACTIVE' and st.status = 'ACTIVE'
          and cm.start_date <= v_date and coalesce(cm.end_date, 'infinity'::date) >= v_date;
      end if;
      if cardinality(v_students) = 0 then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'date', v_date, 'class_id', v_class_id, 'code', 'NO_ACTIVE_STUDENTS',
          'message', 'Lớp không có học sinh có membership hiệu lực vào ngày này.'));
        continue;
      end if;

      select coalesce(array_agg(s.id order by s.id), '{}'::uuid[])
        into v_exact_ids
      from public.sessions s
      where s.class_id = v_class_id
        and s.scheduled_start_at = v_start_at
        and s.scheduled_end_at = v_end_at;
      if cardinality(v_exact_ids) > 1 then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'date', v_date, 'class_id', v_class_id, 'code', 'MULTIPLE_EXACT_MATCHES',
          'message', 'Đã có nhiều buổi trùng chính xác; cần xử lý dữ liệu trùng trước khi thêm mẫu.'));
        v_matches := v_matches || jsonb_build_array(jsonb_build_object(
          'date', v_date, 'class_id', v_class_id, 'action', 'BLOCKED',
          'reason', 'MULTIPLE_EXACT_MATCHES'));
        continue;
      end if;

      v_session_id := null;
      v_source_schedule_id := null;
      v_action := null;
      if cardinality(v_exact_ids) = 1 then
        v_session_id := v_exact_ids[1];
        select s.* into v_session from public.sessions s where s.id = v_session_id;
        if v_session.status = 'CANCELLED' then
          v_action := jsonb_build_object('action', 'PRESERVE', 'reason', 'SESSION_ALREADY_CANCELLED');
          v_protected := v_protected + 1;
          v_matches := v_matches || jsonb_build_array(jsonb_build_object(
            'date', v_date, 'class_id', v_class_id, 'action', 'PRESERVE',
            'reason', 'Buổi đã hủy; hệ thống giữ nguyên và không tạo buổi thay thế.'));
        elsif v_session.status = 'SCHEDULED'
          and v_session.scheduled_start_at > now()
          and v_session.started_at is null and v_session.ended_at is null
          and coalesce(v_session.import_metadata, '{}'::jsonb) = '{}'::jsonb
          and nullif(btrim(v_session.session_note), '') is null
          and nullif(btrim(v_session.lesson_content), '') is null
          and v_session.lesson_youtube_url is null
          and not exists (select 1 from public.student_attendances a where a.session_id = v_session_id)
          and not exists (select 1 from public.session_students ss
            where ss.session_id = v_session_id
              and (ss.assessment_snapshot <> '{}'::jsonb
                or ss.monthly_fee_snapshot is not null
                or ss.session_unit_value is not null))
          and not exists (select 1 from public.timesheets t where t.session_id = v_session_id)
          and not exists (select 1 from public.payroll_items p where p.session_id = v_session_id
            or p.timesheet_id in (select t.id from public.timesheets t where t.session_id = v_session_id))
          and not exists (select 1 from public.staff_replacements r where r.session_id = v_session_id) then
          v_overwriteable := v_overwriteable + 1;
          select jsonb_build_object(
            'room', s.room,
            'teachers', (select coalesce(jsonb_agg(ss.staff_id order by ss.staff_id), '[]'::jsonb)
              from public.session_staff ss where ss.session_id = s.id and ss.assignment_role = 'TEACHER'),
            'students', (select coalesce(jsonb_agg(ss.student_id order by ss.student_id), '[]'::jsonb)
              from public.session_students ss where ss.session_id = s.id)
          ) into v_previous
          from public.sessions s where s.id = v_session_id;
          v_action := jsonb_build_object('action', 'UPDATE', 'session_id', v_session_id,
            'previous', v_previous);
          if p_duplicate_action = 'OVERWRITE_SAFE' then
            v_updated := v_updated + 1;
            v_matches := v_matches || jsonb_build_array(jsonb_build_object(
              'date', v_date, 'class_id', v_class_id, 'action', 'UPDATE', 'reason', null));
          else
            v_action := jsonb_build_object('action', 'SKIP', 'session_id', v_session_id,
              'reason', 'DUPLICATE_SKIPPED');
            v_skipped := v_skipped + 1;
            v_matches := v_matches || jsonb_build_array(jsonb_build_object(
              'date', v_date, 'class_id', v_class_id, 'action', 'SKIP',
              'reason', 'Buổi trùng được giữ nguyên theo lựa chọn bỏ qua.'));
          end if;
        else
          v_action := jsonb_build_object('action', 'PRESERVE', 'session_id', v_session_id,
            'reason', 'SESSION_HAS_HISTORY_OR_IS_NOT_FUTURE_SCHEDULED');
          v_protected := v_protected + 1;
          v_matches := v_matches || jsonb_build_array(jsonb_build_object(
            'date', v_date, 'class_id', v_class_id, 'action', 'PRESERVE',
            'reason', 'Buổi đã bắt đầu, không còn ở trạng thái SCHEDULED hoặc có dữ liệu cần bảo toàn.'));
        end if;
      else
        if v_start_at > now()
          and not exists (select 1 from public.class_schedule_month_overrides o where o.month_start = p_month_start)
        then
          select coalesce(array_agg(cs.id order by cs.id), '{}'::uuid[])
            into v_source_schedule_ids
          from public.class_schedules cs
          join public.classes c on c.id = cs.class_id and c.status = 'ACTIVE'
          where cs.class_id = v_class_id and cs.day_of_week = v_day
            and cs.start_time = v_start_time and cs.end_time = v_end_time
            and cs.status = 'ACTIVE' and cs.reviewed_at is not null
            and not exists (select 1 from public.deleted_session_occurrences d
              where d.class_schedule_id = cs.id and d.occurrence_date = v_date)
            and not exists (select 1 from public.sessions s
              where s.recurrence_schedule_id = cs.id and s.recurrence_occurrence_date = v_date);
          if cardinality(v_source_schedule_ids) > 1 then
            v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
              'date', v_date, 'class_id', v_class_id, 'code', 'MULTIPLE_RECURRING_MATCHES',
              'message', 'Có nhiều lịch lặp giống hệt nhau; cần xử lý lịch lặp trước khi thêm mẫu.'));
            v_matches := v_matches || jsonb_build_array(jsonb_build_object(
              'date', v_date, 'class_id', v_class_id, 'action', 'BLOCKED',
              'reason', 'MULTIPLE_RECURRING_MATCHES'));
            continue;
          elsif cardinality(v_source_schedule_ids) = 1 then
            v_source_schedule_id := v_source_schedule_ids[1];
            v_recurring_duplicates := v_recurring_duplicates + 1;
            if p_duplicate_action = 'SKIP' then
              v_action := jsonb_build_object('action', 'SKIP_RECURRING',
                'source_schedule_id', v_source_schedule_id,
                'reason', 'RECURRING_PATTERN_EXISTS');
              v_skipped := v_skipped + 1;
              v_matches := v_matches || jsonb_build_array(jsonb_build_object(
                'date', v_date, 'class_id', v_class_id, 'action', 'SKIP',
                'reason', 'Lịch lặp hiện có sẽ tự sinh buổi này.'));
            else
              v_action := jsonb_build_object('action', 'CREATE',
                'source_schedule_id', v_source_schedule_id,
                'reason', 'RECURRING_PATTERN_EXISTS');
              v_created := v_created + 1;
              v_matches := v_matches || jsonb_build_array(jsonb_build_object(
                'date', v_date, 'class_id', v_class_id, 'action', 'CREATE',
                'reason', 'Tạo hoặc ghi đè riêng buổi này; không sửa lịch lặp gốc.'));
            end if;
          end if;
        end if;

        if v_action is null then
          v_action := jsonb_build_object('action', 'CREATE');
          v_created := v_created + 1;
        end if;
      end if;

      v_action := v_action || jsonb_build_object(
        'date', v_date, 'class_id', v_class_id, 'start_at', v_start_at,
        'end_at', v_end_at, 'room', v_room, 'staff_ids', to_jsonb(v_staff_ids),
        'student_ids', to_jsonb(v_students), 'session_id', v_session_id,
        'source_schedule_id', v_source_schedule_id);
      v_actions := v_actions || jsonb_build_array(v_action);

      if v_action->>'action' in ('CREATE', 'UPDATE') then
        v_candidate_session_id := nullif(v_action->>'session_id', '')::uuid;
        v_conflict := public.session_schedule_conflict_reason(
          v_candidate_session_id, v_class_id, v_start_at, v_end_at, v_room, v_students);
        if v_conflict is not null then
          v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
            'date', v_date, 'class_id', v_class_id, 'code', v_conflict,
            'message', case v_conflict
              when 'SCHEDULE_CONFLICT' then 'Lớp hoặc học sinh có buổi khác trùng giờ.'
              when 'ROOM_REQUIRED_FOR_OVERLAP' then 'Buổi trùng giờ cần khai báo phòng cho cả hai lớp.'
              when 'ROOM_ALREADY_BOOKED' then 'Phòng đã có buổi học khác trong khung giờ.'
              else 'Buổi bị trùng với lịch đang tồn tại.' end));
        end if;

        if v_start_at > now()
          and not exists (select 1 from public.class_schedule_month_overrides o where o.month_start = p_month_start)
        then
          for v_schedule in
            select cs.id, cs.class_id, cs.room, cs.start_time, cs.end_time
            from public.class_schedules cs
            join public.classes c on c.id = cs.class_id and c.status = 'ACTIVE'
            where cs.status = 'ACTIVE' and cs.reviewed_at is not null
              and cs.day_of_week = extract(isodow from v_date)::integer
              and cs.id is distinct from v_source_schedule_id
              and not exists (select 1 from public.deleted_session_occurrences d
                where d.class_schedule_id = cs.id and d.occurrence_date = v_date)
              and not exists (select 1 from public.sessions s
                where s.recurrence_schedule_id = cs.id and s.recurrence_occurrence_date = v_date
                  and (s.status <> 'CANCELLED' or s.schedule_override))
              and ((v_date + cs.start_time) at time zone 'Asia/Ho_Chi_Minh') < v_end_at
              and ((v_date + cs.end_time) at time zone 'Asia/Ho_Chi_Minh') > v_start_at
          loop
            select coalesce(array_agg(distinct cm.student_id order by cm.student_id), '{}'::uuid[])
              into v_schedule_students
            from public.class_memberships cm
            join public.students st on st.id = cm.student_id
            where cm.class_id = v_schedule.class_id and cm.status = 'ACTIVE' and st.status = 'ACTIVE'
              and cm.start_date <= v_date and coalesce(cm.end_date, 'infinity'::date) >= v_date;
            if cardinality(v_schedule_students) = 0 then continue; end if;
            if v_schedule.class_id = v_class_id or v_students && v_schedule_students then
              v_conflict := 'SCHEDULE_CONFLICT';
            elsif v_room is null or nullif(btrim(v_schedule.room), '') is null then
              v_conflict := 'ROOM_REQUIRED_FOR_OVERLAP';
            elsif lower(btrim(v_room)) = lower(btrim(v_schedule.room)) then
              v_conflict := 'ROOM_ALREADY_BOOKED';
            else
              v_conflict := null;
            end if;
            if v_conflict is not null then
              v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
                'date', v_date, 'class_id', v_class_id, 'code', v_conflict,
                'message', case v_conflict
                  when 'SCHEDULE_CONFLICT' then 'Lớp hoặc học sinh trùng với một lịch lặp chưa được sinh buổi.'
                  when 'ROOM_REQUIRED_FOR_OVERLAP' then 'Lịch lặp trùng giờ cần khai báo phòng cho cả hai lớp.'
                  when 'ROOM_ALREADY_BOOKED' then 'Phòng đã được đặt trong một lịch lặp trùng giờ.'
                  else 'Buổi bị trùng với một lịch lặp.' end));
            end if;
          end loop;
        end if;
      end if;
    end loop;
  end loop;

  -- Check each affected class against the final teacher set. Safe duplicate updates
  -- replace their old assignments, so those assignments must not count twice.
  for v_candidate in
    select assignments.class_id, count(distinct assignments.staff_id)::integer as teacher_count
    from (
      select cs.class_id, css.staff_id
      from public.class_schedules cs
      join public.class_schedule_staff css on css.schedule_id = cs.id
      where cs.status <> 'ARCHIVED'
        and cs.class_id in (
          select distinct (slot.value->>'class_id')::uuid
          from jsonb_array_elements(p_template) slot
        )
      union all
      select s.class_id, ss.staff_id
      from public.sessions s
      join public.session_staff ss on ss.session_id = s.id and ss.assignment_role = 'TEACHER'
      where s.status in ('SCHEDULED', 'IN_PROGRESS')
        and s.class_id in (
          select distinct (slot.value->>'class_id')::uuid
          from jsonb_array_elements(p_template) slot
        )
        and not exists (
          select 1 from jsonb_array_elements(v_actions) planned(action)
          where planned.action->>'action' = 'UPDATE'
            and (planned.action->>'session_id')::uuid = s.id
        )
      union all
      select (planned.action->>'class_id')::uuid, teacher.staff_id::uuid
      from jsonb_array_elements(v_actions) planned(action)
      cross join lateral jsonb_array_elements_text(planned.action->'staff_ids') teacher(staff_id)
      where planned.action->>'action' in ('CREATE', 'UPDATE')
    ) assignments
    group by assignments.class_id
  loop
    if v_candidate.teacher_count > 5 then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'date', p_month_start, 'class_id', v_candidate.class_id,
        'code', 'CLASS_TEACHER_LIMIT',
        'message', 'Lớp vượt giới hạn năm giáo viên duy nhất khi thêm mẫu lịch.'));
    end if;
  end loop;

  if p_range = 'REMAINING_DAYS' and jsonb_array_length(v_actions) = 0
     and jsonb_array_length(v_blockers) = 0 then
    raise exception 'NO_REMAINING_OCCURRENCES';
  end if;

  -- Detect conflicts among occurrences in this same input before any write.
  for v_candidate in
    select item.value, item.ordinality
    from jsonb_array_elements(v_actions) with ordinality item(value, ordinality)
    where item.value->>'action' in ('CREATE', 'UPDATE')
  loop
    v_class_id := (v_candidate.value->>'class_id')::uuid;
    v_start_at := (v_candidate.value->>'start_at')::timestamptz;
    v_end_at := (v_candidate.value->>'end_at')::timestamptz;
    v_target_room := nullif(btrim(v_candidate.value->>'room'), '');
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_target_students
    from jsonb_array_elements_text(v_candidate.value->'student_ids') student(value);
    for v_prior in
      select item.value
      from jsonb_array_elements(v_actions) with ordinality item(value, ordinality)
      where item.ordinality < v_candidate.ordinality
        and item.value->>'action' in ('CREATE', 'UPDATE')
        and (item.value->>'start_at')::timestamptz < v_end_at
        and (item.value->>'end_at')::timestamptz > v_start_at
    loop
      v_prior_room := nullif(btrim(v_prior.value->>'room'), '');
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_prior_students
      from jsonb_array_elements_text(v_prior.value->'student_ids') student(value);
      if (v_prior.value->>'class_id')::uuid = v_class_id or v_target_students && v_prior_students then
        v_conflict := 'SCHEDULE_CONFLICT';
      elsif v_target_room is null or v_prior_room is null then
        v_conflict := 'ROOM_REQUIRED_FOR_OVERLAP';
      elsif lower(v_target_room) = lower(v_prior_room) then
        v_conflict := 'ROOM_ALREADY_BOOKED';
      else
        v_conflict := null;
      end if;
      if v_conflict is not null then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'date', v_candidate.value->>'date', 'class_id', v_class_id, 'code', v_conflict,
          'message', case v_conflict
            when 'SCHEDULE_CONFLICT' then 'Các dòng mẫu xếp cùng lớp hoặc học sinh vào hai buổi trùng giờ.'
            when 'ROOM_REQUIRED_FOR_OVERLAP' then 'Các buổi trùng giờ cần khai báo phòng cho cả hai lớp.'
            when 'ROOM_ALREADY_BOOKED' then 'Các buổi trong mẫu đặt cùng một phòng vào khung giờ trùng nhau.'
            else 'Các buổi trong mẫu bị trùng lịch.' end));
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'month_start', p_month_start,
    'range', p_range,
    'create_count', v_created,
    'update_count', v_updated,
    'overwriteable_duplicate_count', v_overwriteable,
    'recurring_duplicate_count', v_recurring_duplicates,
    'skipped_duplicate_count', v_skipped,
    'protected_duplicate_count', v_protected,
    'blockers', v_blockers,
    'matches', v_matches,
    'actions', v_actions
  );
end;
$$;

revoke all on function public._build_month_week_template_addition_plan(date, jsonb, text, text)
  from public, anon, authenticated;

create or replace function public.admin_preview_month_week_template_addition(
  p_month_start date,
  p_template jsonb,
  p_range text,
  p_duplicate_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_plan jsonb;
begin
  v_plan := public._build_month_week_template_addition_plan(
    p_month_start, p_template, p_range, p_duplicate_action);
  return v_plan - 'actions';
end;
$$;

create or replace function public.admin_add_month_week_template(
  p_month_start date,
  p_template jsonb,
  p_range text,
  p_duplicate_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_plan jsonb;
  v_action jsonb;
  v_session_id uuid;
  v_source_schedule_id uuid;
  v_old jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_protected integer := 0;
  v_students uuid[];
  v_staff_ids uuid[];
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.class_schedules in share row exclusive mode;
  lock table public.sessions in share row exclusive mode;
  v_plan := public._build_month_week_template_addition_plan(
    p_month_start, p_template, p_range, p_duplicate_action);
  if jsonb_array_length(v_plan->'blockers') > 0 then
    raise exception using message = 'TEMPLATE_ADDITION_BLOCKED', detail = v_plan::text;
  end if;

  -- Remove all replaced teacher assignments first. This lets several safe
  -- duplicates swap teachers without tripping the five-teacher trigger halfway
  -- through an otherwise valid batch.
  for v_action in
    select value from jsonb_array_elements(v_plan->'actions')
    where value->>'action' = 'UPDATE'
  loop
    delete from public.session_staff
    where session_id = (v_action->>'session_id')::uuid and assignment_role = 'TEACHER';
  end loop;

  for v_action in select value from jsonb_array_elements(v_plan->'actions')
  loop
    if v_action->>'action' = 'PRESERVE' then
      v_protected := v_protected + 1;
    elsif v_action->>'action' in ('SKIP', 'SKIP_RECURRING') then
      v_skipped := v_skipped + 1;
    elsif v_action->>'action' = 'CREATE' then
      v_session_id := null;
      v_source_schedule_id := nullif(v_action->>'source_schedule_id', '')::uuid;
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_students
      from jsonb_array_elements_text(v_action->'student_ids') student(value);
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_staff_ids
      from jsonb_array_elements_text(v_action->'staff_ids') staff(value);
      insert into public.sessions (
        class_id, recurrence_schedule_id, recurrence_occurrence_date,
        scheduled_start_at, scheduled_end_at, room, manual_schedule,
        schedule_override, staff_assignment_override, room_override, status
      ) values (
        (v_action->>'class_id')::uuid,
        v_source_schedule_id,
        case when v_source_schedule_id is null then null else (v_action->>'date')::date end,
        (v_action->>'start_at')::timestamptz,
        (v_action->>'end_at')::timestamptz,
        nullif(v_action->>'room', ''),
        v_source_schedule_id is null,
        v_source_schedule_id is not null,
        v_source_schedule_id is not null,
        v_source_schedule_id is not null,
        'SCHEDULED'
      ) returning id into v_session_id;
      insert into public.session_students(session_id, student_id)
      select v_session_id, student_id from unnest(v_students) roster(student_id);
      insert into public.session_staff(session_id, staff_id, assignment_role)
      select v_session_id, staff_id, 'TEACHER' from unnest(v_staff_ids) teachers(staff_id);
      perform public.write_audit(v_actor, 'SESSION_MONTH_TEMPLATE_ADD_CREATE', 'sessions', v_session_id,
        null, jsonb_build_object('month_start', p_month_start, 'range', p_range,
          'date', v_action->>'date', 'class_id', v_action->>'class_id',
          'scheduled_start_at', v_action->>'start_at', 'scheduled_end_at', v_action->>'end_at',
          'room', v_action->>'room', 'staff_ids', v_action->'staff_ids',
          'roster_count', jsonb_array_length(v_action->'student_ids'),
          'recurrence_schedule_id', v_source_schedule_id),
        case when v_source_schedule_id is null then 'Admin added a month template occurrence.'
          else 'Admin added an occurrence override without changing the recurring schedule.' end);
      v_created := v_created + 1;
    elsif v_action->>'action' = 'UPDATE' then
      v_session_id := (v_action->>'session_id')::uuid;
      v_old := v_action->'previous';
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_students
      from jsonb_array_elements_text(v_action->'student_ids') student(value);
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_staff_ids
      from jsonb_array_elements_text(v_action->'staff_ids') staff(value);
      update public.sessions set room = nullif(v_action->>'room', ''),
        schedule_override = case when recurrence_schedule_id is null then schedule_override else true end,
        staff_assignment_override = case when recurrence_schedule_id is null then staff_assignment_override else true end,
        room_override = case when recurrence_schedule_id is null then room_override else true end
      where id = v_session_id;
      delete from public.session_students where session_id = v_session_id;
      insert into public.session_students(session_id, student_id)
      select v_session_id, student_id from unnest(v_students) roster(student_id);
      insert into public.session_staff(session_id, staff_id, assignment_role)
      select v_session_id, staff_id, 'TEACHER' from unnest(v_staff_ids) teachers(staff_id);
      perform public.write_audit(v_actor, 'SESSION_MONTH_TEMPLATE_ADD_UPDATE', 'sessions', v_session_id,
        v_old, jsonb_build_object('room', nullif(v_action->>'room', ''),
          'teachers', to_jsonb(v_staff_ids), 'students', to_jsonb(v_students)),
        'Admin updated a future scheduled occurrence from an additive month template; learning history was empty.');
      v_updated := v_updated + 1;
    end if;
  end loop;

  perform public.write_audit(v_actor, 'SESSION_MONTH_TEMPLATE_ADD', 'sessions', null,
    jsonb_build_object('month_start', p_month_start),
    jsonb_build_object('range', p_range, 'duplicate_action', p_duplicate_action,
      'created', v_created, 'updated', v_updated, 'skipped_duplicates', v_skipped,
      'protected_duplicates', v_protected),
    'Admin added weekly template occurrences without deleting existing sessions or suppressing recurring generation.');

  return jsonb_build_object('month_start', p_month_start, 'range', p_range,
    'created_sessions', v_created, 'updated_sessions', v_updated,
    'skipped_duplicates', v_skipped, 'protected_duplicates', v_protected);
end;
$$;

revoke all on function public.admin_preview_month_week_template_addition(date, jsonb, text, text)
  from public, anon;
grant execute on function public.admin_preview_month_week_template_addition(date, jsonb, text, text)
  to authenticated;
revoke all on function public.admin_add_month_week_template(date, jsonb, text, text)
  from public, anon;
grant execute on function public.admin_add_month_week_template(date, jsonb, text, text)
  to authenticated;
