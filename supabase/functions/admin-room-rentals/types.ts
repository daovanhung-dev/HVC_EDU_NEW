export interface RoomRentalOccurrenceInput {
  date: string;
  start_time: string;
  end_time: string;
  room: string;
}

export interface RoomRentalMonthSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

export interface RoomRentalOccurrence extends RoomRentalOccurrenceInput {
  starts_at: string;
  ends_at: string;
}

export type RoomRentalMonthRange = "FULL_MONTH" | "REMAINING_MONTH";

export type RoomRentalConflictType =
  | "REQUEST"
  | "RENTAL"
  | "SESSION"
  | "RECURRING_SCHEDULE"
  | "UNKNOWN";

export type RoomRentalConflictAction = "REPLACE_RENTAL" | "ALLOW_CLASS_OVERLAP" | null;

export interface RoomRentalConflict {
  key: string;
  type: RoomRentalConflictType;
  date: string;
  start_time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  room: string;
  reason: string;
  action: RoomRentalConflictAction;
  can_override: boolean;
  conflict_id?: string;
  conflict_starts_at?: string;
  conflict_ends_at?: string;
  conflict_room?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  teacher_names?: string[];
  renter_name?: string | null;
}

export interface RoomRentalInput {
  operation: "create_single" | "create_month" | "reschedule" | "cancel" | "delete";
  staff_id?: string;
  id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  month_start?: string;
  slots?: RoomRentalMonthSlot[];
  range?: RoomRentalMonthRange;
  confirmed_conflict_keys?: string[];
}

export interface RoomRentalResult {
  created_count?: number;
  overwritten_count?: number;
  rental_id?: string;
  status?: "BOOKED" | "CANCELLED" | "DELETED";
}

export interface RoomRentalCaller {
  user: { id: string };
  profile: { role: string; status?: string };
}
