import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_LOOKUP_CONCURRENCY = 12;

export interface StudentLoginExportCaller {
  user: { id: string };
  profile: { role: string };
}

export interface ActiveStudentForLoginExport {
  user_id: string;
  student_code: string;
  full_name: string;
}

export interface StudentLoginExportDependencies {
  getCaller: (request: Request) => Promise<StudentLoginExportCaller>;
  hasStudentsViewPermission: (userId: string) => Promise<boolean>;
  getActiveStudents: (userIds: string[]) => Promise<ActiveStudentForLoginExport[]>;
  getAuthEmail: (userId: string) => Promise<string | null>;
  writeAudit: (input: { actorUserId: string; exportedCount: number }) => Promise<void>;
}

interface StudentLoginExportRow {
  student_code: string;
  full_name: string;
  login_email: string | null;
}

function validUserIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const userIds = (body as { user_ids?: unknown }).user_ids;
  if (!Array.isArray(userIds) || userIds.length < 1) return null;
  if (!userIds.every((userId) => typeof userId === "string" && UUID_PATTERN.test(userId))) return null;
  const normalized = userIds.map((userId) => userId.toLowerCase());
  if (new Set(normalized).size !== normalized.length) return null;
  return userIds as string[];
}

async function resolveLoginEmails(
  students: ActiveStudentForLoginExport[],
  getAuthEmail: StudentLoginExportDependencies["getAuthEmail"],
): Promise<Array<string | null>> {
  const emails = new Array<string | null>(students.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(EMAIL_LOOKUP_CONCURRENCY, students.length) },
    async () => {
      while (nextIndex < students.length) {
        const index = nextIndex++;
        emails[index] = await getAuthEmail(students[index].user_id);
      }
    },
  );
  await Promise.all(workers);
  return emails;
}

export function createAdminExportStudentLoginsHandler(
  dependencies: StudentLoginExportDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const options = handleOptions(request);
    if (options) return options;
    if (request.method !== "POST") {
      return fail("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ yêu cầu POST.", 405);
    }

    try {
      const caller = await dependencies.getCaller(request);
      if (
        caller.profile.role !== "ROOT_ADMIN" &&
        !await dependencies.hasStudentsViewPermission(caller.user.id)
      ) {
        return fail("FORBIDDEN", "Bạn không có quyền xuất tài khoản học sinh.", 403);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return fail("INVALID_INPUT", "Danh sách học sinh không hợp lệ.");
      }
      const userIds = validUserIds(body);
      if (!userIds) {
        return fail("INVALID_INPUT", "Danh sách học sinh phải có mã hợp lệ và không trùng lặp.");
      }

      const activeStudents = await dependencies.getActiveStudents(userIds);
      const activeByUserId = new Map(
        activeStudents.map((student) => [student.user_id.toLowerCase(), student]),
      );
      const eligibleStudents = userIds
        .map((userId) => activeByUserId.get(userId.toLowerCase()))
        .filter((student): student is ActiveStudentForLoginExport => Boolean(student));
      const skippedCount = userIds.length - eligibleStudents.length;

      if (!eligibleStudents.length) {
        return ok({ rows: [] as StudentLoginExportRow[], missing_email_count: 0, skipped_count: skippedCount });
      }

      const loginEmails = await resolveLoginEmails(eligibleStudents, dependencies.getAuthEmail);
      const rows = eligibleStudents.map((student, index) => ({
        student_code: student.student_code,
        full_name: student.full_name,
        login_email: loginEmails[index] || null,
      }));

      try {
        await dependencies.writeAudit({ actorUserId: caller.user.id, exportedCount: rows.length });
      } catch {
        return fail("AUDIT_WRITE_FAILED", "Không thể ghi nhật ký xuất dữ liệu.", 500);
      }

      return ok({
        rows,
        missing_email_count: rows.filter((row) => !row.login_email).length,
        skipped_count: skippedCount,
      });
    } catch (error) {
      const safeAuthErrors = new Set([
        "UNAUTHENTICATED",
        "ACCOUNT_INACTIVE",
        "PASSWORD_CHANGE_REQUIRED",
        "PARENT_LOGIN_DISABLED",
      ]);
      if (error instanceof Error && safeAuthErrors.has(error.message)) return fromError(error);
      return fail("EXPORT_FAILED", "Không thể xuất danh sách tài khoản học sinh.", 500);
    }
  };
}
