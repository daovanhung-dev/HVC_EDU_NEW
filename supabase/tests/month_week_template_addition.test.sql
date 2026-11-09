begin;
select plan(3);

select is(
  to_regprocedure('public.admin_preview_month_week_template_addition(date,jsonb,text,text)'),
  null::regprocedure,
  'preview is no longer exposed as a PostgREST RPC'
);
select is(
  to_regprocedure('public.admin_add_month_week_template(date,jsonb,text,text)'),
  null::regprocedure,
  'apply is no longer exposed as a PostgREST RPC'
);
select is(
  to_regprocedure('public._build_month_week_template_addition_plan(date,jsonb,text,text)'),
  null::regprocedure,
  'the old persistent planner is removed after migration 0065'
);

select * from finish();
rollback;
