create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  role public.user_role not null,
  username text,
  display_name text,
  phone text,
  email text,
  status public.account_status not null default 'ACTIVE',
  force_password_change boolean not null default true,
  last_login_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_uidx on public.profiles (lower(username)) where username is not null;
create unique index profiles_phone_uidx on public.profiles (phone) where phone is not null;
create unique index profiles_email_lower_uidx on public.profiles (lower(email)) where email is not null;
create index profiles_user_id_idx on public.profiles(user_id);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
