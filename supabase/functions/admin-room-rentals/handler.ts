import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";
import { buildMonthRoomRentals, buildSingleRoomRental, findInternalRoomRentalConflicts } from "./planner.ts";
import type {
  RoomRentalCaller,
  RoomRentalConflict,
  RoomRentalInput,
  RoomRentalMonthRange,
  RoomRentalOccurrence,
  RoomRentalResult,
} from "./types.ts";

export interface RoomRentalsStore {
  create(input: RoomRentalOccurrence, staffId: string, actorUserId: string): Promise<RoomRentalResult>;
  createMonth(
    occurrences: RoomRentalOccurrence[],
    staffId: string,
    actorUserId: string,
    range: RoomRentalMonthRange,
    confirmedConflictKeys?: string[],
  ): Promise<RoomRentalResult>;
  reschedule(input: RoomRentalOccurrence, rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
  cancel(rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
  delete(rentalId: string, actorUserId: string): Promise<RoomRentalResult>;
}

export interface RoomRentalsDependencies {
  getCaller(req: Request): Promise<RoomRentalCaller>;
  getStore(): RoomRentalsStore;
  now?: () => Date;
}

interface CodedError extends Error {
  code?: string;
  details?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function codedError(code: string, details?: unknown): CodedError {
  return Object.assign(new Error(code), { code, details });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRoomRentalInput(value: unknown): RoomRentalInput | null {
  if (!isObject(value) || typeof value.operation !== "string") return null;
  return value as unknown as RoomRentalInput;
}

function singleInput(value: RoomRentalInput, now: Date): RoomRentalOccurrence {
  if (typeof value.date !== "string" || typeof value.start_time !== "string"
    || typeof value.end_time !== "string" || typeof value.room !== "string") {
    throw codedError("INVALID_INPUT");
  }
  return buildSingleRoomRental({
    date: value.date,
    start_time: value.start_time,
    end_time: value.end_time,
    room: value.room,
  }, now);
}

function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw codedError("INVALID_INPUT");
  return value;
}

function conflictResponse(details: RoomRentalConflict[]): Response {
  const dateSummary = details.map((item) => `${item.date} · ${item.room}`).join(", ");
  return fail(
    "ROOM_RENTAL_CONFLICT",
    dateSummary ? `Khung giờ/phòng bị trùng: ${dateSummary}` : "Khung giờ/phòng bị trùng với lịch hiện có.",
    409,
    undefined,
    details,
  );
}

export function createRoomRentalsHandler(dependencies: RoomRentalsDependencies) {
  return async (req: Request): Promise<Response> => {
    const options = handleOptions(req);
    if (options) return options;
    if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ POST.", 405);

    let caller: RoomRentalCaller;
    try {
      caller = await dependencies.getCaller(req);
    } catch (error) {
      return fromError(error, undefined, { stage: "auth" });
    }
    if (caller.profile.status !== "ACTIVE" || !["ADMIN", "ROOT_ADMIN"].includes(caller.profile.role)) {
      return fail("FORBIDDEN", "Chỉ Admin mới được quản lý lịch thuê phòng.", 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("INVALID_INPUT", "Dữ liệu yêu cầu không hợp lệ.", 400);
    }
    const input = parseRoomRentalInput(body);
    if (!input) return fail("INVALID_INPUT", "Dữ liệu yêu cầu không hợp lệ.", 400);

    try {
      const now = dependencies.now?.() ?? new Date();
      const store = dependencies.getStore();
      let result: RoomRentalResult;
      switch (input.operation) {
        case "create_single": {
          const staffId = requireUuid(input.staff_id);
          result = await store.create(singleInput(input, now), staffId, caller.user.id);
          break;
        }
        case "create_month": {
          const staffId = requireUuid(input.staff_id);
          if (typeof input.month_start !== "string" || !Array.isArray(input.slots)
            || (input.range !== undefined && !["FULL_MONTH", "REMAINING_MONTH"].includes(input.range))) {
            throw codedError("INVALID_INPUT");
          }
          if (input.confirmed_conflict_keys !== undefined
            && (!Array.isArray(input.confirmed_conflict_keys)
              || input.confirmed_conflict_keys.length > 2000
              || input.confirmed_conflict_keys.some((key) => typeof key !== "string" || key.length > 160))) {
            throw codedError("INVALID_INPUT");
          }
          const range: RoomRentalMonthRange = input.range ?? "REMAINING_MONTH";
          const occurrences = buildMonthRoomRentals(input.month_start, input.slots, now, range);
          const internalConflicts = findInternalRoomRentalConflicts(occurrences);
          if (internalConflicts.length) return conflictResponse(internalConflicts);
          result = await store.createMonth(
            occurrences,
            staffId,
            caller.user.id,
            range,
            input.confirmed_conflict_keys,
          );
          break;
        }
        case "reschedule": {
          const rentalId = requireUuid(input.id);
          result = await store.reschedule(singleInput(input, now), rentalId, caller.user.id);
          break;
        }
        case "cancel": {
          result = await store.cancel(requireUuid(input.id), caller.user.id);
          break;
        }
        case "delete": {
          result = await store.delete(requireUuid(input.id), caller.user.id);
          break;
        }
        default:
          throw codedError("INVALID_INPUT");
      }
      return ok(result);
    } catch (error) {
      const value: CodedError = error && typeof error === "object" ? error as CodedError : {} as CodedError;
      if (value.code === "ROOM_RENTAL_CONFLICT") {
        const details = Array.isArray(value.details) ? value.details as RoomRentalConflict[] : [];
        return conflictResponse(details);
      }
      return fromError(error, undefined, { stage: "room_rental", role: caller.profile.role });
    }
  };
}
