import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type AppClient = SupabaseClient<any, "public", any>;

interface FunctionError {
  code?: string;
  message?: string;
}

interface FunctionResponse<T> {
  success: boolean;
  data?: T;
  error?: FunctionError;
  trace_id?: string;
}

interface LoginResult {
  session:
    | { access_token: string; refresh_token: string; user: { id: string } }
    | null;
  profile: { role: string; status: string };
}

interface CreatedAccount {
  profile: {
    id: string;
    user_id: string;
    role: string;
    username: string;
    display_name: string;
  };
  temporary_password: string;
}

interface RosterStudent {
  studentCode: string;
  fullName: string;
  classCode: string;
}

interface AccountRecord extends RosterStudent {
  username: string;
  password: string;
}

interface ExistingStudent {
  id: string;
  user_id: string;
  student_code: string;
  full_name: string;
  status: string;
}

interface ExistingProfile {
  user_id: string;
  role: string;
  username: string | null;
  status: string;
}

interface ClassDefinition {
  code: string;
  name: string;
  gradeCode: string;
  sessionFee: number;
}

interface ExistingClass {
  id: string;
  code: string;
  name: string;
  subject_id: string;
  grade_id: string;
  default_session_fee: number;
  status: string;
}

export const classes: ClassDefinition[] = [
  { code: "TOAN-6", name: "Toán 6", gradeCode: "GRADE_6", sessionFee: 50_000 },
  { code: "TOAN-7", name: "Toán 7", gradeCode: "GRADE_7", sessionFee: 50_000 },
  { code: "TOAN-8", name: "Toán 8", gradeCode: "GRADE_8", sessionFee: 50_000 },
  { code: "TOAN-9", name: "Toán 9", gradeCode: "GRADE_9", sessionFee: 60_000 },
];

export const namesByGrade: Record<string, string[]> = {
  "6": [
    "Đào Thị Kim Ngân",
    "Đặng Phương Anh",
    "Nguyễn Gia Bảo",
    "Nguyễn Đặng Gia Bảo",
    "Tuệ Lâm",
    "Đặng Khánh Linh",
    "Nguyễn Ngọc Diệp",
    "Nguyễn Ngọc Cẩm Tú",
    "Đào Thế Hoàng",
    "Đào Nguyễn Bình An",
    "Nguyễn Trà My",
    "Bảo Dũng",
    "Đào Quang Minh",
    "Duy",
    "Phúc",
    "Linh",
    "Hân",
    "Kiều Anh",
    "Khang",
  ],
  "7": [
    "Lê Ngọc Ánh",
    "Nguyễn Thị Hồng Hạnh",
    "Nguyễn Văn Phúc",
    "Đào Thành Lê",
    "Bùi Bảo Minh Anh",
    "Cao Nhật Minh",
    "Phạm Mạnh Hùng",
    "Hiếu",
    "Cẩm Tiên",
    "Bảo An",
    "Đăng",
    "Lan",
  ],
  "8": [
    "Minh Thư",
    "Nguyễn Đình Phát",
    "Đỗ Thị Mai Ngọc",
    "Bùi Hiền Nhi",
    "Nguyễn Đặng Gia Hân",
    "Đào Ngọc Khánh",
    "Nhân",
  ],
  "9": [
    "Trường An",
    "Như Quỳnh",
    "Huy Đức",
    "Anh Trọng",
    "Nguyễn Gia Bảo",
    "Phạm Đức Hùng",
    "Quân",
    "Phương Nhi",
    "Lê Bảo Châm",
  ],
};

const outputPath = Deno.env.get("ACCOUNT_OUTPUT_PATH") ||
  "docs/accounts/student-accounts.md";
const checkpointPath = `${outputPath}.partial`;

