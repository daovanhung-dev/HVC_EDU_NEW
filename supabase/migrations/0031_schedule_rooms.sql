alter table public.class_month_schedules
  add column if not exists room text;

alter table public.class_month_schedules
  drop constraint if exists class_month_schedules_room_check;

alter table public.class_month_schedules
  add constraint class_month_schedules_room_check
  check (room is null or length(trim(room)) between 1 and 100);
