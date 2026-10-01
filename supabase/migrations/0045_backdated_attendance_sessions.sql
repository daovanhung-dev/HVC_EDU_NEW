-- Allow Admin to create historical sessions for make-up attendance while
-- retaining the same permission checks and schedule conflict rules.

create or replace function public.session_schedule_conflict_reason(
  p_session_id uuid,
  p_class_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_room text,
  p_student_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_other record;
  v_room text := nullif(lower(btrim(p_room)), '');
begin
  for v_other in
    select s.id, s.class_id, s.room
    from public.sessions s
    where s.id is distinct from p_session_id
      and (
        s.status in ('SCHEDULED', 'IN_PROGRESS')
        or (p_start_at <= now() and s.status = 'COMPLETED')
      )
      and s.scheduled_start_at < p_end_at
      and s.scheduled_end_at > p_start_at
    order by s.scheduled_start_at, s.id
  loop
    if v_other.class_id = p_class_id
       or exists (
         select 1
         from public.session_students existing_student
         where existing_student.session_id = v_other.id
           and existing_student.student_id = any(coalesce(p_student_ids, '{}'::uuid[]))
       ) then
      return 'SCHEDULE_CONFLICT';
    end if;

    if v_room is null or nullif(lower(btrim(v_other.room)), '') is null then
      return 'ROOM_REQUIRED_FOR_OVERLAP';
    end if;
    if v_room = nullif(lower(btrim(v_other.room)), '') then
      return 'ROOM_ALREADY_BOOKED';
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.admin_create_session(
  p_class_id uuid,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_staff_ids uuid[],
  p_room text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_day date;
  v_students uuid[];
  v_count integer;
  v_room text := nullif(btrim(p_room), '');
  v_conflict_reason text;
begin
  if auth.uid() is null or not public.actor_has_permission(auth.uid(), 'CLASS_MANAGE') then
    raise exception 'FORBIDDEN';
  end if;
  if p_class_id is null or p_scheduled_start_at is null or p_scheduled_end_at is null
     or p_scheduled_end_at <= p_scheduled_start_at
     or (p_scheduled_end_at at time zone 'Asia/Ho_Chi_Minh')::date <> (p_scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date
     or p_staff_ids is null or cardinality(p_staff_ids) = 0 then
    raise exception 'INVALID_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtext('continuous-class-session-generator'));
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and (c.status = 'ACTIVE' or p_scheduled_start_at <= now())
  ) then
    raise exception 'CLASS_NOT_ACTIVE';
  end if;

  select count(distinct staff_id)::integer into v_count from unnest(p_staff_ids) as staff(staff_id);
  if v_count <> cardinality(p_staff_ids) then raise exception 'DUPLICATE_TEACHER'; end if;
  select count(*)::integer into v_count from public.staff
  where id = any(p_staff_ids) and status = 'ACTIVE' and staff_type = 'TEACHER';
  if v_count <> cardinality(p_staff_ids) then raise exception 'TEACHER_NOT_ACTIVE'; end if;

  v_day := (p_scheduled_start_at at time zone 'Asia/Ho_Chi_Minh')::date;
  if p_scheduled_start_at <= now() then
    select array_agg(distinct cm.student_id order by cm.student_id) into v_students
    from public.class_memberships cm
    where cm.class_id = p_class_id
      and cm.start_date <= v_day
      and coalesce(cm.end_date, 'infinity'::date) >= v_day;
  else
    select array_agg(distinct cm.student_id order by cm.student_id) into v_students
    from public.class_memberships cm
    join public.students st on st.id = cm.student_id
    where cm.class_id = p_class_id
      and cm.status = 'ACTIVE'
      and st.status = 'ACTIVE'
      and cm.start_date <= v_day
      and coalesce(cm.end_date, 'infinity'::date) >= v_day;
  end if;
  if coalesce(cardinality(v_students), 0) = 0 then raise exception 'NO_ACTIVE_STUDENTS'; end if;

  v_conflict_reason := public.session_schedule_conflict_reason(
    null, p_class_id, p_scheduled_start_at, p_scheduled_end_at, v_room, v_students
  );
  if v_conflict_reason is not null then
    raise exception using message = v_conflict_reason;
  end if;

  insert into public.sessions(class_id, scheduled_start_at, scheduled_end_at, room, manual_schedule)
  values (p_class_id, p_scheduled_start_at, p_scheduled_end_at, v_room, true)
  returning id into v_session_id;
  insert into public.session_students(session_id, student_id)
  select v_session_id, student_id from unnest(v_students) as roster(student_id);
  insert into public.session_staff(session_id, staff_id, assignment_role)
  select v_session_id, staff_id, 'TEACHER' from unnest(p_staff_ids) as teachers(staff_id);
  perform public.write_audit(auth.uid(), 'SESSION_MANUAL_CREATE', 'sessions', v_session_id, null,
    jsonb_build_object('class_id', p_class_id, 'scheduled_start_at', p_scheduled_start_at,
      'scheduled_end_at', p_scheduled_end_at, 'room', v_room, 'staff_ids', p_staff_ids,
      'roster_count', cardinality(v_students)));
  return jsonb_build_object('session_id', v_session_id, 'status', 'SCHEDULED', 'students_count', cardinality(v_students));
end;
$$;

-- Keep the four-argument overload and authenticated grants created by migration 0044.
