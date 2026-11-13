import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import { createTeacherProfileStore } from "./store.ts";
import type { TeacherProfileInput } from "./types.ts";

const TEACHER_USER_ID = "f0650000-0000-0000-0000-000000000001";
const STAFF_ID = "f0650000-0000-0000-0000-000000000002";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fakeDatabase(profileExists = true) {
  const state = { statements: [] as string[], bindings: [] as unknown[][], committed: 0, rolledBack: 0 };
  const transaction = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
    state.statements.push(query);
    state.bindings.push(values);
    if (query.startsWith("select id from public.staff")) return [{ id: STAFF_ID }];
    if (query.startsWith("update public.staff")) {
      return [{ id: STAFF_ID, full_name: String(values[0]) }];
    }
    if (query.startsWith("update public.profiles")) {
      return profileExists ? [{ id: "qa-profile-1" }] : [];
    }
    throw new Error(`Unexpected QA SQL: ${query}`);
  }) as unknown as TransactionSql;
  const database = {
    begin: async <T>(callback: (tx: TransactionSql) => Promise<T>) => {
      try {
        const result = await callback(transaction);
        state.committed += 1;
        return result;
      } catch (error) {
        state.rolledBack += 1;
        throw error;
      }
    },
  } as unknown as Sql;
  return { database, state };
}

const input: TeacherProfileInput = {
  full_name: "QA Teacher",
  phone: "0900000000",
  email: null,
  address: "QA Address",
};

Deno.test("updates staff and profile in one transaction using the caller ID", async () => {
  const { database, state } = fakeDatabase();
  const result = await createTeacherProfileStore(database).updateMyProfile(TEACHER_USER_ID, input);
  assert(result.staff_id === STAFF_ID, "staff ID should be returned");
  assert(result.full_name === input.full_name, "normalized name should be returned");
  assert(state.committed === 1, "both table updates should commit together");
  assert(state.rolledBack === 0, "successful update should not roll back");
  assert(state.statements.some((query) => query.startsWith("update public.staff")), "staff row should be updated");
  assert(state.statements.some((query) => query.startsWith("update public.profiles")), "profile row should be updated");
  assert(state.statements[0].includes("user_id ="), "staff lookup should be scoped to a user ID");
  assert(state.bindings[0][0] === TEACHER_USER_ID, "staff lookup should use the authenticated user ID");
  assert(state.statements[0].includes("staff_type = 'teacher'") && state.statements[0].includes("status = 'active'"), "only an active teacher record should be updated");
});

Deno.test("rolls back the staff update when the active teacher profile is missing", async () => {
  const { database, state } = fakeDatabase(false);
  let rejected = false;
  try {
    await createTeacherProfileStore(database).updateMyProfile(TEACHER_USER_ID, input);
  } catch {
    rejected = true;
  }
  assert(rejected, "missing auth profile should reject the update");
  assert(state.committed === 0, "partial updates must not commit");
  assert(state.rolledBack === 1, "transaction should roll back");
});
