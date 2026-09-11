import {
  adminClient,
  canManageRole,
  requireCaller,
  syntheticEmail,
  temporaryPassword,
} from "../_shared/auth.ts";
import { handleOptions } from "../_shared/cors.ts";
import { appError, fail, fromError, ok, traceId } from "../_shared/response.ts";

interface CreateUserBody {
  role?: string;
  username?: string;
  password?: string;
  email?: string;
  phone?: string;
  display_name?: string;
  force_password_change?: boolean;
  student?: Record<string, unknown>;
  staff?: Record<string, unknown>;
}

type AdminClient = ReturnType<typeof adminClient>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function valueFrom(
  record: Record<string, unknown> | undefined,
  key: string,
): string {
  return text(record?.[key]);
}

async function ensureAvailable(
  admin: AdminClient,
  table: "profiles" | "staff" | "students",
  column: string,
  value: string,
  duplicateCode: string,
) {
  if (!value) return;
  const query = admin.from(table).select("id").eq(column, value).maybeSingle();
  const result = column === "username"
    ? await admin.from(table).select("id").ilike(column, value).maybeSingle()
    : await query;
  if (result.error) throw result.error;
  if (result.data) throw appError(duplicateCode);
}

async function rollbackCreatedAccount(admin: AdminClient, userId: string) {
  const failures: string[] = [];
  const removals = [
    ["staff", () => admin.from("staff").delete().eq("user_id", userId)],
    ["students", () => admin.from("students").delete().eq("user_id", userId)],
    ["profiles", () => admin.from("profiles").delete().eq("user_id", userId)],
  ] as const;

  for (const [name, remove] of removals) {
    const result = await remove();
    if (result.error) failures.push(`${name}: ${result.error.message}`);
  }
  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error) failures.push(`auth: ${deleted.error.message}`);
  if (failures.length) {
    throw appError("ACCOUNT_ROLLBACK_FAILED", failures.join("; "));
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const requestTraceId = traceId();
  let stage = "caller.authenticate";
  let role = "";
  let admin: AdminClient | null = null;
  let createdUserId: string | null = null;
  try {
    const caller = await requireCaller(req);
    stage = "request.parse";
    const rawBody = await req.json();
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      throw appError("INVALID_INPUT");
    }
    const body = rawBody as CreateUserBody;
    role = text(body.role);
    if (
      !["ADMIN", "TEACHER", "ASSISTANT", "STUDENT"].includes(role) ||
      !canManageRole(caller, role)
    ) return fail("FORBIDDEN", "Bạn không có quyền tạo tài khoản này.", 403);
    const forcePasswordChange = body.force_password_change === true &&
      caller.profile.role === "ROOT_ADMIN";
    admin = adminClient();
    if (caller.profile.role !== "ROOT_ADMIN") {
      const permission = role === "STUDENT"
        ? "STUDENTS_MANAGE"
        : "STAFF_MANAGE";
      const allowed = await admin.rpc("actor_has_permission", {
        p_user_id: caller.user.id,
        p_permission_code: permission,
      });
      if (allowed.error || !allowed.data) {
        return fail(
          "FORBIDDEN",
          "Tài khoản chưa được cấp nhóm quyền phù hợp.",
          403,
        );
      }
    }

    const displayName = text(body.display_name) ||
      valueFrom(body.student, "full_name") ||
      valueFrom(body.staff, "full_name");
    if (!displayName) throw appError("INVALID_INPUT");
    const phone = text(body.phone);
    const emailInput = text(body.email);
    if (emailInput && !/^\S+@\S+\.\S+$/.test(emailInput)) {
      throw appError("INVALID_EMAIL");
    }

    const staffName = valueFrom(body.staff, "full_name") || displayName;
    const staffCode = valueFrom(body.staff, "staff_code");
    const studentName = valueFrom(body.student, "full_name") || displayName;
    const studentCodeInput = valueFrom(body.student, "student_code");
    if (role !== "ADMIN" && !staffName && role !== "STUDENT") {
      throw appError("INVALID_INPUT");
    }

    let username = text(body.username);
    if (!username) {
      const slug = displayName.toLowerCase().normalize("NFD").replace(
        /[\u0300-\u036f]/g,
        "",
      ).replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "").slice(0, 24) || "user";
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `${slug}${Math.floor(100 + Math.random() * 900)}`;
        const exists = await admin.from("profiles").select("id").ilike(
          "username",
          candidate,
        ).maybeSingle();
        if (exists.error) throw exists.error;
        if (!exists.data) {
          username = candidate;
          break;
        }
      }
    }
    if (!username) throw new Error("USERNAME_GENERATION_FAILED");

    await ensureAvailable(
      admin,
      "profiles",
      "username",
      username,
      "USERNAME_ALREADY_EXISTS",
    );
    const email = emailInput || syntheticEmail(username);
    await ensureAvailable(
      admin,
      "profiles",
      "email",
      email,
      "EMAIL_ALREADY_EXISTS",
    );
    await ensureAvailable(
      admin,
      "profiles",
      "phone",
      phone,
      "PHONE_ALREADY_EXISTS",
    );
    if (role !== "ADMIN" && role !== "STUDENT") {
      await ensureAvailable(
        admin,
        "staff",
        "staff_code",
        staffCode,
        "STAFF_CODE_ALREADY_EXISTS",
      );
    }
    if (role === "STUDENT" && studentCodeInput) {
      await ensureAvailable(
        admin,
        "students",
        "student_code",
        studentCodeInput,
        "STUDENT_CODE_ALREADY_EXISTS",
      );
    }

    const password = text(body.password) || temporaryPassword();
    stage = "auth.create";
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error || new Error("AUTH_CREATE_FAILED");
    }
    createdUserId = created.data.user.id;

    stage = "profiles.insert";
    const profile = await admin.from("profiles").insert({
      user_id: createdUserId,
      role,
      username,
      display_name: displayName,
      email,
      phone: phone || null,
      created_by: caller.profile.id,
      force_password_change: forcePasswordChange,
    }).select("id,user_id,role,username,display_name,force_password_change")
      .single();
    if (profile.error || !profile.data) {
      throw profile.error || new Error("PROFILE_CREATE_FAILED");
    }
    if (role === "STUDENT") {
      stage = "students.code";
      let studentCode = studentCodeInput || undefined;
      if (!studentCode) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const candidate = `HS${
            String(Math.floor(100000 + Math.random() * 900000))
          }`;
          const exists = await admin.from("students").select("id").eq(
            "student_code",
            candidate,
          ).maybeSingle();
          if (exists.error) throw exists.error;
          if (!exists.data) {
            studentCode = candidate;
            break;
          }
        }
      }
      if (!studentCode) throw new Error("STUDENT_CODE_GENERATION_FAILED");
      stage = "students.insert";
      const student = await admin.from("students").insert({
        user_id: createdUserId,
        student_code: studentCode,
        full_name: studentName,
        parent_name: valueFrom(body.student, "parent_name") || null,
        parent_phone: valueFrom(body.student, "parent_phone") || null,
        email,
        phone: phone || null,
        created_by: caller.user.id,
      }).select("id,student_code").single();
      if (student.error || !student.data) {
        throw student.error || new Error("STUDENT_CREATE_FAILED");
      }
    } else if (role !== "ADMIN") {
      stage = "staff.insert";
      const staff = await admin.from("staff").insert({
        user_id: createdUserId,
        staff_type: role,
        staff_code: staffCode || null,
        full_name: staffName,
        email,
        phone: phone || null,
        created_by: caller.user.id,
      }).select("id,staff_code").single();
      if (staff.error || !staff.data) {
        throw staff.error || new Error("STAFF_CREATE_FAILED");
      }
    }
    stage = "audit.write";
    const audit = await admin.rpc("write_audit", {
      p_actor_user_id: caller.user.id,
      p_action: "ACCOUNT_CREATE",
      p_entity_type: "profiles",
      p_entity_id: profile.data.id,
      p_new_data: { role, username },
    });
    if (audit.error) throw audit.error;
    return ok(
      { profile: profile.data, temporary_password: password },
      requestTraceId,
    );
  } catch (error) {
    if (createdUserId && admin) {
      try {
        await rollbackCreatedAccount(admin, createdUserId);
      } catch (rollbackError) {
        console.error(JSON.stringify({
          event: "edge_function_rollback_error",
          trace_id: requestTraceId,
          stage,
          role,
          user_id: createdUserId,
          message: rollbackError instanceof Error
            ? rollbackError.message
            : "rollback failed",
        }));
        return fromError(rollbackError, requestTraceId, {
          stage: "rollback",
          role,
        });
      }
    }
    return fromError(error, requestTraceId, { stage, role });
  }
});
