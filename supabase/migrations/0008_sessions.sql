create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_month_id uuid not null references public.class_months(id) on delete restrict,
  schedule_id uuid references public.class_month_schedules(id) on delete set null,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  status public.session_status not null default 'SCHEDULED',
  started_at timestamptz,
  started_by uuid references auth.users(id) on delete set null,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  lesson_content text,
  revenue_snapshot bigint not null default 0 check (revenue_snapshot >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at > scheduled_start_at)
);

create table public.session_students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  monthly_fee_snapshot bigint not null check (monthly_fee_snapshot >= 0),
  session_unit_value bigint not null default 0 check (session_unit_value >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table public.session_staff (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  assignment_role public.user_role not null check (assignment_role in ('TEACHER', 'ASSISTANT')),
  is_replacement boolean not null default false,
  original_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, staff_id)
);

create table public.staff_replacements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  original_staff_id uuid not null references public.staff(id) on delete restrict,
  replacement_staff_id uuid not null references public.staff(id) on delete restrict,
  reason text not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (original_staff_id <> replacement_staff_id)
);

create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_updated_at();
