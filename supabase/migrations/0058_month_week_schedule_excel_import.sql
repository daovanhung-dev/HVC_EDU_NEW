-- Keep an editable, month-scoped weekly template and its generated occurrences.
-- This is independent from recurring class_schedules and never deletes sessions.

create table public.month_week_schedule_templates (
  month_start date primary key check (date_trunc('month', month_start)::date = month_start),
  slots jsonb not null check (jsonb_typeof(slots) = 'array'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.month_week_schedule_occurrences (
  month_start date not null references public.month_week_schedule_templates(month_start) on delete cascade,
  slot_id uuid not null,
  occurrence_date date not null,
  session_id uuid not null references public.sessions(id) on delete cascade,
  primary key (month_start, slot_id, occurrence_date),
  unique (session_id)
);

alter table public.month_week_schedule_templates enable row level security;
alter table public.month_week_schedule_occurrences enable row level security;
revoke all on public.month_week_schedule_templates, public.month_week_schedule_occurrences from public, anon, authenticated;
grant all on public.month_week_schedule_templates, public.month_week_schedule_occurrences to service_role;

create or replace function public._build_month_week_schedule_import_plan(
  p_month_start date,
  p_template jsonb
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
  v_month_start_at timestamptz;
  v_month_end_at timestamptz;
  v_slot jsonb;
  v_old jsonb;
  v_slot_id uuid;
  v_source_id uuid;
  v_class_id uuid;
  v_day integer;
  v_start_time time;
  v_end_time time;
  v_room text;
  v_staff_ids uuid[];
  v_students uuid[];
  v_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_session_id uuid;
  v_session_status public.session_status;
  v_action jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_previous jsonb;
  v_slot_count integer := 0;
  v_teacher_count integer;
  v_candidate record;
  v_existing record;
  v_prior record;
  v_prior_actions jsonb;
  v_conflict text;
  v_target_students uuid[];
  v_target_staff uuid[];
  v_mutating_ids uuid[] := '{}'::uuid[];
  v_cancel_ids uuid[] := '{}'::uuid[];
  v_can_cancel boolean;
  v_create_count integer := 0;
  v_update_count integer := 0;
  v_cancel_count integer := 0;
  v_preserve_count integer := 0;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start
     or coalesce(jsonb_typeof(p_template), '') <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;
  if p_month_start < date_trunc('month', v_today)::date then
    raise exception 'MONTH_IN_PAST';
  end if;
  if jsonb_array_length(p_template) = 0 then raise exception 'EMPTY_TEMPLATE'; end if;
  if jsonb_array_length(p_template) > 100 then raise exception 'TEMPLATE_LIMIT_EXCEEDED'; end if;

  -- Serialize with recurring generation, manual scheduling, and other imports.
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.sessions in share row exclusive mode;
  v_month_end := (p_month_start + interval '1 month')::date;
  v_month_start_at := p_month_start::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_month_end_at := v_month_end::timestamp at time zone 'Asia/Ho_Chi_Minh';
  select t.slots into v_previous
  from public.month_week_schedule_templates t where t.month_start = p_month_start;

  if (select count(distinct value->>'slot_id') from jsonb_array_elements(p_template)) <> jsonb_array_length(p_template) then
    raise exception 'DUPLICATE_SLOT_ID';
  end if;

  -- Validate the complete payload before planning any writes.
  for v_slot in select value from jsonb_array_elements(p_template)
  loop
    v_slot_count := v_slot_count + 1;
    if jsonb_typeof(v_slot) <> 'object'
       or coalesce(v_slot->>'slot_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_slot->>'day_of_week', '') !~ '^[1-7]$'
       or coalesce(jsonb_typeof(v_slot->'staff_ids'), '') <> 'array'
       or coalesce(jsonb_array_length(v_slot->'staff_ids'), 0) not between 1 and 5 then
      raise exception 'INVALID_TEMPLATE';
    end if;
    v_slot_id := (v_slot->>'slot_id')::uuid;
    v_class_id := (v_slot->>'class_id')::uuid;
    v_day := (v_slot->>'day_of_week')::integer;
    v_start_time := (v_slot->>'start_time')::time;
    v_end_time := (v_slot->>'end_time')::time;
    v_room := nullif(btrim(v_slot->>'room'), '');
    select coalesce(array_agg(value::uuid order by ordinal), '{}'::uuid[])
      into v_staff_ids
    from jsonb_array_elements_text(v_slot->'staff_ids') with ordinality staff(value, ordinal);
    if v_start_time is null or v_end_time is null or v_end_time <= v_start_time
       or cardinality(v_staff_ids) <> (select count(distinct id)::integer from unnest(v_staff_ids) teacher(id)) then
      raise exception 'INVALID_TEMPLATE';
    end if;
    if not exists (select 1 from public.classes c where c.id = v_class_id and c.status = 'ACTIVE') then
      raise exception 'CLASS_NOT_ACTIVE';
    end if;
    if (select count(*)::integer from public.staff st
        where st.id = any(v_staff_ids) and st.status = 'ACTIVE' and st.staff_type = 'TEACHER') <> cardinality(v_staff_ids) then
      raise exception 'TEACHER_NOT_ACTIVE';
    end if;
  end loop;

  -- Enforce the existing five-teacher-per-class rule across the whole weekly template.
  for v_candidate in
    select (slot.value->>'class_id')::uuid as class_id, array_agg(distinct teacher.value::uuid) as staff_ids
    from jsonb_array_elements(p_template) slot
    cross join lateral jsonb_array_elements_text(slot.value->'staff_ids') teacher(value)
    group by (slot.value->>'class_id')::uuid
  loop
    select count(distinct staff_id)::integer into v_teacher_count
    from unnest(v_candidate.staff_ids) staff(staff_id);
    if v_teacher_count > 5 then raise exception 'CLASS_TEACHER_LIMIT'; end if;
  end loop;

  -- Build all desired occurrences and resolve their existing session, if any.
  for v_slot in select value from jsonb_array_elements(p_template)
  loop
    v_slot_id := (v_slot->>'slot_id')::uuid;
    v_source_id := coalesce(nullif(v_slot->>'source_schedule_id', '')::uuid, v_slot_id);
    v_class_id := (v_slot->>'class_id')::uuid;
    v_day := (v_slot->>'day_of_week')::integer;
    v_start_time := (v_slot->>'start_time')::time;
    v_end_time := (v_slot->>'end_time')::time;
    v_room := nullif(btrim(v_slot->>'room'), '');
    select coalesce(array_agg(value::uuid order by ordinal), '{}'::uuid[])
      into v_staff_ids
    from jsonb_array_elements_text(v_slot->'staff_ids') with ordinality staff(value, ordinal);

    for v_date in
      select d::date from generate_series(p_month_start, v_month_end - 1, interval '1 day') d
      where extract(isodow from d)::integer = v_day
    loop
      v_start_at := (v_date + v_start_time) at time zone 'Asia/Ho_Chi_Minh';
      v_end_at := (v_date + v_end_time) at time zone 'Asia/Ho_Chi_Minh';
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

      v_session_id := null;
      select s.id, s.status into v_session_id, v_session_status
      from public.month_week_schedule_occurrences o
      join public.sessions s on s.id = o.session_id
      where o.month_start = p_month_start and o.slot_id = v_slot_id and o.occurrence_date = v_date
        and s.class_id = v_class_id
      for update of s;
      if v_session_id is null then
        select s.id, s.status into v_session_id, v_session_status
        from public.sessions s
        where s.recurrence_schedule_id = v_source_id and s.recurrence_occurrence_date = v_date
          and s.class_id = v_class_id
          and not exists (select 1 from public.month_week_schedule_occurrences mapped where mapped.session_id = s.id)
          and not exists (select 1 from jsonb_array_elements(v_actions) planned(item)
            where planned.item->>'action' = 'UPDATE' and planned.item->>'session_id' = s.id::text)
        order by s.id limit 1 for update;
      end if;
      if v_session_id is null then
        select s.id, s.status into v_session_id, v_session_status
        from public.sessions s
        where s.class_id = v_class_id
          and s.scheduled_start_at >= v_date::timestamp at time zone 'Asia/Ho_Chi_Minh'
          and s.scheduled_start_at < (v_date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh'
          and s.scheduled_start_at = v_start_at
          and not exists (select 1 from public.month_week_schedule_occurrences o where o.session_id = s.id)
          and not exists (select 1 from jsonb_array_elements(v_actions) planned(item)
            where planned.item->>'action' = 'UPDATE' and planned.item->>'session_id' = s.id::text)
        order by s.created_at, s.id limit 1 for update;
      end if;

      if v_session_id is null then
        if cardinality(v_students) = 0 then
          v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
            'slot_id', v_slot_id, 'date', v_date, 'code', 'NO_ACTIVE_STUDENTS',
            'message', 'Lớp không có học sinh có membership hiệu lực vào ngày này.'));
        end if;
        v_action := jsonb_build_object('action', 'CREATE', 'slot_id', v_slot_id, 'date', v_date,
          'class_id', v_class_id, 'start_at', v_start_at, 'end_at', v_end_at, 'room', v_room,
          'staff_ids', to_jsonb(v_staff_ids), 'conflict_staff_ids', to_jsonb(v_staff_ids), 'student_ids', to_jsonb(v_students));
        v_create_count := v_create_count + 1;
      else
        select coalesce(array_agg(ss.student_id order by ss.student_id), '{}'::uuid[])
          into v_students
        from public.session_students ss where ss.session_id = v_session_id;
      if v_session_status = 'CANCELLED' then
          v_action := jsonb_build_object('action', 'PRESERVE', 'slot_id', v_slot_id, 'date', v_date,
            'session_id', v_session_id, 'class_id', v_class_id, 'status', v_session_status,
            'reason', 'SESSION_ALREADY_CANCELLED');
          v_preserve_count := v_preserve_count + 1;
      elsif v_session_status in ('IN_PROGRESS', 'COMPLETED') and v_end_at > now() then
        v_action := jsonb_build_object('action', 'PRESERVE', 'slot_id', v_slot_id, 'date', v_date,
          'session_id', v_session_id, 'class_id', v_class_id, 'status', v_session_status,
          'reason', 'HISTORICAL_SESSION_MUST_REMAIN_PAST');
        v_preserve_count := v_preserve_count + 1;
        else
          v_action := jsonb_build_object('action', 'UPDATE', 'slot_id', v_slot_id, 'date', v_date,
            'session_id', v_session_id, 'class_id', v_class_id, 'status', v_session_status,
            'start_at', v_start_at, 'end_at', v_end_at, 'room', v_room,
            'staff_ids', to_jsonb(v_staff_ids),
            'conflict_staff_ids', case when
              exists (select 1 from public.staff_replacements r where r.session_id = v_session_id)
              or exists (select 1 from public.timesheets t where t.session_id = v_session_id)
              or exists (select 1 from public.payroll_items p where p.session_id = v_session_id
                or p.timesheet_id in (select t.id from public.timesheets t where t.session_id = v_session_id))
              then (select coalesce(jsonb_agg(ss.staff_id order by ss.staff_id), '[]'::jsonb)
                    from public.session_staff ss where ss.session_id = v_session_id and ss.assignment_role = 'TEACHER')
              else to_jsonb(v_staff_ids) end,
            'student_ids', to_jsonb(v_students));
          v_update_count := v_update_count + 1;
          v_mutating_ids := array_append(v_mutating_ids, v_session_id);
        end if;
      end if;
      v_actions := v_actions || jsonb_build_array(v_action);
    end loop;
  end loop;

  -- Sessions mapped by the previous import but omitted (or moved to another class) are canceled
  -- only when they are future SCHEDULED sessions without learning, payroll, or actual activity.
  if v_previous is not null then
    for v_prior in
      select o.session_id, o.slot_id, o.occurrence_date, s.status, s.scheduled_start_at, s.class_id,
        (old_slot.value->>'class_id')::uuid as old_class_id
      from public.month_week_schedule_occurrences o
      join public.sessions s on s.id = o.session_id
      cross join lateral jsonb_array_elements(v_previous) old_slot(value)
      where o.month_start = p_month_start and old_slot.value->>'slot_id' = o.slot_id::text
        and not exists (
          select 1 from jsonb_array_elements(p_template) next_slot(value)
          where next_slot.value->>'slot_id' = o.slot_id::text
            and next_slot.value->>'class_id' = old_slot.value->>'class_id'
            and (next_slot.value->>'day_of_week')::integer = extract(isodow from o.occurrence_date)::integer
        )
        and not (o.session_id = any(v_mutating_ids))
    loop
      select (
        v_prior.status = 'SCHEDULED' and v_prior.scheduled_start_at > now()
        and not exists (select 1 from public.student_attendances a where a.session_id = v_prior.session_id)
        and not exists (select 1 from public.session_students ss where ss.session_id = v_prior.session_id and ss.assessment_snapshot <> '{}'::jsonb)
        and not exists (select 1 from public.timesheets t where t.session_id = v_prior.session_id)
        and not exists (select 1 from public.payroll_items p where p.session_id = v_prior.session_id
          or p.timesheet_id in (select t.id from public.timesheets t where t.session_id = v_prior.session_id))
        and not exists (select 1 from public.staff_replacements r where r.session_id = v_prior.session_id)
        and not exists (select 1 from public.sessions s where s.id = v_prior.session_id
          and (s.started_at is not null or s.ended_at is not null or nullif(btrim(s.session_note), '') is not null
            or nullif(btrim(s.lesson_content), '') is not null or s.lesson_youtube_url is not null))
      ) into v_can_cancel;
      if v_can_cancel then
        v_actions := v_actions || jsonb_build_array(jsonb_build_object('action', 'CANCEL',
          'session_id', v_prior.session_id, 'slot_id', v_prior.slot_id, 'date', v_prior.occurrence_date,
          'class_id', v_prior.class_id));
        v_cancel_ids := array_append(v_cancel_ids, v_prior.session_id);
        v_cancel_count := v_cancel_count + 1;
      else
        v_actions := v_actions || jsonb_build_array(jsonb_build_object('action', 'PRESERVE',
          'session_id', v_prior.session_id, 'slot_id', v_prior.slot_id, 'date', v_prior.occurrence_date,
          'class_id', v_prior.class_id, 'reason', 'SESSION_HAS_HISTORY_OR_IS_NOT_FUTURE_SCHEDULED'));
        v_preserve_count := v_preserve_count + 1;
      end if;
    end loop;
  end if;

  -- On the first import there is no saved occurrence map yet. Reconcile recurring sessions
  -- directly from their source schedule IDs, while keeping unrelated manual sessions untouched.
  for v_prior in
    select s.id as session_id, s.recurrence_schedule_id as slot_id,
      coalesce(s.recurrence_occurrence_date, (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date) as occurrence_date,
      s.status, s.scheduled_start_at, s.class_id
    from public.sessions s
    where s.scheduled_start_at >= v_month_start_at and s.scheduled_start_at < v_month_end_at
      and s.recurrence_schedule_id is not null
      and not (s.id = any(v_mutating_ids))
      and not exists (select 1 from jsonb_array_elements(v_actions) a(value) where a.value->>'session_id' = s.id::text)
      and not exists (
        select 1 from jsonb_array_elements(p_template) slot(value)
        where slot.value->>'slot_id' = s.recurrence_schedule_id::text
          and slot.value->>'class_id' = s.class_id::text
          and (slot.value->>'day_of_week')::integer = extract(isodow from coalesce(s.recurrence_occurrence_date, (s.scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date))::integer
      )
  loop
    select (
      v_prior.status = 'SCHEDULED' and v_prior.scheduled_start_at > now()
      and not exists (select 1 from public.student_attendances a where a.session_id = v_prior.session_id)
      and not exists (select 1 from public.session_students ss where ss.session_id = v_prior.session_id and ss.assessment_snapshot <> '{}'::jsonb)
      and not exists (select 1 from public.timesheets t where t.session_id = v_prior.session_id)
      and not exists (select 1 from public.payroll_items p where p.session_id = v_prior.session_id
        or p.timesheet_id in (select t.id from public.timesheets t where t.session_id = v_prior.session_id))
      and not exists (select 1 from public.staff_replacements r where r.session_id = v_prior.session_id)
      and not exists (select 1 from public.sessions s where s.id = v_prior.session_id
        and (s.started_at is not null or s.ended_at is not null or nullif(btrim(s.session_note), '') is not null
          or nullif(btrim(s.lesson_content), '') is not null or s.lesson_youtube_url is not null))
    ) into v_can_cancel;
      if v_can_cancel then
      v_actions := v_actions || jsonb_build_array(jsonb_build_object('action', 'CANCEL',
        'session_id', v_prior.session_id, 'slot_id', v_prior.slot_id, 'date', v_prior.occurrence_date,
        'class_id', v_prior.class_id));
      v_cancel_ids := array_append(v_cancel_ids, v_prior.session_id);
      v_cancel_count := v_cancel_count + 1;
    else
      v_actions := v_actions || jsonb_build_array(jsonb_build_object('action', 'PRESERVE',
        'session_id', v_prior.session_id, 'slot_id', v_prior.slot_id, 'date', v_prior.occurrence_date,
        'class_id', v_prior.class_id, 'reason', 'SESSION_HAS_HISTORY_OR_IS_NOT_FUTURE_SCHEDULED'));
      v_preserve_count := v_preserve_count + 1;
    end if;
  end loop;

  select coalesce(array_agg(distinct (value->>'session_id')::uuid), '{}'::uuid[])
    into v_mutating_ids
  from jsonb_array_elements(v_actions)
  where value->>'action' = 'UPDATE' and value ? 'session_id';
  -- Also exclude future sessions which this import safely cancels.
  select coalesce(array_agg(distinct session_id), '{}'::uuid[]) into v_cancel_ids
  from unnest(v_cancel_ids) ids(session_id);

  -- Compare desired sessions against existing sessions outside this import's update/cancel set.
  for v_candidate in
    select plan.value as item, plan.ordinality
    from jsonb_array_elements(v_actions) with ordinality as plan(value, ordinality)
    where plan.value->>'action' in ('CREATE', 'UPDATE')
  loop
    v_session_id := nullif(v_candidate.item->>'session_id', '')::uuid;
    v_class_id := (v_candidate.item->>'class_id')::uuid;
    v_start_at := (v_candidate.item->>'start_at')::timestamptz;
    v_end_at := (v_candidate.item->>'end_at')::timestamptz;
    v_room := nullif(btrim(v_candidate.item->>'room'), '');
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_students
    from jsonb_array_elements_text(v_candidate.item->'student_ids') student(value);
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_target_staff
    from jsonb_array_elements_text(coalesce(v_candidate.item->'conflict_staff_ids', v_candidate.item->'staff_ids')) staff(value);
    if v_session_id is not null and exists (
      select 1 from public.session_staff assigned
      where assigned.session_id = v_session_id and assigned.assignment_role = 'ASSISTANT'
        and assigned.staff_id = any(v_target_staff)
    ) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'slot_id', v_candidate.item->>'slot_id', 'date', (v_candidate.item->>'date')::date,
        'code', 'STAFF_ROLE_CONFLICT', 'message', 'Giáo viên trong dòng này đang được phân công vai trò trợ giảng ở buổi hiện có.'));
    end if;
    for v_existing in
      select s.id, s.class_id, s.room
      from public.sessions s
      where s.id is distinct from v_session_id
        and not (s.id = any(v_mutating_ids)) and not (s.id = any(v_cancel_ids))
        and (s.status in ('SCHEDULED', 'IN_PROGRESS') or (v_start_at <= now() and s.status = 'COMPLETED'))
        and s.scheduled_start_at < v_end_at and s.scheduled_end_at > v_start_at
    loop
      if v_existing.class_id = v_class_id or exists (
        select 1 from public.session_students old_student
        where old_student.session_id = v_existing.id and old_student.student_id = any(v_students)
      ) then
        v_conflict := 'SCHEDULE_CONFLICT';
      elsif exists (
        select 1 from public.session_staff assigned
        where assigned.session_id = v_existing.id and assigned.staff_id = any(v_target_staff)
      ) then
        v_conflict := 'TEACHER_SCHEDULE_CONFLICT';
      elsif v_room is null or nullif(lower(btrim(v_existing.room)), '') is null then
        v_conflict := 'ROOM_REQUIRED_FOR_OVERLAP';
      elsif lower(btrim(v_room)) = lower(btrim(v_existing.room)) then
        v_conflict := 'ROOM_ALREADY_BOOKED';
      else
        v_conflict := null;
      end if;
      if v_conflict is not null then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'slot_id', v_candidate.item->>'slot_id', 'date', (v_candidate.item->>'date')::date,
          'code', v_conflict, 'message', case v_conflict
            when 'SCHEDULE_CONFLICT' then 'Lớp hoặc học sinh có buổi khác trùng giờ.'
            when 'TEACHER_SCHEDULE_CONFLICT' then 'Giáo viên được phân công có buổi khác trùng giờ.'
            when 'ROOM_REQUIRED_FOR_OVERLAP' then 'Các buổi trùng giờ cần có phòng cho cả hai lớp.'
            when 'ROOM_ALREADY_BOOKED' then 'Phòng này đã có buổi học khác trong khung giờ.'
            else 'Buổi bị trùng với một lịch khác đang tồn tại.' end));
      end if;
    end loop;

    -- Check overlapping rows inside this same weekly template.
    for v_prior in
      select plan.value as item
      from jsonb_array_elements(v_actions) with ordinality as plan(value, ordinality)
      where plan.value->>'action' in ('CREATE', 'UPDATE')
        and plan.ordinality < v_candidate.ordinality
        and (plan.value->>'start_at')::timestamptz < v_end_at
        and (plan.value->>'end_at')::timestamptz > v_start_at
    loop
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_target_students
      from jsonb_array_elements_text(v_prior.item->'student_ids') student(value);
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_target_staff
      from jsonb_array_elements_text(coalesce(v_prior.item->'conflict_staff_ids', v_prior.item->'staff_ids')) staff(value);
      if (v_prior.item->>'class_id')::uuid = v_class_id
         or v_students && v_target_students then
        v_conflict := 'SCHEDULE_CONFLICT';
      elsif exists (
        select 1 from jsonb_array_elements_text(coalesce(v_candidate.item->'conflict_staff_ids', v_candidate.item->'staff_ids')) current_staff(value)
        where value::uuid = any(v_target_staff)
      ) then
        v_conflict := 'TEACHER_SCHEDULE_CONFLICT';
      elsif v_room is null or nullif(btrim(v_prior.item->>'room'), '') is null then
        v_conflict := 'ROOM_REQUIRED_FOR_OVERLAP';
      elsif lower(btrim(v_room)) = lower(btrim(v_prior.item->>'room')) then
        v_conflict := 'ROOM_ALREADY_BOOKED';
      else
        v_conflict := null;
      end if;
      if v_conflict is not null then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'slot_id', v_candidate.item->>'slot_id', 'date', (v_candidate.item->>'date')::date,
          'code', v_conflict, 'message', case v_conflict
            when 'SCHEDULE_CONFLICT' then 'Các dòng trong tệp xếp lớp hoặc học sinh vào hai buổi trùng giờ.'
            when 'TEACHER_SCHEDULE_CONFLICT' then 'Các dòng trong tệp phân công giáo viên vào hai buổi trùng giờ.'
            when 'ROOM_REQUIRED_FOR_OVERLAP' then 'Các dòng trùng giờ cần nhập phòng cho cả hai lớp.'
            when 'ROOM_ALREADY_BOOKED' then 'Các dòng trong tệp đặt cùng một phòng vào khung giờ trùng nhau.'
            else 'Các dòng trong tệp có lịch bị trùng.' end));
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'month_start', p_month_start,
    'create_count', v_create_count,
    'update_count', v_update_count,
    'cancel_future_count', v_cancel_count,
    'preserve_history_count', v_preserve_count,
    'blockers', v_blockers,
    'actions', v_actions
  );
