create table public.permission_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.permission_group_permissions (
  permission_group_id uuid not null references public.permission_groups(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (permission_group_id, permission_id)
);

create table public.admin_permission_groups (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_group_id uuid not null references public.permission_groups(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_group_id)
);
