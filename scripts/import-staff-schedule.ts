import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { classes } from "./import-student-roster.ts";

type AppClient = SupabaseClient<any, "public", any>;

interface FunctionResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface LoginResult {
  session: { access_token: string; refresh_token: string } | null;
  profile: { role: string; status: string };
}

interface CreatedAccount {
  profile: {
    id: string;
    user_id: string;
    role: string;
    username: string;
    display_name: string;
    email?: string | null;
    force_password_change?: boolean;
  };
  temporary_password: string;
}

interface StaffDefinition {
  fullName: string;
  username: string;
  role: "TEACHER" | "ASSISTANT";
  email: string | null;
  phone: string | null;
}

interface StaffAssignment {
  classCode: string;
  fullName: string;
  assignmentRole: "TEACHER" | "ASSISTANT";
}

interface ScheduleDefinition {
  classCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  staff: string[];
}

interface AccountStatus {
  fullName: string;
  username: string;
  role?: "TEACHER" | "ASSISTANT";
  status: "CREATED" | "EXISTING" | "FAILED" | "BLOCKED";
  staffId?: string;
  userId?: string;
  email?: string | null;
  password?: string;
  error?: string;
}

const TARGET_YEAR = 2026;
const TARGET_MONTH = 9;
const ACCOUNT_OUTPUT_PATH = "docs/accounts/staff_accounts_2026-09.md";

export const staffDefinitions: StaffDefinition[] = [
  {
    fullName: "Nguyễn Hà Anh",
    username: "nguyenhaanh",
    role: "ASSISTANT",
    email: "nguynhanh0709@gmail.com",
    phone: "0967743683",
  },
  {
    fullName: "Nguyễn Thanh Tâm",
    username: "nguyenthanhtam",
    role: "ASSISTANT",
    email: "tamthanh20239@gmail.com",
    phone: null,
  },
  {
    fullName: "Nguyễn Mạnh Cường",
    username: "nguyenmanhcuong",
    role: "TEACHER",
    email: "manhcuongit2@gmail.com",
    phone: "0393355821",
  },
  {
    fullName: "Đào Phương Anh",
    username: "daophuonganh",
    role: "TEACHER",
    email: "phuonganhx632@gmail.com",
    phone: null,
  },
  {
    fullName: "Đào Quang Duy",
    username: "daoquangduy",
    role: "ASSISTANT",
    email: "duyq0402@gmail.com",
    phone: null,
  },
  {
    fullName: "Trần Mạnh Tiền",
    username: "tranmanhtien",
    role: "ASSISTANT",
    email: null,
    phone: null,
  },
];

export const classMonthStaff: StaffAssignment[] = [
  {
    classCode: "TOAN-6",
    fullName: "Đào Phương Anh",
    assignmentRole: "TEACHER",
  },
  {
    classCode: "TOAN-6",
    fullName: "Đào Quang Duy",
    assignmentRole: "ASSISTANT",
  },
  {
    classCode: "TOAN-6",
    fullName: "Nguyễn Thanh Tâm",
    assignmentRole: "ASSISTANT",
  },
  {
    classCode: "TOAN-7",
    fullName: "Nguyễn Mạnh Cường",
    assignmentRole: "TEACHER",
  },
  {
    classCode: "TOAN-7",
    fullName: "Nguyễn Hà Anh",
    assignmentRole: "ASSISTANT",
  },
  {
    classCode: "TOAN-8",
    fullName: "Nguyễn Mạnh Cường",
    assignmentRole: "TEACHER",
  },
  {
    classCode: "TOAN-8",
    fullName: "Đào Phương Anh",
    assignmentRole: "TEACHER",
  },
  {
    classCode: "TOAN-9",
    fullName: "Nguyễn Mạnh Cường",
    assignmentRole: "TEACHER",
  },
  {
    classCode: "TOAN-9",
    fullName: "Trần Mạnh Tiền",
    assignmentRole: "ASSISTANT",
  },
];

export const scheduleDefinitions: ScheduleDefinition[] = [
  {
    classCode: "TOAN-9",
    dayOfWeek: 1,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
    staff: ["Nguyễn Mạnh Cường", "Trần Mạnh Tiền"],
  },
  {
    classCode: "TOAN-8",
    dayOfWeek: 2,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
    staff: ["Nguyễn Mạnh Cường"],
  },
  {
    classCode: "TOAN-6",
    dayOfWeek: 4,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
    staff: ["Đào Phương Anh", "Đào Quang Duy", "Nguyễn Thanh Tâm"],
  },
  {
    classCode: "TOAN-9",
    dayOfWeek: 4,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC02",
    staff: ["Nguyễn Mạnh Cường", "Trần Mạnh Tiền"],
  },
  {
    classCode: "TOAN-7",
    dayOfWeek: 5,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
    staff: ["Nguyễn Mạnh Cường", "Nguyễn Hà Anh"],
  },
  {
    classCode: "TOAN-8",
    dayOfWeek: 7,
    startTime: "08:00",
    endTime: "10:00",
    room: "HC02",
    staff: ["Đào Phương Anh"],
  },
  {
    classCode: "TOAN-7",
    dayOfWeek: 7,
    startTime: "08:00",
    endTime: "10:00",
    room: "HC01",
    staff: ["Nguyễn Mạnh Cường", "Nguyễn Hà Anh"],
  },
  {
    classCode: "TOAN-6",
    dayOfWeek: 7,
    startTime: "17:30",
    endTime: "19:30",
    room: null,
    staff: ["Đào Phương Anh", "Đào Quang Duy", "Nguyễn Thanh Tâm"],
  },
];

