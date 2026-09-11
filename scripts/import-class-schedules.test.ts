import { assertEquals } from "jsr:@std/assert@1";
import { assertScheduleData, scheduleRows } from "./import-class-schedules.ts";

Deno.test("contains the exact eight weekly schedules", () => {
  assertScheduleData();
  assertEquals(scheduleRows.length, 8);
  assertEquals(
    scheduleRows.filter((row) => row.classCode === "TOAN-6").length,
    2,
  );
  assertEquals(
    scheduleRows.filter((row) => row.classCode === "TOAN-7").length,
    2,
  );
  assertEquals(
    scheduleRows.filter((row) => row.classCode === "TOAN-8").length,
    2,
  );
  assertEquals(
    scheduleRows.filter((row) => row.classCode === "TOAN-9").length,
    2,
  );
});

Deno.test("maps Sunday morning classes to distinct rooms", () => {
  const sunday = scheduleRows.filter((row) => row.dayOfWeek === 7);
  assertEquals(sunday.map((row) => `${row.classCode}:${row.room}`).sort(), [
    "TOAN-7:HC01",
    "TOAN-8:HC02",
  ]);
});
