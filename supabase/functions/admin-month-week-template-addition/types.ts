export type TemplateRange = "FULL_MONTH" | "REMAINING_DAYS";
export type DuplicateAction = "OVERWRITE_SAFE" | "SKIP";

export interface TemplateSlot {
  day_of_week: number;
  class_id: string;
  start_time: string;
  end_time: string;
  room?: string | null;
  staff_ids: string[];
}

export interface TemplateInput {
  operation: "preview" | "apply";
  month_start: string;
  template: TemplateSlot[];
  range: TemplateRange;
  duplicate_action: DuplicateAction;
}

export interface TemplateMatch {
  date: string;
  class_id: string;
  action: "UPDATE" | "CREATE" | "SKIP" | "PRESERVE" | "BLOCKED";
  reason: string | null;
}

export interface TemplateBlocker {
  date: string;
  class_id: string;
  code: string;
  message: string;
}

export interface TemplateAction extends Record<string, unknown> {
  action: "CREATE" | "UPDATE" | "SKIP" | "SKIP_RECURRING" | "PRESERVE";
  class_id: string;
  date: string;
  start_at: string;
  end_at: string;
  room: string | null;
  staff_ids: string[];
  student_ids: string[];
  session_id: string | null;
  source_schedule_id: string | null;
  previous?: { room: string | null; teachers: string[]; students: string[] };
}

export interface TemplatePlan {
  month_start: string;
  range: TemplateRange;
  create_count: number;
  update_count: number;
  overwriteable_duplicate_count: number;
  recurring_duplicate_count: number;
  skipped_duplicate_count: number;
  protected_duplicate_count: number;
  blockers: TemplateBlocker[];
  matches: TemplateMatch[];
  actions: TemplateAction[];
}

export type TemplatePreview = Omit<TemplatePlan, "actions">;

export interface TemplateApplyResult {
  month_start: string;
  range: TemplateRange;
  created_sessions: number;
  updated_sessions: number;
  skipped_duplicates: number;
  protected_duplicates: number;
}

export interface TemplateCaller {
  user: { id: string };
  profile: { role: string; status?: string };
}
