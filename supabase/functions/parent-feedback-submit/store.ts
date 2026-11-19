import postgres from "npm:postgres@3.4.7";
import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import {
  parentFeedbackRateLimit,
  type ParentFeedbackStore,
  type ParentFeedbackSubmission,
} from "./handler.ts";

interface CountRow {
  submission_count: number;
}

function databaseUrl(): string {
  const value = Deno.env.get("SUPABASE_DB_URL");
  if (!value) throw Object.assign(new Error("SUPABASE_DB_URL_MISSING"), { code: "SUPABASE_DB_URL_MISSING" });
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

async function submitInTransaction(
  tx: TransactionSql,
  input: ParentFeedbackSubmission,
  networkKeyHmac: string,
): Promise<boolean> {
  await tx.unsafe(
    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [networkKeyHmac],
  );

  const rows = await tx.unsafe<CountRow[]>(
    "select count(*)::integer as submission_count from private.parent_feedback_rate_limit_events where network_key_hmac = $1 and created_at > now() - ($2::integer * interval '1 minute')",
    [networkKeyHmac, parentFeedbackRateLimit.windowMinutes],
  );
  if ((rows[0]?.submission_count || 0) >= parentFeedbackRateLimit.submissions) return false;

  await tx.unsafe(
    "insert into private.parent_feedback_rate_limit_events (network_key_hmac) values ($1)",
    [networkKeyHmac],
  );
  await tx.unsafe(
    "insert into public.parent_feedback (parent_name, student_name, class_name, feedback) values ($1, $2, $3, $4)",
    [input.parent_name, input.student_name, input.class_name, input.feedback],
  );
  return true;
}

export function createParentFeedbackStore(connection: Sql = createDatabase()): ParentFeedbackStore {
  return {
    async submit(input, networkKeyHmac) {
      return connection.begin((tx) => submitInTransaction(tx, input, networkKeyHmac));
    },
  };
}
