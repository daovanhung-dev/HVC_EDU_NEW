create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  year smallint not null check (year between 2000 and 2200),
  month smallint not null check (month between 1 and 12),
  status public.payroll_status not null default 'DRAFT',
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  session_id uuid references public.sessions(id) on delete restrict,
  timesheet_id uuid references public.timesheets(id) on delete restrict,
  salary_method public.salary_method not null,
  revenue_snapshot bigint not null default 0 check (revenue_snapshot >= 0),
  salary_percentage numeric(5,2) check (salary_percentage is null or salary_percentage between 0 and 100),
  fixed_amount bigint check (fixed_amount is null or fixed_amount >= 0),
  base_salary bigint not null default 0 check (base_salary >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, staff_id, session_id)
);

create table public.salary_adjustments (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  adjustment_type public.adjustment_type not null,
  amount bigint not null check (amount >= 0),
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create trigger payroll_periods_set_updated_at before update on public.payroll_periods
for each row execute function public.set_updated_at();
create trigger payroll_items_set_updated_at before update on public.payroll_items
for each row execute function public.set_updated_at();
