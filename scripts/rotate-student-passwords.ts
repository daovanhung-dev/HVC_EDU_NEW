import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertRoster, buildRoster } from "./import-student-roster.ts";

type AppClient = SupabaseClient<any, "public", any>;

interface FunctionResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface LoginResult {
  session: { access_token: string; refresh_token: string } | null;
  profile: { role: string; status: string; force_password_change?: boolean };
}

interface StudentAccount {
  studentCode: string;
  fullName: string;
  classCode: string;
  username: string;
  password: string;
}

interface Checkpoint {
  version: 1;
  target: "student-password-rotation-2026-09";
  passwords: Record<string, string>;
}

interface Invariants {
  students: number | null;
  memberships: number | null;
  sessions: number | null;
  tuition: number | null;
  attendances: number | null;
}

const OUTPUT_PATH = "docs/accounts/student-accounts.md";
const CHECKPOINT_PATH = `${OUTPUT_PATH}.partial`;
export const ROTATION_MARKER =
  "Password format: không dấu + 3 chữ số ngẫu nhiên";

function fail(message: string): never {
  throw new Error(message);
}

export function normalizeStudentName(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replace(/[^a-z0-9]/g, "");
}

export function isStudentPassword(fullName: string, password: string): boolean {
  const prefix = normalizeStudentName(fullName);
  return password.length === prefix.length + 3 &&
    password.startsWith(prefix) &&
    /^\d{3}$/.test(password.slice(prefix.length));
}

function cleanMarkdownCell(value: string): string {
  return value.trim().replace(/^`|`$/g, "").replaceAll("\\|", "|");
}

export function parseStudentAccounts(
  markdown: string,
): Map<string, StudentAccount> {
  const accounts = new Map<string, StudentAccount>();
  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map(cleanMarkdownCell);
    if (!/^HS(06|07|08|09)-\d{3}$/.test(cells[0] || "")) continue;
    if (cells.length < 6 || !cells[1] || !cells[2] || !cells[3] || !cells[4]) {
      fail(`Dòng tài khoản ${cells[0]} thiếu dữ liệu bắt buộc`);
    }
    if (accounts.has(cells[0])) {
      fail(`Trùng student_code trong file: ${cells[0]}`);
    }
    accounts.set(cells[0], {
      studentCode: cells[0],
      fullName: cells[1],
      classCode: cells[2],
      username: cells[3],
      password: cells[4],
    });
  }
  return accounts;
}

export function assertRotationDataset(accounts: Map<string, StudentAccount>) {
  const roster = buildRoster();
  assertRoster(roster);
  if (accounts.size !== roster.length) {
    fail(`File tài khoản phải có 47 dòng, nhận ${accounts.size}`);
  }
  const usernames = new Set<string>();
  const expected = new Map(
    roster.map((student) => [student.studentCode, student]),
  );
  for (const student of roster) {
    const account = accounts.get(student.studentCode);
    if (
      !account || account.fullName !== student.fullName ||
      account.classCode !== student.classCode
    ) {
      fail(`Thông tin file lệch tại ${student.studentCode}`);
    }
    if (usernames.has(account.username)) {
      fail(`Username bị trùng tại ${student.studentCode}`);
    }
    usernames.add(account.username);
  }
  for (const code of accounts.keys()) {
    if (!expected.has(code)) fail(`student_code ngoài dataset: ${code}`);
  }
}

