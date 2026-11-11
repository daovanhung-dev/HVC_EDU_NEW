begin;

select plan(19);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('f0660000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-rental-admin@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('f0660000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-rental-teacher@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (user_id, role, username, display_name, status, force_password_change) values
  ('f0660000-0000-0000-0000-000000000001', 'ADMIN', 'QA-RENTAL-ADMIN', 'QA Rental Admin', 'ACTIVE', false),
  ('f0660000-0000-0000-0000-000000000002', 'TEACHER', 'QA-RENTAL-TEACHER', 'QA Rental Teacher', 'ACTIVE', false);

insert into public.staff (id, user_id, staff_code, staff_type, full_name, status) values
  ('f0660000-0000-0000-0000-000000000101', 'f0660000-0000-0000-0000-000000000002', 'QA-RENTAL-T-001', 'TEACHER', 'QA Rental Teacher', 'ACTIVE');

insert into public.subjects (id, code, name, status)
values ('f0660000-0000-0000-0000-000000000201', 'QA-RENTAL-SUBJECT', 'QA Rental Subject', 'ACTIVE');
insert into public.grades (id, code, name, status)
values ('f0660000-0000-0000-0000-000000000202', 'QA-RENTAL-GRADE', 'QA Rental Grade', 'ACTIVE');
insert into public.classes (id, code, name, subject_id, grade_id, status) values
  ('f0660000-0000-0000-0000-000000000301', 'QA-RENTAL-CLASS-A', 'QA Rental Class A', 'f0660000-0000-0000-0000-000000000201', 'f0660000-0000-0000-0000-000000000202', 'ACTIVE'),
  ('f0660000-0000-0000-0000-000000000302', 'QA-RENTAL-CLASS-B', 'QA Rental Class B', 'f0660000-0000-0000-0000-000000000201', 'f0660000-0000-0000-0000-000000000202', 'ACTIVE'),
  ('f0660000-0000-0000-0000-000000000303', 'QA-RENTAL-CLASS-C', 'QA Rental Class C', 'f0660000-0000-0000-0000-000000000201', 'f0660000-0000-0000-0000-000000000202', 'ACTIVE');

create temporary table qa_room_rental_context on commit drop as
select (
  current_date + 70
  + ((1 - extract(isodow from current_date + 70)::integer + 7) % 7)
)::date as booking_date;

insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at)
select 'f0660000-0000-0000-0000-000000000401',
  'f0660000-0000-0000-0000-000000000301', 1, '08:00', '09:00', 'QA-Recurring-A', 'ACTIVE', now();
insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at)
values ('f0660000-0000-0000-0000-000000000402', 'f0660000-0000-0000-0000-000000000302', 1, '12:00', '13:00', null, 'ACTIVE', now());

insert into public.room_rentals (id, staff_id, room, starts_at, ends_at, created_by)
select 'f0660000-0000-0000-0000-000000000501', 'f0660000-0000-0000-0000-000000000101', 'QA-A1',
  (booking_date + time '10:00') at time zone 'Asia/Ho_Chi_Minh',
  (booking_date + time '11:00') at time zone 'Asia/Ho_Chi_Minh',
  'f0660000-0000-0000-0000-000000000001'
from qa_room_rental_context;

select lives_ok($$
  insert into public.room_rentals (id, staff_id, room, starts_at, ends_at, created_by)
  select 'f0660000-0000-0000-0000-000000000502', 'f0660000-0000-0000-0000-000000000101', 'QA-B2',
    (booking_date + time '10:00') at time zone 'Asia/Ho_Chi_Minh',
    (booking_date + time '11:00') at time zone 'Asia/Ho_Chi_Minh',
    'f0660000-0000-0000-0000-000000000001'
  from qa_room_rental_context
$$, 'two bookings at the same time are allowed when rooms differ');

