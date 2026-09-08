create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  student_code text not null unique,
  full_name text not null,
  date_of_birth date,
  gender text,
  phone text,
  email text,
  address text,
  school text,
  current_grade text,
  parent_name text,
  parent_phone text,
  notes text,
  status public.entity_status not null default 'ACTIVE',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  staff_code text unique,
  staff_type public.user_role not null check (staff_type in ('TEACHER', 'ASSISTANT')),
  full_name text not null,
  phone text,
  email text,
  address text,
  notes text,
  status public.entity_status not null default 'ACTIVE',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger students_set_updated_at before update on public.students
for each row execute function public.set_updated_at();
create trigger staff_set_updated_at before update on public.staff
for each row execute function public.set_updated_at();