function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Thiếu biến môi trường ${names.join(" hoặc ")}`);
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
    throw new Error(result.error.message || `Function ${name} thất bại`);
  }
  if (!result.data?.success) {
    throw new Error(result.data?.error?.message || `Function ${name} thất bại`);
  }
  return result.data.data as T;
}

async function loginRoot(url: string, key: string): Promise<AppClient> {
  const client = createClient(url, key, {
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
  const session = await client.auth.setSession(login.session);
  if (session.error) throw session.error;
  return client;
}

async function loginStudent(
  url: string,
  key: string,
  identifier: string,
  password: string,
): Promise<LoginResult> {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return await invokeFunction<LoginResult>(client, "login-by-identifier", {
    identifier,
    password,
  });
}

async function verifyAccount(
  url: string,
  key: string,
  account: StudentAccount,
) {
  const byUsername = await loginStudent(
    url,
    key,
    account.username,
    account.password,
  );
  if (
    !byUsername.session || byUsername.profile.role !== "STUDENT" ||
    byUsername.profile.status !== "ACTIVE"
  ) {
    fail(`Đăng nhập username thất bại: ${account.studentCode}`);
  }
  const byCode = await loginStudent(
    url,
    key,
    account.studentCode,
    account.password,
  );
  if (
    !byCode.session || byCode.profile.role !== "STUDENT" ||
    byCode.profile.status !== "ACTIVE"
  ) {
    fail(`Đăng nhập mã học sinh thất bại: ${account.studentCode}`);
  }
}

function randomThreeDigits(used: Set<string>): string {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    const suffix = String(100 + (buffer[0] % 900));
    if (!used.has(suffix)) return suffix;
  }
  fail("Không thể sinh hậu tố password duy nhất");
}

function makePassword(
  account: StudentAccount,
  usedPasswords: Set<string>,
  usedSuffixes: Set<string>,
): string {
  const prefix = normalizeStudentName(account.fullName);
  if (!prefix) fail(`Không thể chuẩn hóa họ tên: ${account.studentCode}`);
  let suffix = randomThreeDigits(usedSuffixes);
  let password = `${prefix}${suffix}`;
  while (usedPasswords.has(password)) {
    usedSuffixes.add(suffix);
    suffix = randomThreeDigits(usedSuffixes);
    password = `${prefix}${suffix}`;
  }
  usedSuffixes.add(suffix);
  usedPasswords.add(password);
  return password;
}

async function readCheckpoint(): Promise<Map<string, string>> {
  try {
    const raw = await Deno.readTextFile(CHECKPOINT_PATH);
    const checkpoint = JSON.parse(raw) as Checkpoint;
    if (
      checkpoint.version !== 1 ||
      checkpoint.target !== "student-password-rotation-2026-09" ||
      !checkpoint.passwords
    ) {
      fail("Checkpoint password không hợp lệ");
    }
    return new Map(Object.entries(checkpoint.passwords));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return new Map();
    throw error;
  }
}

async function writeCheckpoint(passwords: Map<string, string>) {
  await Deno.mkdir("docs/accounts", { recursive: true });
  const checkpoint: Checkpoint = {
    version: 1,
    target: "student-password-rotation-2026-09",
    passwords: Object.fromEntries(passwords),
  };
  await Deno.writeTextFile(
    CHECKPOINT_PATH,
    `${JSON.stringify(checkpoint, null, 2)}\n`,
  );
  await Deno.chmod(CHECKPOINT_PATH, 0o600);
}

function renderStudentAccounts(
  accounts: StudentAccount[],
  rotatedAt: string,
): string {
  return [
    "# HVC_EDU — Tài khoản học sinh",
    "",
    "> CONFIDENTIAL — Chứa mật khẩu plaintext để bàn giao tài khoản. Không chia sẻ công khai; nên xóa hoặc đổi mật khẩu sau khi bàn giao.",
    `> Ngày tạo/cập nhật: ${rotatedAt}`,
    `> ${ROTATION_MARKER}. Không bắt buộc đổi mật khẩu sau khi đăng nhập.`,
    "",
    "| Mã học sinh | Họ tên | Lớp | Username | Password | Cách đăng nhập |",
    "|---|---|---|---|---|---|",
    ...accounts.map((account) =>
      `| \`${account.studentCode}\` | ${account.fullName} | ${account.classCode} | \`${account.username}\` | \`${account.password}\` | Dùng mã HS hoặc Username cùng mật khẩu |`
    ),
    "",
  ].join("\n");
}

function vietnamDateTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

