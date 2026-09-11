import { assertEquals } from "jsr:@std/assert@1";
import {
  assertStaffScheduleData,
  classMonthStaff,
  scheduleDefinitions,
  staffDefinitions,
} from "./import-staff-schedule.ts";

Deno.test("contains six staff, nine class assignments and eight schedules", () => {
  assertStaffScheduleData();
  assertEquals(staffDefinitions.length, 6);
  assertEquals(classMonthStaff.length, 9);
  assertEquals(scheduleDefinitions.length, 8);
});

Deno.test("keeps Toán 8 teachers distinct by weekly slot", () => {
  const toan8 = scheduleDefinitions.filter((row) => row.classCode === "TOAN-8");
  assertEquals(toan8.map((row) => `${row.dayOfWeek}:${row.staff.join(",")}`), [
    "2:Nguyễn Mạnh Cường",
    "7:Đào Phương Anh",
  ]);
});

Deno.test("models the moved Toán 6 Sunday slot without guessing a room", () => {
  const moved = scheduleDefinitions.find((row) =>
    row.classCode === "TOAN-6" && row.dayOfWeek === 7 &&
    row.startTime === "17:30"
  );
  assertEquals(moved?.room, null);
  assertEquals(moved?.endTime, "19:30");
});

Deno.test("has unique schedule slots and usernames", () => {
  assertEquals(
    new Set(
      scheduleDefinitions.map((row) =>
        `${row.classCode}:${row.dayOfWeek}:${row.startTime}`
      ),
    ).size,
    8,
  );
  assertEquals(new Set(staffDefinitions.map((row) => row.username)).size, 6);
});
