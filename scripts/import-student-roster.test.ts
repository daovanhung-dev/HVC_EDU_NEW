import { assertRoster, buildRoster } from "./import-student-roster.ts";

Deno.test("builds the exact 47-student roster with unique codes", () => {
  const roster = buildRoster();
  assertRoster(roster);

  if (roster.length !== 47) {
    throw new Error(`Expected 47 students, got ${roster.length}`);
  }
  if (new Set(roster.map((student) => student.studentCode)).size !== 47) {
    throw new Error("Roster student codes are not unique");
  }
});

Deno.test("keeps same-name students separate by student code and class", () => {
  const matches = buildRoster().filter((student) =>
    student.fullName === "Nguyễn Gia Bảo"
  );

  if (matches.length !== 2) {
    throw new Error(
      `Expected two Nguyễn Gia Bảo records, got ${matches.length}`,
    );
  }
  if (
    matches[0].studentCode === matches[1].studentCode ||
    matches[0].classCode === matches[1].classCode
  ) {
    throw new Error(
      "Same-name students must have separate code/class identities",
    );
  }
});
