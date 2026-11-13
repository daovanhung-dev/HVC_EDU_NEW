import postgres from "npm:postgres@3.4.7";
import type { Sql } from "npm:postgres@3.4.7";
import type {
  TeacherProfileInput,
  TeacherProfileResult,
} from "./types.ts";

interface CodedError extends Error {
  code?: string;
}

function codedError(code: string): CodedError {
  const error = new Error(code) as CodedError;
  error.code = code;
  return error;
}

function databaseUrl(): string {
  const value = Deno.env.get("SUPABASE_DB_URL");
  if (!value) throw codedError("SUPABASE_DB_URL_MISSING");
  return value;
}

function createDatabase(): Sql {
  return postgres(databaseUrl(), {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

export function createTeacherProfileStore(database: Sql = createDatabase()) {
  return {
    async updateMyProfile(
      userId: string,
      input: TeacherProfileInput,
    ): Promise<TeacherProfileResult> {
      return await database.begin(async (transaction) => {
        const staffRows = await transaction<{ id: string }[]>`
          select id
          from public.staff
          where user_id = ${userId}::uuid
            and staff_type = 'TEACHER'
            and status = 'ACTIVE'
          for update
        `;
        const staff = staffRows[0];
        if (!staff) throw codedError("FORBIDDEN");

        const updatedStaff = await transaction<{ id: string; full_name: string }[]>`
          update public.staff
          set full_name = ${input.full_name},
              phone = ${input.phone},
              email = ${input.email},
              address = ${input.address}
          where id = ${staff.id}::uuid
          returning id, full_name
        `;
        if (!updatedStaff[0]) throw codedError("FORBIDDEN");

        const updatedProfile = await transaction<{ id: string }[]>`
          update public.profiles
          set display_name = ${input.full_name},
              phone = ${input.phone},
              email = ${input.email}
          where user_id = ${userId}::uuid
            and role = 'TEACHER'
            and status = 'ACTIVE'
          returning id
        `;
        if (!updatedProfile[0]) throw codedError("FORBIDDEN");

        return { staff_id: updatedStaff[0].id, full_name: updatedStaff[0].full_name };
      });
    },
  };
}
