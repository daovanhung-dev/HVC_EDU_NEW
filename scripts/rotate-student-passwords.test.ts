import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  assertRotationDataset,
  isStudentPassword,
  normalizeStudentName,
  parseStudentAccounts,
} from "./rotate-student-passwords.ts";
import { buildRoster } from "./import-student-roster.ts";

Deno.test("normalizes Vietnamese names without accents", () => {
  assertEquals(normalizeStudentName("Đào Thị Kim Ngân"), "daothikimngan");
  assertEquals(normalizeStudentName("Đỗ Thị Mai Ngọc"), "dothimaingoc");
  assertEquals(normalizeStudentName("Hân"), "han");
  assertEquals(normalizeStudentName("Duy"), "duy");
});

Deno.test("accepts exactly a three-digit suffix", () => {
  assert(isStudentPassword("Nguyễn Gia Bảo", "nguyengiabao123"));
  assert(!isStudentPassword("Nguyễn Gia Bảo", "nguyengiabao12"));
  assert(!isStudentPassword("Nguyễn Gia Bảo", "nguyengiabao1234"));
  assert(!isStudentPassword("Nguyễn Gia Bảo", "nguyengiabaoabc"));
});

Deno.test("validates the 47-account dataset and keeps duplicate names independent", () => {
  const accounts = new Map(
    buildRoster().map((student) => [student.studentCode, {
      ...student,
      username: student.studentCode.toLowerCase(),
      password: "old-password",
    }]),
  );
  assertRotationDataset(accounts);
  const duplicateNames = [...accounts.values()].filter((row) =>
    row.fullName === "Nguyễn Gia Bảo"
  );
  assertEquals(duplicateNames.length, 2);
  assertEquals(new Set(duplicateNames.map((row) => row.studentCode)).size, 2);
});

Deno.test("parses markdown account rows without exposing password values", () => {
  const markdown = [
    "| Mã học sinh | Họ tên | Lớp | Username | Password | Cách đăng nhập |",
    "|---|---|---|---|---|---|",
    "| `HS06-001` | Đào Thị Kim Ngân | TOAN-6 | `kimngan` | `old` | Dùng mã HS |",
  ].join("\n");
  const parsed = parseStudentAccounts(markdown);
  assertEquals(parsed.get("HS06-001")?.username, "kimngan");
  assertEquals(parsed.get("HS06-001")?.fullName, "Đào Thị Kim Ngân");
});