select is(
  public.room_rental_conflict_reason(
    null,
    ((select booking_date from qa_room_rental_context) + time '10:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + time '10:45') at time zone 'Asia/Ho_Chi_Minh',
    ' qa-a1 '
  ),
  'ROOM_ALREADY_BOOKED'::text,
  'room collision comparison trims spaces and ignores case'
);

select is(
  public.room_rental_conflict_reason(
    null,
    ((select booking_date from qa_room_rental_context) + time '10:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + time '10:45') at time zone 'Asia/Ho_Chi_Minh',
    'QA-C3'
  ),
  null::text,
  'a different room can be booked during the same interval'
);

insert into public.sessions (id, class_id, scheduled_start_at, scheduled_end_at, status, room, manual_schedule)
select 'f0660000-0000-0000-0000-000000000601', 'f0660000-0000-0000-0000-000000000303',
  ((booking_date + 1 + time '14:00') at time zone 'Asia/Ho_Chi_Minh'),
  ((booking_date + 1 + time '15:00') at time zone 'Asia/Ho_Chi_Minh'),
  'SCHEDULED', 'QA-SESSION-ROOM', true
from qa_room_rental_context;

select is(
  public.room_rental_conflict_reason(
    null,
    ((select booking_date from qa_room_rental_context) + 1 + time '14:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + 1 + time '14:45') at time zone 'Asia/Ho_Chi_Minh',
    ' qa-session-room '
  ),
  'ROOM_ALREADY_BOOKED'::text,
  'bookings conflict with a scheduled class session using normalized room names'
);

select is(
  public.room_rental_conflict_reason(
    null,
    ((select booking_date from qa_room_rental_context) + 7 + time '08:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + 7 + time '08:45') at time zone 'Asia/Ho_Chi_Minh',
    'qa-recurring-a'
  ),
  'ROOM_ALREADY_BOOKED'::text,
  'unmaterialized recurring class schedules block the same room beyond the generation horizon'
);

select is(
  public.room_rental_conflict_reason(
    null,
    ((select booking_date from qa_room_rental_context) + 7 + time '12:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + 7 + time '12:45') at time zone 'Asia/Ho_Chi_Minh',
    'QA-UNKNOWN-ROOM'
  ),
  'ROOM_REQUIRED_FOR_OVERLAP'::text,
  'an unmaterialized recurring schedule without a room blocks rental creation'
);

select is(
  public.session_schedule_conflict_reason(
    null,
    'f0660000-0000-0000-0000-000000000301',
    ((select booking_date from qa_room_rental_context) + time '10:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + time '10:45') at time zone 'Asia/Ho_Chi_Minh',
    'QA-A1',
    '{}'::uuid[]
  ),
  'ROOM_ALREADY_BOOKED'::text,
  'class session creation checks room-rental bookings'
);

select is(
  public.session_schedule_conflict_reason(
    null,
    'f0660000-0000-0000-0000-000000000301',
    ((select booking_date from qa_room_rental_context) + time '10:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + time '10:45') at time zone 'Asia/Ho_Chi_Minh',
    null,
    '{}'::uuid[]
  ),
  'ROOM_REQUIRED_FOR_OVERLAP'::text,
  'a class session cannot overlap a rental when its room is unspecified'
);

select throws_ok($$
  insert into public.room_rentals (id, staff_id, room, starts_at, ends_at, created_by)
  select 'f0660000-0000-0000-0000-000000000503', 'f0660000-0000-0000-0000-000000000101', ' qa-a1 ',
    (booking_date + time '10:30') at time zone 'Asia/Ho_Chi_Minh',
    (booking_date + time '11:30') at time zone 'Asia/Ho_Chi_Minh',
    'f0660000-0000-0000-0000-000000000001'
  from qa_room_rental_context
$$, 'P0001', 'ROOM_ALREADY_BOOKED', 'database trigger rejects a normalized same-room overlap');

select throws_ok($$
  insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at)
  values ('f0660000-0000-0000-0000-000000000403', 'f0660000-0000-0000-0000-000000000303', 1, '10:00', '11:00', ' qa-a1 ', 'ACTIVE', now())
$$, 'P0001', 'ROOM_ALREADY_BOOKED', 'activating a recurring schedule cannot claim a room already rented that weekday');

select lives_ok($$
  insert into public.class_schedules (id, class_id, day_of_week, start_time, end_time, room, status, reviewed_at)
  values ('f0660000-0000-0000-0000-000000000404', 'f0660000-0000-0000-0000-000000000303', 1, '10:00', '11:00', 'QA-DIFFERENT-ROOM', 'ACTIVE', now())
$$, 'an overlapping recurring class may use a different room');

select ok(has_table_privilege('authenticated', 'public.room_rentals', 'SELECT'), 'authenticated role has the select grant for RLS-protected reads');
select ok(not has_table_privilege('authenticated', 'public.room_rentals', 'INSERT'), 'authenticated role cannot insert room rentals directly');
select ok(not has_table_privilege('authenticated', 'public.room_rentals', 'UPDATE'), 'authenticated role cannot update room rentals directly');
select ok(not has_table_privilege('authenticated', 'public.room_rentals', 'DELETE'), 'authenticated role cannot delete room rentals directly');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0660000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.room_rentals), 2, 'Admin can read the concrete rental rows');

select set_config('request.jwt.claim.sub', 'f0660000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.room_rentals), 0, 'teacher cannot read room rentals');
reset role;

update public.room_rentals
set status = 'CANCELLED', cancelled_at = now(), cancelled_by = 'f0660000-0000-0000-0000-000000000001'
where id = 'f0660000-0000-0000-0000-000000000501';
select is(
  public.room_rental_conflict_reason(
    null,
    ((select booking_date from qa_room_rental_context) + time '10:15') at time zone 'Asia/Ho_Chi_Minh',
    ((select booking_date from qa_room_rental_context) + time '10:45') at time zone 'Asia/Ho_Chi_Minh',
    'QA-A1'
  ),
  null::text,
  'cancelling one rental releases only its room interval'
);
select is((select count(*)::integer from public.room_rentals where id = 'f0660000-0000-0000-0000-000000000501' and status = 'CANCELLED'), 1, 'cancelled rental remains as history');

select * from finish();
rollback;
