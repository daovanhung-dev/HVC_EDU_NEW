import { createRoomRentalsHandler } from "./handler.ts";
import type { RoomRentalsDependencies, RoomRentalsStore } from "./handler.ts";

const QA_ADMIN = "f0640000-0000-0000-0000-000000000001";
const QA_TEACHER = "f0640000-0000-0000-0000-000000000101";
const QA_RENTAL = "f0640000-0000-0000-0000-000000000201";
const FIXED_NOW = new Date("2026-11-30T20:00:00+07:00");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(body: unknown, method = "POST") {
  return new Request("https://local.test/functions/v1/admin-room-rentals", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

function dependencies(options: {
  role?: string;
  status?: string;
  now?: Date;
  store?: Partial<RoomRentalsStore>;
} = {}) {
  const calls: {
    auth: number;
    stores: number;
    create: number;
    createMonth: number;
    createMonthRange: string | null;
    confirmedConflictKeys: string[] | undefined;
    reschedule: number;
    cancel: number;
    delete: number;
  } = {
    auth: 0,
    stores: 0,
    create: 0,
    createMonth: 0,
    createMonthRange: null,
    confirmedConflictKeys: undefined,
    reschedule: 0,
    cancel: 0,
    delete: 0,
  };
  const store: RoomRentalsStore = {
    create: async () => { calls.create += 1; return { rental_id: QA_RENTAL, status: "BOOKED" }; },
    createMonth: async (occurrences, _staffId, _actorUserId, range, confirmedConflictKeys) => {
      calls.createMonth += 1;
      calls.createMonthRange = range;
      calls.confirmedConflictKeys = confirmedConflictKeys;
      return { created_count: occurrences.length, status: "BOOKED" };
    },
    reschedule: async () => { calls.reschedule += 1; return { rental_id: QA_RENTAL, status: "BOOKED" }; },
    cancel: async () => { calls.cancel += 1; return { rental_id: QA_RENTAL, status: "CANCELLED" }; },
    delete: async () => { calls.delete += 1; return { rental_id: QA_RENTAL, status: "DELETED" }; },
    ...options.store,
  };
  const deps: RoomRentalsDependencies = {
    getCaller: async () => {
      calls.auth += 1;
      return {
        user: { id: QA_ADMIN },
        profile: { role: options.role ?? "ADMIN", status: options.status ?? "ACTIVE" },
      };
    },
    getStore: () => { calls.stores += 1; return store; },
    now: () => new Date(options.now ?? FIXED_NOW),
  };
  return { calls, handler: createRoomRentalsHandler(deps) };
}

Deno.test("Admin can create a one-off booking after server-side validation", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request({
    operation: "create_single",
    staff_id: QA_TEACHER,
    date: "2026-12-01",
    start_time: "09:00",
    end_time: "10:00",
    room: " QA-A1 ",
  }));
  const body = await response.json();
  assert(response.status === 200 && body.data.rental_id === QA_RENTAL, "booking should succeed");
  assert(calls.create === 1 && calls.createMonth === 0, "single booking should use create operation");
});

Deno.test("monthly template expands future weekdays and saves as one batch", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request({
    operation: "create_month",
    staff_id: QA_TEACHER,
    month_start: "2026-12-01",
    slots: [{ day_of_week: 1, start_time: "09:00", end_time: "10:00", room: "QA-A1" }],
  }));
  const body = await response.json();
  assert(response.status === 200 && body.data.created_count === 4, "December Mondays should expand to four future bookings");
  assert(calls.createMonth === 1 && calls.create === 0, "monthly request should use the batch operation");
});

Deno.test("full-month range includes elapsed occurrences in the selected month", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request({
    operation: "create_month",
    staff_id: QA_TEACHER,
    month_start: "2026-11-01",
    range: "FULL_MONTH",
    slots: [{ day_of_week: 1, start_time: "09:00", end_time: "10:00", room: "QA-A1" }],
  }));
  const body = await response.json();
  assert(response.status === 200 && body.data.created_count === 5, "all five November Mondays should be included");
  assert(calls.createMonthRange === "FULL_MONTH", "the full-month range should reach the store");
});

Deno.test("remaining-month skips a started slot today but keeps a later slot today", async () => {
  const now = new Date("2026-11-12T12:30:00+07:00");
  const slots = [
    { day_of_week: 4, start_time: "11:00", end_time: "12:00", room: "QA-A1" },
    { day_of_week: 4, start_time: "13:00", end_time: "14:00", room: "QA-A2" },
  ];
  const remaining = dependencies({ now });
  const remainingResponse = await remaining.handler(request({
    operation: "create_month",
    staff_id: QA_TEACHER,
    month_start: "2026-11-01",
    range: "REMAINING_MONTH",
    slots,
  }));
  const remainingBody = await remainingResponse.json();
  assert(remainingBody.data.created_count === 5, "only later starts today and the remaining Thursday slots should be included");

  const full = dependencies({ now });
  const fullResponse = await full.handler(request({
    operation: "create_month",
    staff_id: QA_TEACHER,
    month_start: "2026-11-01",
    range: "FULL_MONTH",
    slots,
  }));
  const fullBody = await fullResponse.json();
  assert(fullBody.data.created_count === 8, "full month should also include the already-started slot today and earlier Thursdays");
});

