import type {
  RoomRentalConflict,
  RoomRentalMonthSlot,
  RoomRentalOccurrence,
  RoomRentalOccurrenceInput,
} from "./types.ts";

export const MAX_ROOM_RENTAL_MONTH_OCCURRENCES = 100;

interface CodedError extends Error {
  code?: string;
}

function codedError(code: string): CodedError {
  return Object.assign(new Error(code), { code });
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function timeMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function cleanRoom(value: string): string {
  if (typeof value !== "string") throw codedError("INVALID_INPUT");
  const room = value.trim();
  if (!room || room.length > 100) throw codedError("INVALID_INPUT");
  return room;
}

function occurrence(
  input: RoomRentalOccurrenceInput,
  now: Date,
): RoomRentalOccurrence {
  if (!input || typeof input !== "object"
    || !validDate(input.date) || !validTime(input.start_time) || !validTime(input.end_time)
    || timeMinutes(input.end_time) <= timeMinutes(input.start_time)) {
    throw codedError("INVALID_INPUT");
  }
  const room = cleanRoom(input.room);
  const startsAt = new Date(`${input.date}T${input.start_time}:00+07:00`);
  const endsAt = new Date(`${input.date}T${input.end_time}:00+07:00`);
  if (startsAt <= now || endsAt <= startsAt) throw codedError("INVALID_INPUT");
  return {
    ...input,
    room,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  };
}

export function buildSingleRoomRental(
  input: RoomRentalOccurrenceInput,
  now = new Date(),
): RoomRentalOccurrence {
  return occurrence(input, now);
}

export function buildMonthRoomRentals(
  monthStart: string,
  slots: RoomRentalMonthSlot[],
  now = new Date(),
): RoomRentalOccurrence[] {
  if (!validDate(monthStart) || !monthStart.endsWith("-01")
    || !Array.isArray(slots) || slots.length === 0 || slots.length > 100) {
    throw codedError("INVALID_INPUT");
  }

  const [year, month] = monthStart.split("-").map(Number);
  const monthLength = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const occurrences: RoomRentalOccurrence[] = [];
  for (const slot of slots) {
    if (!slot || typeof slot !== "object"
      || typeof slot.start_time !== "string"
      || typeof slot.end_time !== "string"
      || typeof slot.room !== "string") throw codedError("INVALID_INPUT");
    if (!Number.isInteger(slot.day_of_week) || slot.day_of_week < 1 || slot.day_of_week > 7) {
      throw codedError("INVALID_INPUT");
    }
    if (!validTime(slot.start_time) || !validTime(slot.end_time)
      || timeMinutes(slot.end_time) <= timeMinutes(slot.start_time)) {
      throw codedError("INVALID_INPUT");
    }
    const room = cleanRoom(slot.room);
    for (let day = 1; day <= monthLength; day += 1) {
      const date = `${monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`;
      const jsDay = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;
      if (isoDay !== slot.day_of_week) continue;
      const start = new Date(`${date}T${slot.start_time}:00+07:00`);
      const end = new Date(`${date}T${slot.end_time}:00+07:00`);
      if (start <= now) continue;
      occurrences.push({
        date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        room,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      });
      if (occurrences.length > MAX_ROOM_RENTAL_MONTH_OCCURRENCES) {
        throw codedError("ROOM_RENTAL_MONTH_TOO_LARGE");
      }
    }
  }
  if (!occurrences.length) throw codedError("NO_FUTURE_OCCURRENCES");
  return occurrences.sort((left, right) => left.starts_at.localeCompare(right.starts_at));
}

export function findInternalRoomRentalConflicts(
  occurrences: RoomRentalOccurrence[],
): RoomRentalConflict[] {
  const conflicts: RoomRentalConflict[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < occurrences.length; index += 1) {
    const current = occurrences[index];
    for (let otherIndex = index + 1; otherIndex < occurrences.length; otherIndex += 1) {
      const other = occurrences[otherIndex];
      if (other.starts_at >= current.ends_at) break;
      if (current.date !== other.date
        || current.room.trim().toLocaleLowerCase() !== other.room.trim().toLocaleLowerCase()
        || current.starts_at >= other.ends_at || current.ends_at <= other.starts_at) continue;
      const key = `${current.date}:${current.room.trim().toLocaleLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({ date: current.date, room: current.room, reason: "DUPLICATE_REQUEST" });
    }
  }
  return conflicts;
}
