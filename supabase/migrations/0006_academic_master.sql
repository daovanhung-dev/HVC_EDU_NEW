create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  default_monthly_fee bigint not null default 0 check (default_monthly_fee >= 0),
  max_students integer check (max_students is null or max_students > 0),
  capacity_policy public.capacity_policy not null default 'UNLIMITED',
  status public.entity_status not null default 'ACTIVE',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  start_date date not null,
  end_date date,
  status public.entity_status not null default 'ACTIVE',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create trigger subjects_set_updated_at before update on public.subjects
for each row execute function public.set_updated_at();
create trigger grades_set_updated_at before update on public.grades
for each row execute function public.set_updated_at();
create trigger classes_set_updated_at before update on public.classes
for each row execute function public.set_updated_at();
