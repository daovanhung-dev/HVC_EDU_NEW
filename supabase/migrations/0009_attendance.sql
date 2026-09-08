create table public.student_attendances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  status public.attendance_status not null,
  late_minutes integer check (late_minutes is null or late_minutes >= 0),
  absence_reason text,
  homework_score numeric(4,2) check (homework_score is null or homework_score between 0 and 10),
  comment text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create trigger student_attendances_set_updated_at before update on public.student_attendances
for each row execute function public.set_updated_at();
