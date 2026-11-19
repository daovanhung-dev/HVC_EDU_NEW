create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create table public.parent_feedback (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null check (char_length(btrim(parent_name)) between 1 and 120),
  student_name text check (student_name is null or char_length(btrim(student_name)) between 1 and 120),
  class_name text check (class_name is null or char_length(btrim(class_name)) between 1 and 80),
  feedback text not null check (char_length(btrim(feedback)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index parent_feedback_created_at_idx
  on public.parent_feedback (created_at desc, id desc);

alter table public.parent_feedback enable row level security;
revoke all on public.parent_feedback from public, anon, authenticated, service_role;
grant select on public.parent_feedback to authenticated;

create policy parent_feedback_admin_select
  on public.parent_feedback
  for select
  to authenticated
  using (exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'ACTIVE'
      and p.role in ('ADMIN', 'ROOT_ADMIN')
  ));

create table private.parent_feedback_rate_limit_events (
  network_key_hmac text not null check (network_key_hmac ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index parent_feedback_rate_limit_events_key_created_idx
  on private.parent_feedback_rate_limit_events (network_key_hmac, created_at desc);

revoke all on table private.parent_feedback_rate_limit_events
  from public, anon, authenticated, service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-parent-feedback-rate-limits';

select cron.schedule(
  'purge-parent-feedback-rate-limits',
  '15 * * * *',
  $job$delete from private.parent_feedback_rate_limit_events where created_at < now() - interval '24 hours';$job$
);

comment on table public.parent_feedback is
  'Private parent feedback; only active Admin and Root Admin accounts may read it.';
comment on table private.parent_feedback_rate_limit_events is
  'Temporary HMAC identifiers used to limit public parent-feedback submissions; rows are purged after 24 hours.';
