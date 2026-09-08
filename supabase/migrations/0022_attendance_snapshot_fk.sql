alter table public.student_attendances
  add constraint student_attendances_session_student_fk
  foreign key (session_id, student_id)
  references public.session_students(session_id, student_id)
  on delete restrict;
