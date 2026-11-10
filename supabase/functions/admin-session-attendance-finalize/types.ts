export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

export interface StudentAttendanceInput {
  student_id: string;
  status: AttendanceStatus;
  late_minutes: number | null;
  absence_reason: string | null;
  homework_score: number | null;
  homework_note: string | null;
  understanding_score: number | null;
  attitude_score: number | null;
  positive_feedback_count: number | null;
  positive_feedback_raw: string | null;
  comment: string | null;
}

export interface TeacherDecisionInput {
  staff_id: string;
  eligible: boolean;
}

export interface FinalizeSessionInput {
  session_id: string;
  session_note: string | null;
  lesson_youtube_url: string | null;
  students: StudentAttendanceInput[];
  teacher_decisions: TeacherDecisionInput[];
}

export interface FinalizeSessionResult {
  session_id: string;
  status: "COMPLETED";
  students_updated: number;
  timesheets_approved: number;
  teachers_not_eligible: number;
  ended_at: string;
  ended_by: string | null;
}

export interface FinalizeCaller {
  user: { id: string };
  profile: { role: string; status: string };
}