end;
$$;

revoke all on function public._build_month_week_schedule_import_plan(date, jsonb) from public, anon, authenticated;

create or replace function public.admin_get_month_week_schedule_template(p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_slots jsonb;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_month_start is null or date_trunc('month', p_month_start)::date <> p_month_start then raise exception 'INVALID_INPUT'; end if;
  select slots into v_slots from public.month_week_schedule_templates where month_start = p_month_start;
  if v_slots is null then return null; end if;
  return jsonb_build_object('month_start', p_month_start, 'slots', v_slots);
end;
$$;

create or replace function public.admin_preview_month_week_schedule_import(p_month_start date, p_template jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_plan jsonb;
begin
  v_plan := public._build_month_week_schedule_import_plan(p_month_start, p_template);
  return v_plan - 'actions';
end;
$$;

create or replace function public.admin_import_month_week_schedule(p_month_start date, p_template jsonb)
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
  v_old jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_cancelled integer := 0;
  v_preserved integer := 0;
begin
  if v_actor is null or not public.actor_has_permission(v_actor, 'CLASS_MANAGE') then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  lock table public.sessions in share row exclusive mode;
  v_plan := public._build_month_week_schedule_import_plan(p_month_start, p_template);
  if jsonb_array_length(v_plan->'blockers') > 0 then
    raise exception using message = 'IMPORT_BLOCKED', detail = v_plan::text;
  end if;
  insert into public.month_week_schedule_templates(month_start, slots, updated_by, updated_at)
  values (p_month_start, p_template, v_actor, now())
  on conflict (month_start) do update set slots = excluded.slots, updated_by = excluded.updated_by, updated_at = now();

  for v_action in select value from jsonb_array_elements(v_plan->'actions')
  loop
    if v_action->>'action' = 'CREATE' then
      insert into public.sessions(class_id, scheduled_start_at, scheduled_end_at, room, manual_schedule, status)
      values ((v_action->>'class_id')::uuid, (v_action->>'start_at')::timestamptz,
        (v_action->>'end_at')::timestamptz, nullif(v_action->>'room', ''), true, 'SCHEDULED')
      returning id into v_session_id;
      insert into public.session_students(session_id, student_id)
      select v_session_id, value::uuid from jsonb_array_elements_text(v_action->'student_ids');
      insert into public.session_staff(session_id, staff_id, assignment_role)
      select v_session_id, value::uuid, 'TEACHER' from jsonb_array_elements_text(v_action->'staff_ids');
      perform public.write_audit(v_actor, 'SESSION_MONTH_EXCEL_CREATE', 'sessions', v_session_id, null,
        jsonb_build_object('month_start', p_month_start, 'slot_id', v_action->>'slot_id',
          'date', v_action->>'date', 'class_id', v_action->>'class_id',
          'scheduled_start_at', v_action->>'start_at', 'scheduled_end_at', v_action->>'end_at',
          'room', v_action->>'room', 'staff_ids', v_action->'staff_ids',
          'roster_count', jsonb_array_length(v_action->'student_ids')));
      insert into public.month_week_schedule_occurrences(month_start, slot_id, occurrence_date, session_id)
      values (p_month_start, (v_action->>'slot_id')::uuid, (v_action->>'date')::date, v_session_id)
      on conflict (month_start, slot_id, occurrence_date) do update set session_id = excluded.session_id;
      v_created := v_created + 1;
    elsif v_action->>'action' = 'UPDATE' then
      v_session_id := (v_action->>'session_id')::uuid;
      select jsonb_build_object('scheduled_start_at', scheduled_start_at, 'scheduled_end_at', scheduled_end_at,
        'room', room, 'status', status, 'class_id', class_id) into v_old
      from public.sessions where id = v_session_id for update;
      update public.sessions set scheduled_start_at = (v_action->>'start_at')::timestamptz,
        scheduled_end_at = (v_action->>'end_at')::timestamptz,
        room = nullif(v_action->>'room', ''), manual_schedule = true,
        schedule_override = true, room_override = true
      where id = v_session_id;
      if not exists (select 1 from public.staff_replacements r where r.session_id = v_session_id)
         and not exists (select 1 from public.timesheets t where t.session_id = v_session_id)
         and not exists (select 1 from public.payroll_items p where p.session_id = v_session_id
           or p.timesheet_id in (select t.id from public.timesheets t where t.session_id = v_session_id)) then
        delete from public.session_staff where session_id = v_session_id and assignment_role = 'TEACHER';
        insert into public.session_staff(session_id, staff_id, assignment_role)
        select v_session_id, value::uuid, 'TEACHER' from jsonb_array_elements_text(v_action->'staff_ids');
      end if;
      perform public.write_audit(v_actor, 'SESSION_MONTH_EXCEL_UPDATE', 'sessions', v_session_id, v_old,
        jsonb_build_object('scheduled_start_at', v_action->>'start_at', 'scheduled_end_at', v_action->>'end_at',
          'room', v_action->>'room', 'status', v_action->>'status', 'slot_id', v_action->>'slot_id',
          'teacher_ids', v_action->'staff_ids'), 'Updated from the month-scoped Excel template; roster and learning data retained');
      insert into public.month_week_schedule_occurrences(month_start, slot_id, occurrence_date, session_id)
      values (p_month_start, (v_action->>'slot_id')::uuid, (v_action->>'date')::date, v_session_id)
      on conflict (month_start, slot_id, occurrence_date) do update set session_id = excluded.session_id;
      v_updated := v_updated + 1;
    elsif v_action->>'action' = 'CANCEL' then
      v_session_id := (v_action->>'session_id')::uuid;
      update public.sessions set status = 'CANCELLED', schedule_override = true where id = v_session_id and status = 'SCHEDULED';
      perform public.write_audit(v_actor, 'SESSION_MONTH_EXCEL_CANCEL', 'sessions', v_session_id,
        jsonb_build_object('status', 'SCHEDULED'), jsonb_build_object('status', 'CANCELLED',
          'month_start', p_month_start, 'slot_id', v_action->>'slot_id', 'date', v_action->>'date'),
        'Future scheduled session omitted from the month Excel template; linked data retained');
      v_cancelled := v_cancelled + 1;
    elsif v_action->>'action' = 'PRESERVE' then
      v_preserved := v_preserved + 1;
    end if;
  end loop;

  insert into public.class_schedule_month_overrides(month_start, created_by)
  values (p_month_start, v_actor)
  on conflict (month_start) do update set created_by = excluded.created_by, created_at = now();
  perform public.write_audit(v_actor, 'SESSION_MONTH_EXCEL_IMPORT', 'month_week_schedule_templates', null,
    jsonb_build_object('month_start', p_month_start),
    jsonb_build_object('slot_count', jsonb_array_length(p_template), 'created', v_created,
      'updated', v_updated, 'cancelled', v_cancelled, 'preserved', v_preserved),
    'Imported a month-scoped weekly schedule workbook');

  return jsonb_build_object('month_start', p_month_start, 'created_sessions', v_created,
    'updated_sessions', v_updated, 'cancelled_sessions', v_cancelled, 'preserved_sessions', v_preserved,
    'slot_count', jsonb_array_length(p_template));
end;
$$;

revoke all on function public.admin_get_month_week_schedule_template(date) from public, anon;
grant execute on function public.admin_get_month_week_schedule_template(date) to authenticated;
revoke all on function public.admin_preview_month_week_schedule_import(date, jsonb) from public, anon;
grant execute on function public.admin_preview_month_week_schedule_import(date, jsonb) to authenticated;
revoke all on function public.admin_import_month_week_schedule(date, jsonb) from public, anon;
grant execute on function public.admin_import_month_week_schedule(date, jsonb) to authenticated;
