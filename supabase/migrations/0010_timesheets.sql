create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  status public.timesheet_status not null default 'PENDING',
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, staff_id)
);

create trigger timesheets_set_updated_at before update on public.timesheets
for each row execute function public.set_updated_at();
