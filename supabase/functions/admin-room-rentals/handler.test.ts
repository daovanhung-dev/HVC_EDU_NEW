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
  store?: Partial<RoomRentalsStore>;
} = {}) {
  const calls = { auth: 0, stores: 0, create: 0, createMonth: 0, reschedule: 0, cancel: 0 };
  const store: RoomRentalsStore = {
    create: async () => { calls.create += 1; return { rental_id: QA_RENTAL, status: "BOOKED" }; },
    createMonth: async (occurrences) => {
      calls.createMonth += 1;
      return { created_count: occurrences.length, status: "BOOKED" };
    },
    reschedule: async () => { calls.reschedule += 1; return { rental_id: QA_RENTAL, status: "BOOKED" }; },
    cancel: async () => { calls.cancel += 1; return { rental_id: QA_RENTAL, status: "CANCELLED" }; },
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
    now: () => new Date(FIXED_NOW),
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
    const { calls, handler } = dependencies(options);
    const response = await handler(request({ operation: "cancel", id: QA_RENTAL }));
    const body = await response.json();
    assert(response.status === 403 && body.error.code === "FORBIDDEN", "caller should be denied");
    assert(calls.stores === 0, "unauthorized call must not access store");
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
  assert(emptyMonth.status === 400 && body.error.code === "NO_FUTURE_OCCURRENCES", "month without future dates should be rejected");
  assert(calls.create === 0 && calls.createMonth === 0, "invalid requests should not write");
});

Deno.test("reschedule and cancel dispatch only their requested booking", async () => {
  const { calls, handler } = dependencies();
  const changed = await handler(request({
    operation: "reschedule", id: QA_RENTAL, date: "2026-12-02",
    start_time: "13:00", end_time: "14:00", room: "QA-B1",
  }));
  const cancelled = await handler(request({ operation: "cancel", id: QA_RENTAL }));
  assert(changed.status === 200 && cancelled.status === 200, "both admin actions should succeed");
  assert(calls.reschedule === 1 && calls.cancel === 1, "operations should route separately");
});

Deno.test("non-POST methods are rejected before authentication", async () => {
  const { calls, handler } = dependencies();
  const response = await handler(request(null, "GET"));
  assert(response.status === 405, "GET should be rejected");
  assert(calls.auth === 0 && calls.stores === 0, "unsupported method must not access services");
});
