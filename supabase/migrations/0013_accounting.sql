create table public.accounting_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  direction public.transaction_direction not null,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table public.accounting_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type public.transaction_type not null,
  direction public.transaction_direction not null,
  category_id uuid not null references public.accounting_categories(id) on delete restrict,
  source_type text,
  source_id uuid,
  amount bigint not null check (amount >= 0),
  transaction_date date not null default current_date,
  payment_method public.payment_method,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (transaction_type = 'MANUAL' or (source_type is not null and source_id is not null))
);

create unique index accounting_auto_source_uidx on public.accounting_transactions(transaction_type, source_type, source_id)
where transaction_type = 'AUTO';

create trigger accounting_transactions_set_updated_at before update on public.accounting_transactions
for each row execute function public.set_updated_at();
