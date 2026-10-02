import { adminClient, requireCaller } from "../_shared/auth.ts";
import { createStudentAiTutorHandler } from "./handler.ts";

const handler = createStudentAiTutorHandler({
  getCaller: requireCaller,
  isActiveStudent: async (userId) => {
    const { data, error } = await adminClient().from("students").select("id")
      .eq("user_id", userId).eq("status", "ACTIVE").maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },
  getLessonContext: async (userId, sessionId) => {
    const client = adminClient();
    const { data: student, error: studentError } = await client.from("students").select("id")
      .eq("user_id", userId).eq("status", "ACTIVE").maybeSingle();
    if (studentError) throw studentError;
    if (!student) return null;
    const { data, error } = await client.from("sessions")
      .select("id,scheduled_start_at,status,session_note,classes(name,subjects(name)),session_students!inner(student_id)")
      .eq("id", sessionId).eq("status", "COMPLETED")
      .eq("session_students.student_id", student.id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const klass = Array.isArray(data.classes) ? data.classes[0] : data.classes;
    const subject = klass && (Array.isArray(klass.subjects) ? klass.subjects[0] : klass.subjects);
    return {
      class_name: klass?.name || "Lớp học",
      subject_name: subject?.name || null,
      scheduled_start_at: data.scheduled_start_at,
      session_note: data.session_note,
    };
  },
  getApiKey: () => Deno.env.get("GEMINI_API_KEY"),
});

Deno.serve(handler);
