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

export interface RoomRentalConflict {
  date: string;
  room: string;
  reason: string;
}

export interface RoomRentalInput {
  operation: "create_single" | "create_month" | "reschedule" | "cancel";
  staff_id?: string;
  id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  month_start?: string;
  slots?: RoomRentalMonthSlot[];
}

export interface RoomRentalResult {
  created_count?: number;
  rental_id?: string;
  status?: "BOOKED" | "CANCELLED";
}

export interface RoomRentalCaller {
  user: { id: string };
  profile: { role: string; status?: string };
}