function fail(message: string): never {
  throw new Error(message);
}

export function assertStaffScheduleData() {
  if (staffDefinitions.length !== 6) fail("Phải có đúng 6 nhân sự");
  if (new Set(staffDefinitions.map((item) => item.fullName)).size !== 6) {
    fail("Tên nhân sự bị trùng");
  }
  if (new Set(staffDefinitions.map((item) => item.username)).size !== 6) {
    fail("Username nhân sự bị trùng");
  }
  if (classMonthStaff.length !== 9) fail("Phải có đúng 9 phân công lớp");
  if (scheduleDefinitions.length !== 8) fail("Phải có đúng 8 lịch");
  const staffNames = new Set(staffDefinitions.map((item) => item.fullName));
  const scheduleKeys = new Set<string>();
  for (const row of scheduleDefinitions) {
    if (!classes.some((item) => item.code === row.classCode)) {
      fail(`Lớp không hợp lệ: ${row.classCode}`);
    }
    if (row.dayOfWeek < 1 || row.dayOfWeek > 7) fail("Thứ không hợp lệ");
    if (
      !/^\d{2}:\d{2}$/.test(row.startTime) || !/^\d{2}:\d{2}$/.test(row.endTime)
    ) {
      fail(`Giờ không hợp lệ: ${row.classCode}`);
    }
    const start = Number(row.startTime.slice(0, 2)) * 60 +
      Number(row.startTime.slice(3));
    const end = Number(row.endTime.slice(0, 2)) * 60 +
      Number(row.endTime.slice(3));
    if (end - start !== 120) fail(`Lịch ${row.classCode} phải dài 2 giờ`);
    if (row.room !== null && !/^HC\d{2}$/.test(row.room)) {
      fail(`Phòng không hợp lệ: ${row.room}`);
    }
    const key =
      `${row.classCode}:${row.dayOfWeek}:${row.startTime}:${row.endTime}`;
    if (scheduleKeys.has(key)) fail(`Lịch bị trùng: ${key}`);
    scheduleKeys.add(key);
    if (!row.staff.length || new Set(row.staff).size !== row.staff.length) {
      fail(`Staff slot không hợp lệ: ${key}`);
    }
    for (const name of row.staff) {
      if (!staffNames.has(name)) fail(`Nhân sự slot không tồn tại: ${name}`);
    }
  }
  const classCounts = new Map<string, number>();
  for (const row of scheduleDefinitions) {
    classCounts.set(row.classCode, (classCounts.get(row.classCode) || 0) + 1);
  }
  for (const item of classes) {
    if (classCounts.get(item.code) !== 2) fail(`${item.code} phải có 2 lịch`);
  }
  for (const assignment of classMonthStaff) {
    if (
      !staffNames.has(assignment.fullName) ||
      !classes.some((item) => item.code === assignment.classCode)
    ) {
      fail(
        `Phân công không hợp lệ: ${assignment.classCode}/${assignment.fullName}`,
      );
    }
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

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function scheduleKey(
  row: {
    class_month_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  },
): string {
  return `${row.class_month_id}:${row.day_of_week}:${
    normalizeTime(row.start_time)
  }:${normalizeTime(row.end_time)}`;
}

function expectedRoom(row: ScheduleDefinition): string {
  return row.room || "";
}

function randomPassword(username: string): string {
  return `${username}${Math.floor(100 + Math.random() * 900)}`;
}

async function writeCredentialFile(accounts: AccountStatus[], extra?: string) {
  await Deno.mkdir("docs/accounts", { recursive: true });
  const lines = [
    "# HVC EDU — Tài khoản nhân sự tháng 09/2026",
    "",
    "> CONFIDENTIAL — LOCAL ONLY — DO NOT COMMIT / DO NOT PUSH.",
    "> Password được ghi plaintext theo yêu cầu bàn giao. Hãy xóa file hoặc rotate password sau khi bàn giao.",
    "> Nguyễn Mạnh Cường là tài khoản EXISTING; password không được reset và không được xuất ra.",
    "",
    "| Trạng thái | Họ tên | Vai trò | Username | Password | Email | Ghi chú |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const account of accounts) {
    lines.push(
      `| ${account.status} | ${account.fullName} | ${
        account.role || "—"
      } | ${account.username} | ${account.password || "UNKNOWN/EXISTING"} | ${
        account.email || "—"
      } | ${
        account.error || (account.status === "EXISTING"
          ? "Giữ nguyên credential hiện có"
          : "Sinh tại thời điểm import; force_password_change=true")
      } |`,
    );
  }
  if (extra) lines.push("", `> Import note: ${extra}`);
  await Deno.writeTextFile(ACCOUNT_OUTPUT_PATH, `${lines.join("\n")}\n`);
  await Deno.chmod(ACCOUNT_OUTPUT_PATH, 0o600);
}

async function audit(
  client: AppClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldData: unknown,
  newData: unknown,
  reason: string,
) {
  const result = await client.rpc("write_audit", {
    p_actor_user_id: actorId,
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_old_data: oldData,
    p_new_data: newData,
    p_reason: reason,
  });
  if (result.error) throw result.error;
}

async function readExistingCredentialPasswords(): Promise<Map<string, string>> {
  const passwords = new Map<string, string>();
  try {
    const text = await Deno.readTextFile(ACCOUNT_OUTPUT_PATH);
    for (const line of text.split("\n")) {
      if (!line.trim().startsWith("|")) continue;
      const cells = line.split("|").slice(1, -1).map((value) => value.trim());
      if (cells.length >= 5 && cells[4] && !cells[4].startsWith("UNKNOWN/")) {
        passwords.set(cells[3], cells[4]);
      }
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return passwords;
}

async function runImport() {
  assertStaffScheduleData();
  const url = requiredEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const key = requiredEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
  const client = await loginRoot(url, key);
  const rootUser = await client.auth.getUser();
  if (rootUser.error || !rootUser.data.user) {
    throw new Error("Không xác định được ROOT user");
  }
  const actorId = rootUser.data.user.id;
  const classCodes = classes.map((item) => item.code);

  const [
    classResult,
    subjectResult,
    gradeResult,
    profilesResult,
    staffResult,
    completedBefore,
  ] = await Promise.all([
    client.from("classes").select(
      "id,code,name,subject_id,grade_id,default_monthly_fee,default_session_fee,capacity_policy,status",
    ).in("code", classCodes),
    client.from("subjects").select("id,code").eq("code", "MATH"),
    client.from("grades").select("id,code").in(
      "code",
      classes.map((item) => item.gradeCode),
    ),
    client.from("profiles").select(
      "id,user_id,role,username,display_name,email,phone,status,force_password_change",
    ),
    client.from("staff").select(
      "id,user_id,staff_type,full_name,email,phone,status,staff_code",
    ),
    client.from("sessions").select("id", { count: "exact", head: true }).eq(
      "status",
      "COMPLETED",
    ),
  ]);
  for (
    const result of [
      classResult,
      subjectResult,
      gradeResult,
      profilesResult,
      staffResult,
    ]
  ) if (result.error) throw result.error;
  if (completedBefore.error) throw completedBefore.error;
  const subject = (subjectResult.data || [])[0];
  if (!subject || (subjectResult.data || []).length !== 1) {
    fail("Subject MATH không duy nhất");
  }
  const gradeByCode = new Map(
    (gradeResult.data || []).map((row: any) => [row.code, row]),
  );
  if (gradeByCode.size !== 4) fail("GRADE_6 đến GRADE_9 phải tồn tại đủ");
  const classByCode = new Map<string, any>();
  for (const row of classResult.data || []) {
    if (classByCode.has(row.code)) fail(`Trùng lớp ${row.code}`);
    classByCode.set(row.code, row);
  }
  for (const definition of classes) {
    const row = classByCode.get(definition.code);
    if (
      !row || row.status !== "ACTIVE" || row.subject_id !== subject.id ||
      row.grade_id !== gradeByCode.get(definition.gradeCode)?.id ||
      Number(row.default_monthly_fee) !== 0 ||
      Number(row.default_session_fee) !== definition.sessionFee ||
      row.capacity_policy !== "UNLIMITED"
    ) {
      fail(`Thông tin lớp ${definition.code} không khớp`);
    }
  }

  const staffRows = staffResult.data || [];
  const profileRows = profilesResult.data || [];
  const staffByName = new Map<string, any>();
  const profileByUserId = new Map(
    profileRows.map((row: any) => [row.user_id, row]),
  );
  for (const row of staffRows) {
    if (staffByName.has(row.full_name)) fail(`Trùng nhân sự ${row.full_name}`);
    staffByName.set(row.full_name, row);
  }
  const existingPasswords = await readExistingCredentialPasswords();
  const accountStatuses: AccountStatus[] = [];
  const resolvedStaff = new Map<string, any>();

  // The plan explicitly requires Cường's existing account to be preserved.
  const cuong = staffByName.get("Nguyễn Mạnh Cường");
  if (!cuong || cuong.staff_type !== "TEACHER" || cuong.status !== "ACTIVE") {
    const blocked = staffDefinitions.map((definition) => ({
      fullName: definition.fullName,
      username: definition.username,
      status: "BLOCKED" as const,
      error:
        "Thiếu tài khoản/nhân sự Cường hiện hữu; không tự tạo hoặc đổi credential.",
    }));
    await writeCredentialFile(
      blocked,
      "BLOCKED trước khi ghi dữ liệu vì tài khoản Cường hiện hữu không khớp.",
    );
    fail("Không tìm thấy đúng nhân sự Nguyễn Mạnh Cường hiện hữu");
  }
  const cuongProfile = profileByUserId.get(cuong.user_id);
  if (
    !cuongProfile || cuongProfile.role !== "TEACHER" ||
    cuongProfile.status !== "ACTIVE"
  ) fail("Profile Cường không khớp");
  resolvedStaff.set(cuong.full_name, cuong);
  accountStatuses.push({
    fullName: cuong.full_name,
    username: cuongProfile.username || "CuongNguyen",
    role: "TEACHER",
    status: "EXISTING",
    staffId: cuong.id,
    userId: cuong.user_id,
    email: cuongProfile.email,
    password: "UNKNOWN/EXISTING",
  });

  for (
    const definition of staffDefinitions.filter((item) =>
      item.fullName !== cuong.full_name
    )
  ) {
    const matchingProfile = profileRows.filter((row: any) =>
      row.username?.toLowerCase() === definition.username.toLowerCase() ||
      (definition.email &&
        row.email?.toLowerCase() === definition.email.toLowerCase()) ||
      (definition.phone && row.phone === definition.phone) ||
      row.display_name === definition.fullName
    );
    const matchingStaff = staffRows.filter((row: any) =>
      row.full_name === definition.fullName ||
      (definition.email &&
        row.email?.toLowerCase() === definition.email.toLowerCase()) ||
      (definition.phone && row.phone === definition.phone)
    );
    if (matchingProfile.length > 1 || matchingStaff.length > 1) {
      fail(`Có nhiều bản ghi trùng khi đối soát ${definition.fullName}`);
    }
    if (matchingProfile.length || matchingStaff.length) {
      const profile = matchingProfile[0];
      const staff = matchingStaff[0];
      if (
        !profile || !staff || profile.user_id !== staff.user_id ||
        profile.role !== definition.role || profile.status !== "ACTIVE" ||
        staff.staff_type !== definition.role || staff.status !== "ACTIVE" ||
        staff.full_name !== definition.fullName ||
        profile.username?.toLowerCase() !== definition.username.toLowerCase() ||
        (definition.email &&
          profile.email?.toLowerCase() !== definition.email.toLowerCase()) ||
        (definition.phone && profile.phone !== definition.phone)
      ) {
        fail(
          `Bản ghi hiện có của ${definition.fullName} bị lệch; dừng để không ghi đè âm thầm`,
        );
      }
      resolvedStaff.set(definition.fullName, staff);
      accountStatuses.push({
        fullName: definition.fullName,
        username: profile.username,
        role: definition.role,
        status: "EXISTING",
        staffId: staff.id,
        userId: staff.user_id,
        email: profile.email,
        password: existingPasswords.get(definition.username) ||
          "UNKNOWN/EXISTING",
      });
    }
  }

  const classIds = [...classByCode.values()].map((row) => row.id);
  const classMonthResult = await client.from("class_months").select(
    "id,class_id,year,month,status",
  ).in("class_id", classIds).eq("year", TARGET_YEAR).eq("month", TARGET_MONTH);
  if (classMonthResult.error) throw classMonthResult.error;
  const classMonths = classMonthResult.data || [];
  if (classMonths.length !== 4) {
    fail(`Phải có đúng 4 ClassMonth ${TARGET_YEAR}/${TARGET_MONTH}`);
  }
  const classMonthByClassId = new Map<string, any>();
  for (const row of classMonths) {
    if (classMonthByClassId.has(row.class_id) || row.status !== "DRAFT") {
      fail("ClassMonth bị trùng hoặc không ở DRAFT");
    }
    classMonthByClassId.set(row.class_id, row);
  }
  const classMonthIds = classMonths.map((row) => row.id);
  const targetSessions = await client.from("sessions").select(
    "id,class_month_id,status",
  ).in("class_month_id", classMonthIds);
  if (targetSessions.error) throw targetSessions.error;
  if ((targetSessions.data || []).length) {
    fail("Target ClassMonth đã có session; dừng để bảo vệ dữ liệu lịch sử");
  }

  const classMonthIdByCode = new Map<string, string>();
  for (const definition of classes) {
    classMonthIdByCode.set(
      definition.code,
      classMonthByClassId.get(classByCode.get(definition.code).id)?.id,
    );
  }

  const [snapshotResult, scheduleResult, classStaffResult] = await Promise.all([
    client.from("class_month_students").select(
      "id,class_month_id,student_id,membership_start_date,membership_end_date,monthly_fee_snapshot,session_fee_snapshot",
    ).in("class_month_id", classMonthIds),
    client.from("class_month_schedules").select(
      "id,class_month_id,day_of_week,start_time,end_time,room,status",
    ).in("class_month_id", classMonthIds),
    client.from("class_month_staff").select(
      "id,class_month_id,staff_id,assignment_role",
    ).in("class_month_id", classMonthIds),
  ]);
  for (const result of [snapshotResult, scheduleResult, classStaffResult]) {
    if (result.error) throw result.error;
  }

  const expectedSnapshotRows: any[] = [];
  const rosterRows = await client.from("students").select(
    "id,student_code,full_name,status",
  ).in("student_code", [
    ...Array.from(
      { length: 19 },
      (_, index) => `HS06-${String(index + 1).padStart(3, "0")}`,
    ),
    ...Array.from(
      { length: 12 },
      (_, index) => `HS07-${String(index + 1).padStart(3, "0")}`,
    ),
    ...Array.from(
      { length: 7 },
      (_, index) => `HS08-${String(index + 1).padStart(3, "0")}`,
    ),
    ...Array.from(
      { length: 9 },
      (_, index) => `HS09-${String(index + 1).padStart(3, "0")}`,
    ),
  ]);
  if (rosterRows.error) throw rosterRows.error;
  if ((rosterRows.data || []).length !== 47) {
    fail("Supabase chưa có đủ 47 học sinh");
  }
  const studentByCode = new Map(
    (rosterRows.data || []).map((row: any) => [row.student_code, row]),
  );
  for (const definition of classes) {
    const classId = classByCode.get(definition.code).id;
    const count = [...studentByCode.keys()].filter((code) =>
      code.startsWith(`HS${definition.code.slice(-1).padStart(2, "0")}-`)
    ).length;
    if (!count) {
      fail(`Thiếu roster ${definition.code}`);
    }
    const membership = await client.from("class_memberships").select(
      "id,class_id,student_id,start_date,end_date,status",
    ).eq("class_id", classId).eq("status", "ACTIVE").in(
      "student_id",
      [...studentByCode.values()].map((row: any) =>
        row.id
      ),
    );
    if (membership.error) throw membership.error;
    const membershipByStudent = new Map<string, any>();
    for (const row of membership.data || []) {
      if (membershipByStudent.has(row.student_id)) {
        fail(
          `Nhiều membership ACTIVE trong ${definition.code}`,
        );
      }
      membershipByStudent.set(row.student_id, row);
    }
    for (const [code, student] of studentByCode) {
      if (
        !code.startsWith(`HS${definition.code.slice(-1).padStart(2, "0")}-`)
      ) continue;
      if (student.status !== "ACTIVE") fail(`Học sinh ${code} không ACTIVE`);
      const activeMembership = membershipByStudent.get(student.id);
      if (!activeMembership) fail(`Thiếu membership ACTIVE cho ${code}`);
      expectedSnapshotRows.push({
        class_month_id: classMonthIdByCode.get(definition.code),
        student_id: student.id,
        membership_start_date: activeMembership.start_date,
        membership_end_date: activeMembership.end_date,
        monthly_fee_snapshot: 0,
        session_fee_snapshot: definition.sessionFee,
      });
    }
  }
  const expectedSnapshots = new Map(
    expectedSnapshotRows.map((
      row,
    ) => [`${row.class_month_id}:${row.student_id}`, row]),
  );
  const existingSnapshots = snapshotResult.data || [];
  const existingSnapshotKeys = new Set<string>();
  for (const row of existingSnapshots) {
    const key = `${row.class_month_id}:${row.student_id}`;
    if (existingSnapshotKeys.has(key) || !expectedSnapshots.has(key)) {
      fail(`Snapshot hiện có dư/trùng: ${key}`);
    }
    existingSnapshotKeys.add(key);
    const expected = expectedSnapshots.get(key);
    if (
      row.membership_start_date !== expected.membership_start_date ||
      row.membership_end_date !== expected.membership_end_date ||
      Number(row.monthly_fee_snapshot) !== 0 ||
      Number(row.session_fee_snapshot) !== Number(expected.session_fee_snapshot)
    ) fail(`Snapshot hiện có bị lệch: ${key}`);
  }
  const missingSnapshots = expectedSnapshotRows.filter((row) =>
    !existingSnapshotKeys.has(`${row.class_month_id}:${row.student_id}`)
  );

  const expectedScheduleByKey = new Map<string, ScheduleDefinition>();
  for (const definition of scheduleDefinitions) {
    const classMonthId = classMonthIdByCode.get(definition.classCode)!;
    expectedScheduleByKey.set(
      `${classMonthId}:${definition.dayOfWeek}:${definition.startTime}:${definition.endTime}`,
      definition,
    );
  }
  let schedules = scheduleResult.data || [];
  const staleMove = schedules.find((row: any) =>
    row.class_month_id === classMonthIdByCode.get("TOAN-6") &&
    row.day_of_week === 6 && normalizeTime(row.start_time) === "17:30" &&
    normalizeTime(row.end_time) === "19:30" && row.room === "HC01" &&
    row.status === "ACTIVE"
  );
  const targetSunday = schedules.find((row: any) =>
    row.class_month_id === classMonthIdByCode.get("TOAN-6") &&
    row.day_of_week === 7 && normalizeTime(row.start_time) === "17:30" &&
    normalizeTime(row.end_time) === "19:30"
  );
  if (staleMove && targetSunday) {
    fail("Toán 6 đã có cả Thứ 7 cũ và Chủ nhật mới; không tự xóa lịch");
  }
  if (staleMove) {
    // Keep the preflight read-only. The update is applied only after every
    // account has been resolved or created successfully.
    schedules = schedules.map((row: any) =>
      row.id === staleMove.id ? { ...row, day_of_week: 7, room: null } : row
    );
  }
  const seenScheduleKeys = new Set<string>();
  for (const row of schedules) {
    if (row.status !== "ACTIVE") fail(`Lịch ${row.id} không ACTIVE`);
    const key = scheduleKey(row);
    if (seenScheduleKeys.has(key)) fail(`Lịch trùng slot: ${key}`);
    seenScheduleKeys.add(key);
    const expected = expectedScheduleByKey.get(key);
    if (!expected || expectedRoom(expected) !== (row.room || "")) {
      fail(`Lịch hiện có không khớp: ${key}`);
    }
  }
  if (schedules.length !== 8) {
    fail(`Sau đối soát phải có đúng 8 lịch, nhận ${schedules.length}`);
  }
  const missingSchedules = scheduleDefinitions.filter((definition) => {
    const key = `${
      classMonthIdByCode.get(definition.classCode)
    }:${definition.dayOfWeek}:${definition.startTime}:${definition.endTime}`;
    return !seenScheduleKeys.has(key);
  }).map((definition) => ({
    class_month_id: classMonthIdByCode.get(definition.classCode),
    day_of_week: definition.dayOfWeek,
    start_time: definition.startTime,
    end_time: definition.endTime,
    room: definition.room,
    status: "ACTIVE",
  }));

  for (
    const definition of staffDefinitions.filter((item) =>
      item.fullName !== cuong.full_name
    )
  ) {
    if (resolvedStaff.has(definition.fullName)) continue;
    const password = randomPassword(definition.username);
    try {
      const created = await invokeFunction<CreatedAccount>(
        client,
        "admin-create-user",
        {
          role: definition.role,
          username: definition.username,
          password,
          ...(definition.email ? { email: definition.email } : {}),
          ...(definition.phone ? { phone: definition.phone } : {}),
          display_name: definition.fullName,
          force_password_change: true,
          staff: { full_name: definition.fullName },
        },
      );
      const createdStaff = await client.from("staff").select(
        "id,user_id,staff_type,full_name,email,phone,status",
      ).eq("user_id", created.profile.user_id).single();
      if (createdStaff.error || !createdStaff.data) {
        throw createdStaff.error || new Error("STAFF_CREATE_RESPONSE_INVALID");
      }
      if (created.profile.force_password_change !== true) {
        throw new Error("FORCE_PASSWORD_CHANGE_NOT_SET");
      }
      resolvedStaff.set(definition.fullName, createdStaff.data);
      const status: AccountStatus = {
        fullName: definition.fullName,
        username: definition.username,
        role: definition.role,
        status: "CREATED",
        staffId: createdStaff.data.id,
        userId: created.profile.user_id,
        email: created.profile.email ?? createdStaff.data.email,
        password,
      };
      accountStatuses.push(status);
      await writeCredentialFile([
        ...accountStatuses,
        ...staffDefinitions.filter((item) =>
          !accountStatuses.some((account) => account.fullName === item.fullName)
        ).map((item) => ({
          fullName: item.fullName,
          username: item.username,
          status: "BLOCKED" as const,
          error: "Chưa chạy tới bước tạo tài khoản",
        })),
      ], "Đang thực hiện import; file sẽ được cập nhật sau mỗi tài khoản.");
      const testClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const login = await invokeFunction<LoginResult>(
        testClient,
        "login-by-identifier",
        { identifier: definition.username, password },
      );
      if (
        !login.session || login.profile.role !== definition.role ||
        login.profile.status !== "ACTIVE"
      ) throw new Error("ACCOUNT_LOGIN_VERIFICATION_FAILED");
    } catch (error) {
      const failed: AccountStatus = {
        fullName: definition.fullName,
        username: definition.username,
        status: "FAILED",
        error: error instanceof Error
          ? error.message
          : "Không thể tạo tài khoản",
      };
      accountStatuses.push(failed);
      await writeCredentialFile([
        ...accountStatuses,
        ...staffDefinitions.filter((item) =>
          !accountStatuses.some((account) => account.fullName === item.fullName)
        ).map((item) => ({
          fullName: item.fullName,
          username: item.username,
          status: "BLOCKED" as const,
          error: "Bị chặn do tài khoản trước đó thất bại",
        })),
      ], "FAILED trong bước tạo/kiểm tra tài khoản; chưa ghi phân công lớp.");
      throw new Error(
        `Tạo tài khoản ${definition.fullName} thất bại: ${failed.error}`,
      );
    }
  }
  if (
    accountStatuses.length !== 6 ||
    accountStatuses.some((item) => !resolvedStaff.has(item.fullName))
  ) fail("Chưa resolve đủ 6 nhân sự");
  await writeCredentialFile(
    accountStatuses,
    "Đã xác thực tài khoản; đang tiếp tục ghi phân công và mapping lịch.",
  );

  if (missingSnapshots.length) {
    const inserted = await client.from("class_month_students").insert(
      missingSnapshots,
    ).select("id");
    if (inserted.error) throw inserted.error;
  }
  if (staleMove) {
    const updated = await client.from("class_month_schedules").update({
      day_of_week: 7,
      room: null,
    }).eq("id", staleMove.id).eq("status", "ACTIVE").select(
      "id,class_month_id,day_of_week,start_time,end_time,room,status",
    ).single();
    if (updated.error || !updated.data) {
      throw updated.error || new Error("Không thể thay lịch Toán 6");
    }
    await audit(
      client,
      actorId,
      "SCHEDULE_IMPORT_RECONCILE",
      "class_month_schedules",
      staleMove.id,
      staleMove,
      updated.data,
      "Thay slot Toán 6 Thứ 7 bằng Chủ nhật theo kế hoạch tháng 09/2026",
    );
  }
  if (missingSchedules.length) {
    const inserted = await client.from("class_month_schedules").insert(
      missingSchedules,
    ).select("id,class_month_id,day_of_week,start_time,end_time,room,status");
    if (inserted.error) throw inserted.error;
    schedules = [...schedules, ...(inserted.data || [])];
  }

  const expectedClassStaff = new Map(
    classMonthStaff.map((
      assignment,
    ) => [
      `${classMonthIdByCode.get(assignment.classCode)}:${
        resolvedStaff.get(assignment.fullName).id
      }`,
      assignment,
    ]),
  );
  const existingClassStaff = classStaffResult.data || [];
  const classStaffKeys = new Set<string>();
  for (const row of existingClassStaff) {
    const key = `${row.class_month_id}:${row.staff_id}`;
    if (classStaffKeys.has(key) || !expectedClassStaff.has(key)) {
      fail(`class_month_staff hiện có dư/trùng: ${key}`);
    }
    classStaffKeys.add(key);
    const expected = expectedClassStaff.get(key);
    if (!expected || row.assignment_role !== expected.assignmentRole) {
      fail(`Role class_month_staff bị lệch: ${key}`);
    }
  }
  const missingClassStaff = [...expectedClassStaff.entries()].filter(([key]) =>
    !classStaffKeys.has(key)
  ).map(([, assignment]) => ({
    class_month_id: classMonthIdByCode.get(assignment.classCode),
    staff_id: resolvedStaff.get(assignment.fullName).id,
    assignment_role: assignment.assignmentRole,
  }));
  if (missingClassStaff.length) {
    const inserted = await client.from("class_month_staff").insert(
      missingClassStaff,
    ).select("id");
    if (inserted.error) throw inserted.error;
  }

  const expectedMappings = new Map<
    string,
    { staffId: string; role: "TEACHER" | "ASSISTANT" }
  >();
  for (const schedule of schedules) {
    const definition = expectedScheduleByKey.get(scheduleKey(schedule));
    if (!definition) fail(`Thiếu định nghĩa staff cho lịch ${schedule.id}`);
    for (const name of definition.staff) {
      const staff = resolvedStaff.get(name);
      if (!staff) fail(`Không resolve staff ${name}`);
      const classAssignment = classMonthStaff.find((item) =>
        item.classCode === definition.classCode && item.fullName === name
      );
      if (!classAssignment) {
        fail(`Staff ${name} chưa được gán vào ${definition.classCode}`);
      }
      expectedMappings.set(`${schedule.id}:${staff.id}`, {
        staffId: staff.id,
        role: classAssignment.assignmentRole,
      });
    }
  }
  const scheduleIds = schedules.map((row: any) => row.id);
  const existingMappingResult = await client.from("class_month_schedule_staff")
    .select("schedule_id,staff_id,assignment_role").in(
      "schedule_id",
      scheduleIds,
    );
  if (existingMappingResult.error) throw existingMappingResult.error;
  const mappingKeys = new Set<string>();
  for (const row of existingMappingResult.data || []) {
    const key = `${row.schedule_id}:${row.staff_id}`;
    if (mappingKeys.has(key) || !expectedMappings.has(key)) {
      fail(`Mapping lịch hiện có dư/trùng: ${key}`);
    }
    mappingKeys.add(key);
    const expected = expectedMappings.get(key);
    if (!expected || row.assignment_role !== expected.role) {
      fail(`Role mapping lịch bị lệch: ${key}`);
    }
  }
  // Build missing mappings by iterating keys so schedule_id cannot be lost.
  const missingMappingRows = [...expectedMappings.entries()].filter(([key]) =>
    !mappingKeys.has(key)
  ).map(([key, expected]) => ({
    schedule_id: key.split(":")[0],
    staff_id: expected.staffId,
    assignment_role: expected.role,
  }));
  if (missingMappingRows.length) {
    const inserted = await client.from("class_month_schedule_staff").insert(
      missingMappingRows,
    ).select("schedule_id,staff_id,assignment_role");
    if (inserted.error) throw inserted.error;
  }

  const [
    finalMonths,
    finalSnapshots,
    finalSchedules,
    finalClassStaff,
    finalMappings,
    finalSessions,
    finalTuition,
    completedAfter,
  ] = await Promise.all([
    client.from("class_months").select("id,class_id,status").in(
      "id",
      classMonthIds,
    ),
    client.from("class_month_students").select(
      "id,class_month_id,session_fee_snapshot",
    ).in("class_month_id", classMonthIds),
    client.from("class_month_schedules").select(
      "id,class_month_id,day_of_week,start_time,end_time,room,status",
    ).in("class_month_id", classMonthIds),
    client.from("class_month_staff").select(
      "id,class_month_id,staff_id,assignment_role",
    ).in("class_month_id", classMonthIds),
    client.from("class_month_schedule_staff").select(
      "schedule_id,staff_id,assignment_role",
    ).in("schedule_id", scheduleIds),
    client.from("sessions").select("id").in("class_month_id", classMonthIds),
    client.from("tuition_records").select("id").in(
      "class_month_id",
      classMonthIds,
    ),
    client.from("sessions").select("id", { count: "exact", head: true }).eq(
      "status",
      "COMPLETED",
    ),
  ]);
  for (
    const result of [
      finalMonths,
      finalSnapshots,
      finalSchedules,
      finalClassStaff,
      finalMappings,
      finalSessions,
      finalTuition,
    ]
  ) if (result.error) throw result.error;
  if (completedAfter.error) throw completedAfter.error;
  if (
    finalMonths.data?.length !== 4 ||
    finalMonths.data.some((row: any) => row.status !== "DRAFT")
  ) fail("ClassMonth cuối không đúng DRAFT");
  if (finalSnapshots.data?.length !== 47) {
    fail(`Snapshot cuối không đủ 47: ${finalSnapshots.data?.length}`);
  }
  if (
    finalSchedules.data?.length !== 8 ||
    finalSchedules.data.some((row: any) => row.status !== "ACTIVE")
  ) fail("Lịch cuối không đủ 8 ACTIVE");
  if (finalClassStaff.data?.length !== 9) fail("Phân công lớp cuối không đủ 9");
  if (finalMappings.data?.length !== 16) {
    fail(`Mapping slot cuối không đủ 16: ${finalMappings.data?.length}`);
  }
  if (finalSessions.data?.length || finalTuition.data?.length) {
    fail("Import phát sinh session hoặc tuition");
  }
  if ((completedAfter.count || 0) !== (completedBefore.count || 0)) {
    fail("Completed session bị thay đổi");
  }
  await writeCredentialFile(
    accountStatuses,
    "Hoàn tất import staff và lịch; Cường EXISTING, 5 tài khoản còn lại CREATED/EXISTING.",
  );

  console.log(JSON.stringify({
    success: true,
    target: `${TARGET_YEAR}-${String(TARGET_MONTH).padStart(2, "0")}`,
    staff: accountStatuses.map((item) => ({
      name: item.fullName,
      username: item.username,
      status: item.status,
    })),
    classes: { class_months: 4, class_month_staff: 9 },
    schedules: {
      active: 8,
      schedule_staff: 16,
      moved_toan6_saturday_to_sunday: Boolean(staleMove),
    },
    snapshots: 47,
    sessions: 0,
    tuition_records: 0,
    completed_sessions_unchanged: true,
  }));
}

if (import.meta.main) {
  try {
    await runImport();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Import nhân sự/lịch thất bại",
    );
    Deno.exitCode = 1;
  }
}
