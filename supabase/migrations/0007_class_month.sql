create table public.class_months (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  year smallint not null check (year between 2000 and 2200),
  month smallint not null check (month between 1 and 12),
  status public.class_month_status not null default 'DRAFT',
  copied_from_id uuid references public.class_months(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, year, month)
);

create table public.class_month_students (
  id uuid primary key default gen_random_uuid(),
  class_month_id uuid not null references public.class_months(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  membership_start_date date not null,
  membership_end_date date,
  monthly_fee_snapshot bigint not null check (monthly_fee_snapshot >= 0),
  created_at timestamptz not null default now(),
  check (membership_end_date is null or membership_end_date >= membership_start_date),
  unique (class_month_id, student_id)
);

create table public.class_month_staff (
  id uuid primary key default gen_random_uuid(),
  class_month_id uuid not null references public.class_months(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  assignment_role public.user_role not null check (assignment_role in ('TEACHER', 'ASSISTANT')),
  created_at timestamptz not null default now(),
  unique (class_month_id, staff_id)
);

create table public.class_month_schedules (
  id uuid primary key default gen_random_uuid(),
  class_month_id uuid not null references public.class_months(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create trigger class_months_set_updated_at before update on public.class_months
for each row execute function public.set_updated_at();
create trigger class_month_schedules_set_updated_at before update on public.class_month_schedules
for each row execute function public.set_updated_at();
