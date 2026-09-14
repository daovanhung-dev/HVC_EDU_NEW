-- Attendance/assessment fields used by the September 2026 workbook import.
-- Existing RLS policies remain unchanged; these are additional columns only.
alter table public.student_attendances
  add column if not exists understanding_score smallint,
  add column if not exists attitude_score smallint,
  add column if not exists positive_feedback_count integer,
  add column if not exists positive_feedback_raw text,
  add column if not exists homework_note text,
  add column if not exists import_source_key text;

alter table public.session_students
  add column if not exists assessment_snapshot jsonb not null default '{}'::jsonb;

alter table public.sessions
  add column if not exists session_note text,
  add column if not exists import_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_attendances_understanding_score_check'
      and conrelid = 'public.student_attendances'::regclass
  ) then
    alter table public.student_attendances
      add constraint student_attendances_understanding_score_check
      check (understanding_score is null or understanding_score between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_attendances_attitude_score_check'
      and conrelid = 'public.student_attendances'::regclass
  ) then
    alter table public.student_attendances
      add constraint student_attendances_attitude_score_check
      check (attitude_score is null or attitude_score between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_attendances_positive_feedback_count_check'
      and conrelid = 'public.student_attendances'::regclass
  ) then
    alter table public.student_attendances
      add constraint student_attendances_positive_feedback_count_check
      check (positive_feedback_count is null or positive_feedback_count >= 0);
  end if;
end
$$;

create unique index if not exists student_attendances_import_source_key_uidx
  on public.student_attendances(import_source_key)
  where import_source_key is not null;

comment on column public.student_attendances.understanding_score is
  'Source assessment: understanding score on a 1-5 scale.';
comment on column public.student_attendances.attitude_score is
  'Source assessment: learning attitude score on a 1-5 scale.';
comment on column public.student_attendances.positive_feedback_count is
  'Numeric source value for the number of positive feedback marks.';
comment on column public.student_attendances.positive_feedback_raw is
  'Original source value, including values such as 27+ that are not numeric.';
comment on column public.student_attendances.homework_note is
  'Original non-numeric homework value, for example Không có BTVN.';
comment on column public.student_attendances.import_source_key is
  'Stable import key used for idempotent attendance imports.';
comment on column public.session_students.assessment_snapshot is
  'Original assessment row, including rows without an attendance status.';
comment on column public.sessions.session_note is
  'Note recorded for the lesson in the source workbook.';
comment on column public.sessions.import_metadata is
  'Source workbook/block metadata and import decision audit trail.';
