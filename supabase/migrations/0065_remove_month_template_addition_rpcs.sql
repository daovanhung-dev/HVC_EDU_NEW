-- The additive month-template workflow is served by the authenticated Edge Function.
-- Keep migration 0064 immutable, then remove its public RPCs and private planner.
drop function if exists public.admin_preview_month_week_template_addition(date, jsonb, text, text);
drop function if exists public.admin_add_month_week_template(date, jsonb, text, text);
drop function if exists public._build_month_week_template_addition_plan(date, jsonb, text, text);

notify pgrst, 'reload schema';