async function readInvariants(
  client: AppClient,
  studentIds: string[],
): Promise<Invariants> {
  const [students, memberships, sessions, tuition, attendances] = await Promise
    .all([
      client.from("students").select("id", { count: "exact", head: true }).in(
        "id",
        studentIds,
      ),
      client.from("class_memberships").select("id", {
        count: "exact",
        head: true,
      }).in("student_id", studentIds),
      client.from("sessions").select("id", { count: "exact", head: true }),
      client.from("tuition_records").select("id", {
        count: "exact",
        head: true,
      }),
      client.from("student_attendances").select("id", {
        count: "exact",
        head: true,
      }).in("student_id", studentIds),
    ]);
  for (
    const result of [students, memberships, sessions, tuition, attendances]
  ) if (result.error) throw result.error;
  return {
    students: students.count,
    memberships: memberships.count,
    sessions: sessions.count,
    tuition: tuition.count,
    attendances: attendances.count,
  };
}

function assertInvariants(before: Invariants, after: Invariants) {
  for (const key of Object.keys(before) as (keyof Invariants)[]) {
    if (before[key] !== after[key]) {
      fail(`Dữ liệu ${key} thay đổi ngoài phạm vi rotation`);
    }
  }
}

async function runRotation() {
  const markdown = await Deno.readTextFile(OUTPUT_PATH);
  await Deno.chmod(OUTPUT_PATH, 0o600);
  const accountsByCode = parseStudentAccounts(markdown);
  assertRotationDataset(accountsByCode);
  const roster = buildRoster();
  const finalHasMarker = markdown.includes(ROTATION_MARKER) &&
    [...accountsByCode.values()].every((account) =>
      isStudentPassword(account.fullName, account.password)
    );
  const checkpointPasswords = finalHasMarker
    ? new Map(
      [...accountsByCode.values()].map((
        account,
      ) => [account.studentCode, account.password]),
    )
    : await readCheckpoint();
  const usedPasswords = new Set(checkpointPasswords.values());
  const usedSuffixes = new Set<string>();
  for (const password of usedPasswords) {
    if (/\d{3}$/.test(password)) usedSuffixes.add(password.slice(-3));
  }

  const url = requiredEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const key = requiredEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
  const client = await loginRoot(url, key);
  const codes = roster.map((student) => student.studentCode);
  const [studentsResult, classesResult] = await Promise.all([
    client.from("students").select("id,user_id,student_code,full_name,status")
      .in("student_code", codes),
    client.from("classes").select("id,code,status").in("code", [
      ...new Set(roster.map((student) => student.classCode)),
    ]),
  ]);
  if (studentsResult.error) throw studentsResult.error;
  if (classesResult.error) throw classesResult.error;
  if ((studentsResult.data || []).length !== 47) {
    fail("Supabase chưa có đủ 47 học sinh");
  }
  if (
    (classesResult.data || []).length !== 4 ||
    (classesResult.data || []).some((row: any) => row.status !== "ACTIVE")
  ) fail("Lớp học không đủ hoặc không ACTIVE");
  const studentByCode = new Map(
    (studentsResult.data || []).map((row: any) => [row.student_code, row]),
  );
  const classByCode = new Map(
    (classesResult.data || []).map((row: any) => [row.code, row]),
  );
  for (const account of accountsByCode.values()) {
    const row = studentByCode.get(account.studentCode);
    if (!row || row.full_name !== account.fullName || row.status !== "ACTIVE") {
      fail(`Học sinh không khớp: ${account.studentCode}`);
    }
    if (!classByCode.has(account.classCode)) {
      fail(`Lớp không tồn tại: ${account.classCode}`);
    }
  }
  const userIds = [...studentByCode.values()].map((row: any) => row.user_id);
  const profilesResult = await client.from("profiles").select(
    "id,user_id,role,username,display_name,status,force_password_change",
  ).in("user_id", userIds);
  if (profilesResult.error) throw profilesResult.error;
  const profilesByUserId = new Map(
    (profilesResult.data || []).map((row: any) => [row.user_id, row]),
  );
  for (const account of accountsByCode.values()) {
    const student = studentByCode.get(account.studentCode);
    const profile = profilesByUserId.get(student.user_id);
    if (
      !profile || profile.role !== "STUDENT" || profile.status !== "ACTIVE" ||
      profile.username !== account.username
    ) fail(`Profile không khớp: ${account.studentCode}`);
  }
  const classIds = [...classByCode.values()].map((row: any) => row.id);
  const membershipsResult = await client.from("class_memberships").select(
    "id,class_id,student_id,status",
  ).in("class_id", classIds).in(
    "student_id",
    [...studentByCode.values()].map((row: any) => row.id),
  );
  if (membershipsResult.error) throw membershipsResult.error;
  const membershipKeys = new Set<string>();
  for (const row of membershipsResult.data || []) {
    const keyValue = `${row.class_id}:${row.student_id}`;
    if (row.status === "ACTIVE") {
      if (membershipKeys.has(keyValue)) {
        fail(`Membership ACTIVE bị trùng: ${keyValue}`);
      }
      membershipKeys.add(keyValue);
    }
  }
  for (const account of accountsByCode.values()) {
    const student = studentByCode.get(account.studentCode);
    const classId = classByCode.get(account.classCode).id;
    if (!membershipKeys.has(`${classId}:${student.id}`)) {
      fail(`Thiếu membership ACTIVE: ${account.studentCode}`);
    }
  }
  const before = await readInvariants(
    client,
    [...studentByCode.values()].map((row: any) => row.id),
  );
  let updated = 0;
  let skipped = 0;
  for (const account of accountsByCode.values()) {
    const student = studentByCode.get(account.studentCode);
    const profile = profilesByUserId.get(student.user_id);
    let password = checkpointPasswords.get(account.studentCode);
    if (!password) {
      password = makePassword(account, usedPasswords, usedSuffixes);
    }
    if (!isStudentPassword(account.fullName, password)) {
      fail(`Password checkpoint không đúng định dạng: ${account.studentCode}`);
    }
    const candidate: StudentAccount = { ...account, password };
    let alreadyValid = false;
    if (finalHasMarker || checkpointPasswords.has(account.studentCode)) {
      try {
        await verifyAccount(url, key, candidate);
        alreadyValid = profile.force_password_change === false;
      } catch {
        alreadyValid = false;
      }
    }
    if (alreadyValid) {
      skipped += 1;
      continue;
    }
    try {
      await invokeFunction(client, "admin-set-password", {
        user_id: student.user_id,
        password,
      });
    } catch (error) {
      try {
        await verifyAccount(url, key, candidate);
      } catch {
        throw error;
      }
    }
    checkpointPasswords.set(account.studentCode, password);
    await writeCheckpoint(checkpointPasswords);
    await verifyAccount(url, key, candidate);
    updated += 1;
  }
  if (checkpointPasswords.size !== 47) {
    fail(`Rotation chưa đủ 47 password: ${checkpointPasswords.size}`);
  }
  const finalProfiles = await client.from("profiles").select(
    "user_id,role,status,username,force_password_change",
  ).in("user_id", userIds);
  if (finalProfiles.error) throw finalProfiles.error;
  if (
    (finalProfiles.data || []).length !== 47 ||
    (finalProfiles.data || []).some((row: any) =>
      row.role !== "STUDENT" || row.status !== "ACTIVE" ||
      row.force_password_change !== false
    )
  ) fail("Profile sau rotation không hợp lệ");
  const after = await readInvariants(
    client,
    [...studentByCode.values()].map((row: any) => row.id),
  );
  assertInvariants(before, after);
  const finalAccounts = roster.map((student) => ({
    ...accountsByCode.get(student.studentCode)!,
    password: checkpointPasswords.get(student.studentCode)!,
  }));
  await Deno.writeTextFile(
    OUTPUT_PATH,
    renderStudentAccounts(finalAccounts, vietnamDateTime()),
  );
  await Deno.chmod(OUTPUT_PATH, 0o600);
  try {
    await Deno.remove(CHECKPOINT_PATH);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  console.log(JSON.stringify({
    success: true,
    students: 47,
    passwords_updated: updated,
    passwords_already_valid: skipped,
    force_password_change: false,
    sessions_unchanged: true,
    tuition_unchanged: true,
    account_file: OUTPUT_PATH,
  }));
}

if (import.meta.main) {
  try {
    await runRotation();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Rotation password học sinh thất bại",
    );
    Deno.exitCode = 1;
  }
}
