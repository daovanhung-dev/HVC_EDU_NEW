import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertRoster, buildRoster, classes } from "./import-student-roster.ts";

type AppClient = SupabaseClient<any, "public", any>;

interface FunctionResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface LoginResult {
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
  profile: { role: string; status: string };
}

interface ScheduleDefinition {
  classCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

const TARGET_YEAR = 2026;
const TARGET_MONTH = 9;

export const scheduleRows: ScheduleDefinition[] = [
  {
    classCode: "TOAN-9",
    dayOfWeek: 1,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
  },
  {
    classCode: "TOAN-8",
    dayOfWeek: 2,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
  },
  {
    classCode: "TOAN-6",
    dayOfWeek: 4,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
  },
  {
    classCode: "TOAN-9",
    dayOfWeek: 4,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC02",
  },
  {
    classCode: "TOAN-7",
    dayOfWeek: 5,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
  },
  {
    classCode: "TOAN-6",
    dayOfWeek: 6,
    startTime: "17:30",
    endTime: "19:30",
    room: "HC01",
  },
  {
    classCode: "TOAN-8",
    dayOfWeek: 7,
    startTime: "08:00",
    endTime: "10:00",
    room: "HC02",
  },
  {
    classCode: "TOAN-7",
    dayOfWeek: 7,
    startTime: "08:00",
    endTime: "10:00",
    room: "HC01",
  },
];

function fail(message: string): never {
  throw new Error(message);
}

export function assertScheduleData(rows: ScheduleDefinition[] = scheduleRows) {
  if (rows.length !== 8) fail(`Cần 8 lịch, nhận được ${rows.length}`);
  const validClasses = new Set(classes.map((item) => item.code));
  const keys = new Set<string>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!validClasses.has(row.classCode)) {
      fail(`Lớp lịch không hợp lệ: ${row.classCode}`);
    }
    if (row.dayOfWeek < 1 || row.dayOfWeek > 7) {
      fail(`Thứ không hợp lệ: ${row.dayOfWeek}`);
    }
    if (
      !/^\d{2}:\d{2}$/.test(row.startTime) || !/^\d{2}:\d{2}$/.test(row.endTime)
    ) {
      fail(`Giờ không hợp lệ cho ${row.classCode}`);
    }
    const start = Number(row.startTime.slice(0, 2)) * 60 +
      Number(row.startTime.slice(3));
    const end = Number(row.endTime.slice(0, 2)) * 60 +
      Number(row.endTime.slice(3));
    if (end - start !== 120) fail(`Lịch ${row.classCode} không dài đúng 2 giờ`);
    if (!/^HC\d{2}$/.test(row.room)) fail(`Phòng không hợp lệ: ${row.room}`);
    const key =
      `${row.classCode}:${row.dayOfWeek}:${row.startTime}:${row.endTime}:${row.room}`;
    if (keys.has(key)) fail(`Lịch bị trùng: ${key}`);
    keys.add(key);
    counts.set(row.classCode, (counts.get(row.classCode) || 0) + 1);
  }
  for (const code of classes.map((item) => item.code)) {
    if ((counts.get(code) || 0) !== 2) fail(`${code} phải có 2 lịch`);
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
  const session = await client.auth.setSession(login.session);
  if (session.error) throw session.error;
  return client;
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function scheduleSlotKey(
  classMonthId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): string {
  return `${classMonthId}:${dayOfWeek}:${normalizeTime(startTime)}:${
    normalizeTime(endTime)
  }`;
}

async function runImport() {
  assertScheduleData();
  const roster = buildRoster();
  assertRoster(roster);
  const url = requiredEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const publishableKey = requiredEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
  const client = await loginRoot(url, publishableKey);
  const classCodes = classes.map((item) => item.code);
  const studentCodes = roster.map((item) => item.studentCode);

  const [classResult, studentResult] = await Promise.all([
    client.from("classes").select(
      "id,code,name,default_monthly_fee,default_session_fee,status",
    ).in("code", classCodes),
    client.from("students").select("id,student_code,full_name,status").in(
      "student_code",
      studentCodes,
    ),
  ]);
  if (classResult.error) throw classResult.error;
  if (studentResult.error) throw studentResult.error;

  const classByCode = new Map<string, any>(
    (classResult.data || []).map((row: any) => [row.code, row]),
  );
  if (classByCode.size !== classes.length) {
    fail(
      `Thiếu lớp: ${
        classCodes.filter((code) => !classByCode.has(code)).join(", ")
      }`,
    );
  }
  for (const definition of classes) {
    const row = classByCode.get(definition.code);
    if (
      row.status !== "ACTIVE" || Number(row.default_monthly_fee) !== 0 ||
      Number(row.default_session_fee) !== definition.sessionFee
    ) {
      fail(`Thông tin lớp ${definition.code} không khớp hoặc không ACTIVE`);
    }
  }

  const studentByCode = new Map<string, any>(
    (studentResult.data || []).map((row: any) => [row.student_code, row]),
  );
  if (studentByCode.size !== roster.length) {
    fail("Danh sách học sinh trên Supabase chưa đủ 47 mã");
  }
  for (const student of roster) {
    const row = studentByCode.get(student.studentCode);
    if (!row || row.full_name !== student.fullName || row.status !== "ACTIVE") {
      fail(`Thông tin học sinh ${student.studentCode} không khớp`);
    }
  }

  const classIds = [...classByCode.values()].map((row) => row.id);
  const studentIds = [...studentByCode.values()].map((row) => row.id);
  const membershipsResult = await client.from("class_memberships").select(
    "id,class_id,student_id,start_date,end_date,status",
  ).in("class_id", classIds).in("student_id", studentIds).eq(
    "status",
    "ACTIVE",
  );
  if (membershipsResult.error) throw membershipsResult.error;
  const membershipByKey = new Map<string, any>();
  for (const membership of membershipsResult.data || []) {
    const key = `${membership.class_id}:${membership.student_id}`;
    if (membershipByKey.has(key)) fail(`Có nhiều membership ACTIVE cho ${key}`);
    membershipByKey.set(key, membership);
  }

  const classMonthResult = await client.from("class_months").select(
    "id,class_id,year,month,status",
  ).in("class_id", classIds).eq("year", TARGET_YEAR).eq("month", TARGET_MONTH);
  if (classMonthResult.error) throw classMonthResult.error;
  const classMonthByClassId = new Map<string, any>();
  for (const row of classMonthResult.data || []) {
    if (classMonthByClassId.has(row.class_id)) {
      fail(`Trùng ClassMonth cho class_id ${row.class_id}`);
    }
    if (row.status !== "DRAFT") {
      fail(`ClassMonth ${row.id} không ở trạng thái DRAFT`);
    }
    classMonthByClassId.set(row.class_id, row);
  }
  for (const definition of classes) {
    const classId = classByCode.get(definition.code).id;
    if (!classMonthByClassId.has(classId)) {
      classMonthByClassId.set(classId, {
        id: crypto.randomUUID(),
        class_id: classId,
        year: TARGET_YEAR,
        month: TARGET_MONTH,
        status: "DRAFT",
        planned: true,
      });
    }
  }

  const expectedSnapshots = new Map<string, any>();
  const expectedScheduleKeys = new Set<string>();
  const classMonthIdByClassCode = new Map<string, string>();
  for (const definition of classes) {
    const classRow = classByCode.get(definition.code);
    const classMonth = classMonthByClassId.get(classRow.id);
    classMonthIdByClassCode.set(definition.code, classMonth.id);
    for (
      const student of roster.filter((item) =>
        item.classCode === definition.code
      )
    ) {
      const studentRow = studentByCode.get(student.studentCode);
      const membership = membershipByKey.get(`${classRow.id}:${studentRow.id}`);
      if (!membership) {
        fail(
          `Thiếu membership ACTIVE cho ${student.studentCode} trong ${definition.code}`,
        );
      }
      expectedSnapshots.set(`${classMonth.id}:${studentRow.id}`, {
        class_month_id: classMonth.id,
        student_id: studentRow.id,
        membership_start_date: membership.start_date,
        membership_end_date: membership.end_date,
        monthly_fee_snapshot: 0,
        session_fee_snapshot: definition.sessionFee,
      });
    }
    for (
      const schedule of scheduleRows.filter((item) =>
        item.classCode === definition.code
      )
    ) {
      expectedScheduleKeys.add(
        `${classMonth.id}:${schedule.dayOfWeek}:${schedule.startTime}:${schedule.endTime}:${schedule.room}`,
      );
    }
  }

  const existingMonthIds = [
    ...(classMonthResult.data || []).map((row: any) => row.id),
  ];
  const [snapshotResult, scheduleResult] = existingMonthIds.length
    ? await Promise.all([
      client.from("class_month_students").select(
        "id,class_month_id,student_id,membership_start_date,membership_end_date,monthly_fee_snapshot,session_fee_snapshot",
      ).in("class_month_id", existingMonthIds),
      client.from("class_month_schedules").select(
        "id,class_month_id,day_of_week,start_time,end_time,room,status",
      ).in("class_month_id", existingMonthIds),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (snapshotResult.error) throw snapshotResult.error;
  if (scheduleResult.error) throw scheduleResult.error;

  const existingSnapshotKeys = new Set<string>();
  for (const row of snapshotResult.data || []) {
    const key = `${row.class_month_id}:${row.student_id}`;
    if (existingSnapshotKeys.has(key)) {
      fail(`Snapshot học sinh bị trùng: ${key}`);
    }
    existingSnapshotKeys.add(key);
    const expected = expectedSnapshots.get(key);
    if (
      !expected ||
      row.membership_start_date !== expected.membership_start_date ||
      row.membership_end_date !== expected.membership_end_date ||
      Number(row.monthly_fee_snapshot) !== 0 ||
      Number(row.session_fee_snapshot) !== expected.session_fee_snapshot
    ) {
      fail(`Snapshot hiện có không khớp: ${key}`);
    }
  }

  const existingScheduleSlots = new Set<string>();
  const existingScheduleKeys = new Set<string>();
  for (const row of scheduleResult.data || []) {
    if (row.status !== "ACTIVE") fail(`Lịch ${row.id} không ACTIVE`);
    const slotKey = scheduleSlotKey(
      row.class_month_id,
      row.day_of_week,
      row.start_time,
      row.end_time,
    );
    if (existingScheduleSlots.has(slotKey)) {
      fail(`Có nhiều lịch trùng slot: ${slotKey}`);
    }
    existingScheduleSlots.add(slotKey);
    const fullKey = `${row.class_month_id}:${row.day_of_week}:${
      normalizeTime(row.start_time)
    }:${normalizeTime(row.end_time)}:${row.room || ""}`;
    if (!expectedScheduleKeys.has(fullKey)) {
      fail(`Lịch hiện có không khớp: ${fullKey}`);
    }
    existingScheduleKeys.add(fullKey);
  }

  const missingMonths = [...classMonthByClassId.values()].filter((row) =>
    row.planned
  ).map((row) => ({
    id: row.id,
    class_id: row.class_id,
    year: TARGET_YEAR,
    month: TARGET_MONTH,
    status: "DRAFT",
  }));
  if (missingMonths.length) {
    const inserted = await client.from("class_months").insert(missingMonths)
      .select("id,class_id,year,month,status");
    if (inserted.error) throw inserted.error;
  }
  const missingSnapshots = [...expectedSnapshots.entries()].filter(([key]) =>
    !existingSnapshotKeys.has(key)
  ).map(([, row]) => row);
  if (missingSnapshots.length) {
    const inserted = await client.from("class_month_students").insert(
      missingSnapshots,
    ).select("id");
    if (inserted.error) throw inserted.error;
  }
  const missingSchedules = scheduleRows.filter((schedule) => {
    const classMonthId = classMonthIdByClassCode.get(schedule.classCode)!;
    const key =
      `${classMonthId}:${schedule.dayOfWeek}:${schedule.startTime}:${schedule.endTime}:${schedule.room}`;
    return !existingScheduleKeys.has(key);
  }).map((schedule) => ({
    class_month_id: classMonthIdByClassCode.get(schedule.classCode),
    day_of_week: schedule.dayOfWeek,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    room: schedule.room,
    status: "ACTIVE",
  }));
  if (missingSchedules.length) {
    const inserted = await client.from("class_month_schedules").insert(
      missingSchedules,
    ).select("id");
    if (inserted.error) throw inserted.error;
  }

  const finalMonths = await client.from("class_months").select(
    "id,class_id,status",
  ).in("class_id", classIds).eq("year", TARGET_YEAR).eq("month", TARGET_MONTH);
  if (finalMonths.error) throw finalMonths.error;
  if (
    finalMonths.data?.length !== 4 ||
    finalMonths.data.some((row: any) => row.status !== "DRAFT")
  ) fail("ClassMonth sau import không hợp lệ");
  const finalMonthIds = finalMonths.data.map((row: any) => row.id);
  const [finalSnapshots, finalSchedules, finalSessions, finalTuition] =
    await Promise.all([
      client.from("class_month_students").select("id").in(
        "class_month_id",
        finalMonthIds,
      ),
      client.from("class_month_schedules").select(
        "id,class_month_id,day_of_week,start_time,end_time,room,status",
      ).in("class_month_id", finalMonthIds),
      client.from("sessions").select("id").in("class_month_id", finalMonthIds),
      client.from("tuition_records").select("id").in(
        "class_month_id",
        finalMonthIds,
      ),
    ]);
  for (
    const result of [
      finalSnapshots,
      finalSchedules,
      finalSessions,
      finalTuition,
    ]
  ) if (result.error) throw result.error;
  if (finalSnapshots.data?.length !== 47) {
    fail(`Snapshot sau import: ${finalSnapshots.data?.length}`);
  }
  if (finalSchedules.data?.length !== 8) {
    fail(`Lịch sau import: ${finalSchedules.data?.length}`);
  }
  if ((finalSessions.data?.length || 0) !== 0) {
    fail("Import tạo session ngoài phạm vi yêu cầu");
  }
  if ((finalTuition.data?.length || 0) !== 0) {
    fail("Import tạo học phí ngoài phạm vi yêu cầu");
  }

  console.log(JSON.stringify({
    success: true,
    target: `${TARGET_YEAR}-${String(TARGET_MONTH).padStart(2, "0")}`,
    class_months: 4,
    class_months_created: missingMonths.length,
    student_snapshots: 47,
    student_snapshots_created: missingSnapshots.length,
    schedules: 8,
    schedules_created: missingSchedules.length,
    status: "DRAFT",
    sessions: 0,
    tuition_records: 0,
  }));
}

if (import.meta.main) {
  try {
    await runImport();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Import lịch thất bại",
    );
    Deno.exitCode = 1;
  }
}
