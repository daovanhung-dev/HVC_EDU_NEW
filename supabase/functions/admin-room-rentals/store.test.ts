import type { Sql, TransactionSql } from "npm:postgres@3.4.7";
import { createRoomRentalsStore } from "./store.ts";

const QA_ADMIN = "f0640000-0000-0000-0000-000000000001";

interface FakeRental {
  id: string;
  staff_id: string;
  room: string;
  starts_at: string;
  ends_at: string;
  status: "BOOKED" | "CANCELLED";
  created_by: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeRental(id: string, status: FakeRental["status"], startsAt: string): FakeRental {
  return {
    id,
    staff_id: "f0640000-0000-0000-0000-000000000101",
    room: `QA-Room-${id.slice(-1)}`,
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + 60 * 60 * 1000).toISOString(),
    status,
    created_by: QA_ADMIN,
    cancelled_at: status === "CANCELLED" ? "2026-11-01T12:00:00.000Z" : null,
    cancelled_by: status === "CANCELLED" ? QA_ADMIN : null,
    created_at: "2026-10-31T12:00:00.000Z",
    updated_at: "2026-11-01T12:00:00.000Z",
  };
}

function fakeDatabase(options: { authorized?: boolean; failAudit?: boolean } = {}) {
  const state = {
    rentals: [
      makeRental("f0640000-0000-0000-0000-000000000201", "BOOKED", "2026-12-01T10:00:00.000Z"),
      makeRental("f0640000-0000-0000-0000-000000000202", "BOOKED", "2026-10-01T10:00:00.000Z"),
      makeRental("f0640000-0000-0000-0000-000000000203", "CANCELLED", "2026-10-02T10:00:00.000Z"),
      makeRental("f0640000-0000-0000-0000-000000000299", "BOOKED", "2026-12-02T10:00:00.000Z"),
    ] as FakeRental[],
    audits: [] as Array<{ action: unknown; entityId: unknown; oldData: unknown; newData: unknown }>,
    committed: 0,
    rolledBack: 0,
  };

  const database = {
    begin: async <T>(callback: (tx: TransactionSql) => Promise<T>): Promise<T> => {
      const rentals = structuredClone(state.rentals);
      const audits: typeof state.audits = [];
      const tx = Object.assign(
        async (parts: TemplateStringsArray, ...values: unknown[]) => {
          const query = parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
          if (query.includes("set_config('request.jwt.claim.sub'")) return [];
          if (query.includes("from public.profiles p")) {
            return [{ allowed: options.authorized !== false }];
          }
          if (query.startsWith("select pg_advisory_xact_lock")) return [];
          if (query.startsWith("select id, staff_id, room, starts_at, ends_at, status, created_by")) {
            const rental = rentals.find((item) => item.id === String(values[0]));
            return rental ? [structuredClone(rental)] : [];
          }
          if (query.startsWith("delete from public.room_rentals")) {
            const index = rentals.findIndex((item) => item.id === String(values[0]));
            if (index < 0) return [];
            const [deleted] = rentals.splice(index, 1);
            return [{ id: deleted.id }];
          }
          if (query.startsWith("select public.write_audit")) {
            if (options.failAudit) throw new Error("QA audit write failure");
            audits.push({
              action: values[1],
              entityId: values[2],
              oldData: values[3],
              newData: values[4],
            });
            return [];
          }
          return [];
        },
        { json: (value: unknown) => value },
      );

      try {
        const result = await callback(tx as unknown as TransactionSql);
        state.rentals = rentals;
        state.audits.push(...audits);
        state.committed += 1;
        return result;
      } catch (error) {
        state.rolledBack += 1;
        throw error;
      }
    },
    end: async () => undefined,
  };

  return { database: database as unknown as Sql, state };
}

Deno.test("permanently deletes one selected booking at any date or status and keeps its audit snapshot", async () => {
  const fake = fakeDatabase();
  const store = createRoomRentalsStore(fake.database);
  const targetIds = [
    "f0640000-0000-0000-0000-000000000201",
    "f0640000-0000-0000-0000-000000000202",
    "f0640000-0000-0000-0000-000000000203",
  ];

  for (const id of targetIds) {
    const previous = fake.state.rentals.find((rental) => rental.id === id)!;
    const result = await store.delete(id, QA_ADMIN);
    assert(result.rental_id === id && result.status === "DELETED", "the selected rental should be reported deleted");
    assert(!fake.state.rentals.some((rental) => rental.id === id), "the selected rental should be removed");
    const audit = fake.state.audits.at(-1);
    assert(audit?.action === "ROOM_RENTAL_DELETE", "the delete should be audited");
    assert(audit?.entityId === id, "the audit should identify the deleted rental");
    assert(JSON.stringify(audit?.oldData) === JSON.stringify(previous), "the audit should retain the full prior row");
    assert(audit?.newData === null, "the audit should record no remaining row state");
  }

  assert(fake.state.rentals.length === 1, "other rental occurrences must remain untouched");
  assert(fake.state.rentals[0].id === "f0640000-0000-0000-0000-000000000299", "only explicitly selected ids may be deleted");
  assert(fake.state.audits.length === targetIds.length, "each deleted occurrence should have one audit row");
});

Deno.test("rejects a missing rental without writing an audit row", async () => {
  const fake = fakeDatabase();
  const store = createRoomRentalsStore(fake.database);
  let errorCode = "";

  try {
    await store.delete("f0640000-0000-0000-0000-000000000404", QA_ADMIN);
  } catch (error) {
    errorCode = (error as { code?: string }).code ?? "";
  }

  assert(errorCode === "ROOM_RENTAL_NOT_FOUND", "a missing rental should return a stable not-found error");
  assert(fake.state.rentals.length === 4 && fake.state.audits.length === 0, "a missing rental must not change data");
  assert(fake.state.rolledBack === 1, "the failed transaction should roll back");
});

Deno.test("rolls back the rental deletion when audit writing fails", async () => {
  const fake = fakeDatabase({ failAudit: true });
  const store = createRoomRentalsStore(fake.database);
  const rentalId = "f0640000-0000-0000-0000-000000000201";
  let failed = false;

  try {
    await store.delete(rentalId, QA_ADMIN);
  } catch {
    failed = true;
  }

  assert(failed, "audit failure should reject the delete operation");
  assert(fake.state.rentals.some((rental) => rental.id === rentalId), "the rental should remain after rollback");
  assert(fake.state.audits.length === 0, "the failed audit should not be committed");
  assert(fake.state.rolledBack === 1 && fake.state.committed === 0, "the database transaction should roll back");
});

Deno.test("checks database authorization before attempting a delete", async () => {
  const fake = fakeDatabase({ authorized: false });
  const store = createRoomRentalsStore(fake.database);
  let errorCode = "";

  try {
    await store.delete("f0640000-0000-0000-0000-000000000201", QA_ADMIN);
  } catch (error) {
    errorCode = (error as { code?: string }).code ?? "";
  }

  assert(errorCode === "FORBIDDEN", "inactive or non-admin database identity should be denied");
  assert(fake.state.rentals.length === 4 && fake.state.audits.length === 0, "denied requests must not write");
  assert(fake.state.rolledBack === 1, "the denied transaction should roll back");
});
