create table public.tuition_records (
  id uuid primary key default gen_random_uuid(),
  class_month_id uuid not null references public.class_months(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  status public.tuition_status not null default 'UNPAID',
  monthly_fee_snapshot bigint not null check (monthly_fee_snapshot >= 0),
  amount_due bigint not null check (amount_due >= 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  payment_method public.payment_method,
  paid_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_month_id, student_id),
  check ((status = 'UNPAID' and paid_at is null) or (status = 'PAID' and paid_at is not null)),
  check (status = 'UNPAID' or amount_paid = amount_due)
);

create trigger tuition_records_set_updated_at before update on public.tuition_records
for each row execute function public.set_updated_at();
