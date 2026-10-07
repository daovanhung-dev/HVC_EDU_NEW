import { adminClient, requireCaller } from "../_shared/auth.ts";
import { createAdminExportStudentLoginsHandler } from "./handler.ts";

const QUERY_CHUNK_SIZE = 100;

async function inChunks<T>(userIds: string[], query: (ids: string[]) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; offset < userIds.length; offset += QUERY_CHUNK_SIZE) {
    result.push(...await query(userIds.slice(offset, offset + QUERY_CHUNK_SIZE)));
  }
  return result;
}

const handler = createAdminExportStudentLoginsHandler({
  getCaller: requireCaller,
  hasStudentsViewPermission: async (userId) => {
    const { data, error } = await adminClient().rpc("actor_has_permission", {
      p_user_id: userId,
      p_permission_code: "STUDENTS_VIEW",
    });
    if (error) throw new Error("PERMISSION_LOOKUP_FAILED");
    return Boolean(data);
  },
  getActiveStudents: async (userIds) => {
    const client = adminClient();
    const [profiles, students] = await Promise.all([
      inChunks(userIds, async (ids) => {
        const { data, error } = await client.from("profiles")
          .select("user_id,role,status")
          .in("user_id", ids);
        if (error) throw new Error("STUDENT_PROFILE_LOOKUP_FAILED");
        return data || [];
      }),
      inChunks(userIds, async (ids) => {
        const { data, error } = await client.from("students")
          .select("user_id,student_code,full_name,status")
          .in("user_id", ids);
        if (error) throw new Error("STUDENT_LOOKUP_FAILED");
        return data || [];
      }),
    ]);

    const profilesByUserId = new Map(profiles.map((profile) => [profile.user_id.toLowerCase(), profile]));
    const studentsByUserId = new Map(students.map((student) => [student.user_id.toLowerCase(), student]));
    return userIds.flatMap((userId) => {
      const key = userId.toLowerCase();
      const profile = profilesByUserId.get(key);
      const student = studentsByUserId.get(key);
      if (
        profile?.role !== "STUDENT" || profile.status !== "ACTIVE" ||
        student?.status !== "ACTIVE"
      ) return [];
      return [{ user_id: userId, student_code: student.student_code, full_name: student.full_name }];
    });
  },
  getAuthEmail: async (userId) => {
    const { data, error } = await adminClient().auth.admin.getUserById(userId);
    if (error) {
      if (error.status === 404 || error.code === "user_not_found") return null;
      throw new Error("AUTH_EMAIL_LOOKUP_FAILED");
    }
    return data.user?.email || null;
  },
  writeAudit: async ({ actorUserId, exportedCount }) => {
    const { error } = await adminClient().rpc("write_audit", {
      p_actor_user_id: actorUserId,
      p_action: "STUDENT_LOGIN_EMAIL_EXPORT",
      p_entity_type: "students",
      p_entity_id: null,
      p_old_data: null,
      p_new_data: { exported_count: exportedCount },
      p_reason: null,
    });
    if (error) throw new Error("AUDIT_WRITE_FAILED");
  },
});

Deno.serve(handler);