Deno.test("the confirmed conflict keys are forwarded for transaction revalidation", async () => {
  const confirmed = ["RENTAL:qa-rental-id:occurrence"];
  const { calls, handler } = dependencies();
  const response = await handler(request({
    operation: "create_month",
    staff_id: QA_TEACHER,
    month_start: "2026-12-01",
    range: "REMAINING_MONTH",
    confirmed_conflict_keys: confirmed,
    slots: [{ day_of_week: 1, start_time: "09:00", end_time: "10:00", room: "QA-A1" }],
  }));
  assert(response.status === 200, "valid confirmation payload should dispatch");
  assert(calls.confirmedConflictKeys?.[0] === confirmed[0], "confirmation keys should be forwarded unchanged");
});

Deno.test("monthly internal room overlap rejects the whole request and returns dates", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request({
    operation: "create_month",
    staff_id: QA_TEACHER,
    month_start: "2026-12-01",
    slots: [
      { day_of_week: 1, start_time: "09:00", end_time: "10:30", room: "QA-A1" },
      { day_of_week: 1, start_time: "10:00", end_time: "11:00", room: " qa-a1 " },
    ],
  }));
  const body = await response.json();
  assert(response.status === 409 && body.error.code === "ROOM_RENTAL_CONFLICT", "overlap should be rejected");
  assert(body.error.details?.length === 4, "each conflicting date should be returned");
  assert(calls.createMonth === 0, "no batch write should start after an internal conflict");
});

Deno.test("non-admin callers and inactive admins are rejected before store access", async () => {
  for (const options of [{ role: "TEACHER" }, { role: "ADMIN", status: "INACTIVE" }]) {
    for (const operation of ["cancel", "delete"]) {
      const { calls, handler } = dependencies(options);
      const response = await handler(request({ operation, id: QA_RENTAL }));
      const body = await response.json();
      assert(response.status === 403 && body.error.code === "FORBIDDEN", "caller should be denied");
      assert(calls.stores === 0, "unauthorized call must not access store");
    }
  }
});

Deno.test("invalid dates, non-future times, and empty months do not write", async () => {
  const { calls, handler } = dependencies();
  const invalidSingle = await handler(request({
    operation: "create_single", staff_id: QA_TEACHER, date: "2026-11-29",
    start_time: "09:00", end_time: "10:00", room: "QA-A1",
  }));
  assert(invalidSingle.status === 400, "past single booking should be rejected");

  const emptyMonth = await handler(request({
    operation: "create_month", staff_id: QA_TEACHER, month_start: "2026-11-01",
    slots: [{ day_of_week: 1, start_time: "09:00", end_time: "10:00", room: "QA-A1" }],
  }));
  const body = await emptyMonth.json();
  assert(emptyMonth.status === 400 && body.error.code === "NO_REMAINING_OCCURRENCES", "remaining-month request without future dates should be rejected");
  assert(calls.create === 0 && calls.createMonth === 0, "invalid requests should not write");
});

Deno.test("reschedule, cancel, and permanent deletion dispatch only their requested booking", async () => {
  const { calls, handler } = dependencies();
  const changed = await handler(request({
    operation: "reschedule", id: QA_RENTAL, date: "2026-12-02",
    start_time: "13:00", end_time: "14:00", room: "QA-B1",
  }));
  const cancelled = await handler(request({ operation: "cancel", id: QA_RENTAL }));
  const deleted = await handler(request({ operation: "delete", id: QA_RENTAL }));
  const deletedBody = await deleted.json();
  assert(changed.status === 200 && cancelled.status === 200 && deleted.status === 200, "admin actions should succeed");
  assert(deletedBody.data.status === "DELETED", "delete should report its terminal result");
  assert(calls.reschedule === 1 && calls.cancel === 1 && calls.delete === 1, "operations should route separately");
});

Deno.test("invalid delete ids do not dispatch to the store", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request({ operation: "delete", id: "not-a-uuid" }));
  assert(response.status === 400, "an invalid id should be rejected");
  assert(calls.delete === 0, "invalid input must not delete a rental");
});

Deno.test("non-POST methods are rejected before authentication", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request(null, "GET"));
  assert(response.status === 405, "GET should be rejected");
  assert(calls.auth === 0 && calls.stores === 0, "unsupported method must not access services");
});