function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Thiếu biến môi trường ${names.join(" hoặc ")}`);
}

function localDateInVietnam(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildRoster(): RosterStudent[] {
  const roster: RosterStudent[] = [];
  for (const grade of ["6", "7", "8", "9"]) {
    const names = namesByGrade[grade];
    if (!names) throw new Error(`Không có danh sách khối ${grade}`);
    names.forEach((fullName, index) => {
      roster.push({
        studentCode: `HS${grade.padStart(2, "0")}-${
          String(index + 1).padStart(3, "0")
        }`,
        fullName,
        classCode: `TOAN-${grade}`,
      });
    });
  }
  return roster;
}

export function assertRoster(roster: RosterStudent[]) {
  if (roster.length !== 47) {
    throw new Error(
      `Danh sách phải có 47 học sinh, nhận được ${roster.length}`,
    );
  }
  const codes = new Set(roster.map((student) => student.studentCode));
  if (codes.size !== roster.length) {
    throw new Error("Danh sách có student_code bị trùng");
  }
  for (const student of roster) {
    if (!/^HS(06|07|08|09)-\d{3}$/.test(student.studentCode)) {
      throw new Error(`student_code không hợp lệ: ${student.studentCode}`);
    }
  }
  for (const definition of classes) {
    const expected = Number(definition.code.slice(-1)) === 6
      ? 19
      : Number(definition.code.slice(-1)) === 7
      ? 12
      : Number(definition.code.slice(-1)) === 8
      ? 7
      : 9;
    const actual = roster.filter((student) =>
      student.classCode === definition.code
    ).length;
    if (actual !== expected) {
      throw new Error(
        `${definition.code} phải có ${expected} học sinh, nhận được ${actual}`,
      );
    }
  }
}

function cleanMarkdownCell(value: string): string {
  return value.trim().replace(/^`|`$/g, "");
}

async function readAccountDocument(
  path: string,
): Promise<Map<string, AccountRecord>> {
  try {
    const markdown = await Deno.readTextFile(path);
    const accounts = new Map<string, AccountRecord>();
    for (const line of markdown.split("\n")) {
      if (!line.trim().startsWith("|")) continue;
      const cells = line.split("|").slice(1, -1).map((cell) =>
        cleanMarkdownCell(cell)
      );
      if (cells.length < 6 || !/^HS(06|07|08|09)-\d{3}$/.test(cells[0])) {
        continue;
      }
      if (!cells[3] || !cells[4] || cells[4].startsWith("[")) continue;
      accounts.set(cells[0], {
        studentCode: cells[0],
        fullName: cells[1],
        classCode: cells[2],
        username: cells[3],
        password: cells[4],
      });
    }
    return accounts;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return new Map();
    throw error;
  }
}

async function readExistingCredentials(): Promise<Map<string, AccountRecord>> {
  const finalAccounts = await readAccountDocument(outputPath);
  const partialAccounts = await readAccountDocument(checkpointPath);
  for (const [code, account] of partialAccounts) {
    if (!finalAccounts.has(code)) finalAccounts.set(code, account);
  }
  return finalAccounts;
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|");
}

function renderAccountDocument(
  roster: RosterStudent[],
  accounts: Map<string, AccountRecord>,
  importedAt: string,
): string {
  const rows = roster
    .filter((student) => accounts.has(student.studentCode))
    .map((student) => {
      const account = accounts.get(student.studentCode)!;
      return `| \`${escapeMarkdown(account.studentCode)}\` | ${
        escapeMarkdown(account.fullName)
      } | ${escapeMarkdown(account.classCode)} | \`${
        escapeMarkdown(account.username)
      }\` | \`${
        escapeMarkdown(account.password)
      }\` | Dùng mã HS hoặc Username cùng mật khẩu |`;
    });
  return [
    "# HVC_EDU — Tài khoản học sinh",
    "",
    "> CONFIDENTIAL — Chứa mật khẩu plaintext để bàn giao tài khoản. Không chia sẻ công khai; nên xóa hoặc đổi mật khẩu sau khi bàn giao.",
    `> Ngày tạo/cập nhật: ${importedAt}`,
    "",
    "| Mã học sinh | Họ tên | Lớp | Username | Password | Cách đăng nhập |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

async function writeAccountDocument(
  path: string,
  roster: RosterStudent[],
  accounts: Map<string, AccountRecord>,
  importedAt: string,
) {
  const directory = path.slice(0, path.lastIndexOf("/"));
  if (directory) await Deno.mkdir(directory, { recursive: true });
  await Deno.writeTextFile(
    path,
    renderAccountDocument(roster, accounts, importedAt),
  );
}

async function invokeFunction<T>(
  client: AppClient,
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const result = await client.functions.invoke<FunctionResponse<T>>(name, {
    body,
  });
  if (result.error) {
    let context: FunctionResponse<T> | null = null;
    try {
      const response = (result.error as any).context;
      context = response?.json ? await response.json() : null;
    } catch {
      context = null;
    }
    throw new Error(context?.error?.message || result.error.message);
  }
  if (!result.data?.success) {
    throw new Error(result.data?.error?.message || `Function ${name} thất bại`);
  }
  return result.data.data as T;
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, received ${String(actual)}`,
    );
  }
}

async function loginRoot(
  url: string,
  publishableKey: string,
): Promise<AppClient> {
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await invokeFunction<LoginResult>(
    client,
    "login-by-identifier",
    {
      identifier: requiredEnv("ROOT_IDENTIFIER"),
      password: requiredEnv("ROOT_PASSWORD"),
    },
  );
  if (
    !login.session || login.profile.role !== "ROOT_ADMIN" ||
    login.profile.status !== "ACTIVE"
  ) {
    throw new Error("ROOT account không hợp lệ hoặc không ACTIVE");
  }
  const session = await client.auth.setSession({
    access_token: login.session.access_token,
    refresh_token: login.session.refresh_token,
  });
  if (session.error) throw session.error;
  return client;
}

async function runImport() {
  const url = requiredEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const publishableKey = requiredEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
  const importedAt = localDateInVietnam();
  const membershipStartDate = Deno.env.get("MEMBERSHIP_START_DATE")?.trim() ||
    importedAt;
  const roster = buildRoster();
  assertRoster(roster);

  const client = await loginRoot(url, publishableKey);
  const codes = roster.map((student) => student.studentCode);
  const classCodes = classes.map((definition) => definition.code);

  const [subjectResult, gradesResult, classResult, studentResult] =
    await Promise.all([
      client.from("subjects").select("id,code,name").eq("code", "MATH")
        .maybeSingle(),
      client.from("grades").select("id,code,name").in(
        "code",
        classes.map((definition) => definition.gradeCode),
      ),
      client.from("classes").select(
        "id,code,name,subject_id,grade_id,default_session_fee,status",
      ).in("code", classCodes),
      client.from("students").select("id,user_id,student_code,full_name,status")
        .in("student_code", codes),
    ]);
  if (subjectResult.error) throw subjectResult.error;
  if (gradesResult.error) throw gradesResult.error;
  if (classResult.error) throw classResult.error;
  if (studentResult.error) throw studentResult.error;
  if (!subjectResult.data) {
    throw new Error(
      "Không tìm thấy subject MATH; cần chạy migration/seed master trước",
    );
  }

  const gradeByCode = new Map(
    (gradesResult.data || []).map((grade: any) => [grade.code, grade]),
  );
  for (const definition of classes) {
    if (!gradeByCode.has(definition.gradeCode)) {
      throw new Error(`Không tìm thấy ${definition.gradeCode}`);
    }
  }

  const existingClasses = new Map<string, ExistingClass>(
    (classResult.data || []).map((row: any) => [row.code, row]),
  );
  for (const definition of classes) {
    const existing = existingClasses.get(definition.code);
    if (!existing) continue;
    const grade = gradeByCode.get(definition.gradeCode);
    if (existing.status !== "ACTIVE") {
      throw new Error(`Lớp ${definition.code} đã tồn tại nhưng không ACTIVE`);
    }
    if (
      existing.name !== definition.name ||
      existing.subject_id !== subjectResult.data.id ||
      existing.grade_id !== grade.id ||
      Number(existing.default_session_fee) !== definition.sessionFee
    ) {
      throw new Error(
        `Lớp ${definition.code} tồn tại nhưng thông tin không khớp; import dừng để tránh ghi đè`,
      );
    }
  }

  const existingStudents = new Map<string, ExistingStudent>(
    (studentResult.data || []).map((row: any) => [row.student_code, row]),
  );
  const existingUserIds = [...existingStudents.values()].map((student) =>
    student.user_id
  );
  const profilesResult = existingUserIds.length
    ? await client.from("profiles").select("user_id,role,username,status").in(
      "user_id",
      existingUserIds,
    )
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;
  const profilesByUserId = new Map<string, ExistingProfile>(
    (profilesResult.data || []).map((row: any) => [row.user_id, row]),
  );
  const priorCredentials = await readExistingCredentials();

  for (const student of roster) {
    const existing = existingStudents.get(student.studentCode);
    if (!existing) continue;
    const profile = profilesByUserId.get(existing.user_id);
    const prior = priorCredentials.get(student.studentCode);
    if (
      !profile || profile.role !== "STUDENT" || profile.status !== "ACTIVE" ||
      existing.status !== "ACTIVE" || existing.full_name !== student.fullName
    ) {
      throw new Error(
        `Học sinh ${student.studentCode} tồn tại nhưng thông tin không khớp/không ACTIVE; import dừng`,
      );
    }
    if (
      !prior || prior.username !== profile.username ||
      prior.fullName !== student.fullName ||
      prior.classCode !== student.classCode
    ) {
      throw new Error(
        `Không thể khôi phục password của tài khoản cũ ${student.studentCode}; giữ nguyên dữ liệu và bổ sung account markdown trước khi chạy lại`,
      );
    }
  }

  const classIds = new Map<string, string>();
  for (const definition of classes) {
    const existing = existingClasses.get(definition.code);
    if (existing) {
      classIds.set(definition.code, existing.id);
      continue;
    }
    const grade = gradeByCode.get(definition.gradeCode);
    const inserted = await client.from("classes").insert({
      code: definition.code,
      name: definition.name,
      subject_id: subjectResult.data.id,
      grade_id: grade.id,
      default_monthly_fee: 0,
      default_session_fee: definition.sessionFee,
      capacity_policy: "UNLIMITED",
      status: "ACTIVE",
    }).select("id").single();
    if (inserted.error || !inserted.data) {
      throw inserted.error || new Error(`Không thể tạo lớp ${definition.code}`);
    }
    classIds.set(definition.code, inserted.data.id);
  }

  const accounts = new Map<string, AccountRecord>(priorCredentials);
  const studentsByCode = new Map<string, ExistingStudent>(existingStudents);
  let createdCount = 0;
  for (const student of roster) {
    if (
      accounts.has(student.studentCode) &&
      studentsByCode.has(student.studentCode)
    ) continue;
    const created = await invokeFunction<CreatedAccount>(
      client,
      "admin-create-user",
      {
        role: "STUDENT",
        display_name: student.fullName,
        student: {
          student_code: student.studentCode,
          full_name: student.fullName,
        },
      },
    );
    if (!created.profile?.username || !created.temporary_password) {
      throw new Error(
        `Tài khoản ${student.studentCode} không trả về đủ thông tin`,
      );
    }
    const studentResultAfterCreate = await client.from("students").select(
      "id,user_id,student_code,full_name,status",
    ).eq("student_code", student.studentCode).single();
    if (studentResultAfterCreate.error || !studentResultAfterCreate.data) {
      throw studentResultAfterCreate.error ||
        new Error(
          `Không tìm thấy hồ sơ ${student.studentCode} sau khi tạo tài khoản`,
        );
    }
    studentsByCode.set(
      student.studentCode,
      studentResultAfterCreate.data as ExistingStudent,
    );
    accounts.set(student.studentCode, {
      ...student,
      username: created.profile.username,
      password: created.temporary_password,
    });
    createdCount += 1;
    await writeAccountDocument(checkpointPath, roster, accounts, importedAt);
  }

  assertEqual("Số tài khoản trong checkpoint", accounts.size, 47);
  await writeAccountDocument(checkpointPath, roster, accounts, importedAt);

  const membershipsResult = await client.from("class_memberships").select(
    "id,class_id,student_id,start_date,status",
  ).in("class_id", [...classIds.values()]).in(
    "student_id",
    [...studentsByCode.values()].map((student) => student.id),
  );
  if (membershipsResult.error) throw membershipsResult.error;
  const memberships = membershipsResult.data || [];
  const membershipCounts = new Map<string, number>();
  for (const membership of memberships as any[]) {
    const key = `${membership.class_id}:${membership.student_id}`;
    membershipCounts.set(key, (membershipCounts.get(key) || 0) + 1);
  }

  for (const student of roster) {
    const classId = classIds.get(student.classCode);
    const studentRow = studentsByCode.get(student.studentCode);
    if (!classId || !studentRow) {
      throw new Error(`Thiếu mapping cho ${student.studentCode}`);
    }
    const key = `${classId}:${studentRow.id}`;
    const count = membershipCounts.get(key) || 0;
    if (count > 1) {
      throw new Error(`Có nhiều membership trùng cho ${student.studentCode}`);
    }
    if (count === 1) continue;
    const inserted = await client.from("class_memberships").insert({
      class_id: classId,
      student_id: studentRow.id,
      start_date: membershipStartDate,
      status: "ACTIVE",
    }).select("id").single();
    if (inserted.error || !inserted.data) {
      throw inserted.error ||
        new Error(
          `Không thể gán ${student.studentCode} vào ${student.classCode}`,
        );
    }
    membershipCounts.set(key, 1);
  }

  await writeAccountDocument(outputPath, roster, accounts, importedAt);
  try {
    await Deno.remove(checkpointPath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  const finalStudents = await client.from("students").select(
    "id,user_id,student_code,full_name,status",
  ).in("student_code", codes);
  if (finalStudents.error) throw finalStudents.error;
  assertEqual("Số học sinh sau import", finalStudents.data?.length, 47);
  if (
    new Set(
      (finalStudents.data || []).map((student: any) => student.student_code),
    ).size !== 47
  ) throw new Error("student_code sau import không duy nhất");

  const finalMemberships = await client.from("class_memberships").select(
    "class_id,student_id,status",
  ).in("class_id", [...classIds.values()]).in(
    "student_id",
    (finalStudents.data || []).map((student: any) => student.id),
  );
  if (finalMemberships.error) throw finalMemberships.error;
  for (const student of roster) {
    const studentRow = (finalStudents.data || []).find((row: any) =>
      row.student_code === student.studentCode
    );
    const classId = classIds.get(student.classCode);
    if (!studentRow || !classId) {
      throw new Error(`Thiếu dữ liệu xác minh cho ${student.studentCode}`);
    }
    const count = (finalMemberships.data || []).filter((row: any) =>
      row.student_id === studentRow.id && row.class_id === classId &&
      row.status === "ACTIVE"
    ).length;
    assertEqual(`Membership ACTIVE của ${student.studentCode}`, count, 1);
  }

  const firstAccount = accounts.get(roster[0].studentCode);
  if (!firstAccount) throw new Error("Không có tài khoản smoke test");
  const loginByUsername = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await invokeFunction<LoginResult>(loginByUsername, "login-by-identifier", {
    identifier: firstAccount.username,
    password: firstAccount.password,
  });
  const loginByCode = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await invokeFunction<LoginResult>(loginByCode, "login-by-identifier", {
    identifier: firstAccount.studentCode,
    password: firstAccount.password,
  });

  console.log(JSON.stringify({
    success: true,
    classes: classes.length,
    students: roster.length,
    accounts_created: createdCount,
    memberships: roster.length,
    account_file: outputPath,
    membership_start_date: membershipStartDate,
  }));
}

if (import.meta.main) {
  try {
    await runImport();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Import thất bại");
    Deno.exitCode = 1;
  }
}
