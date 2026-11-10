import { requireCaller } from "../_shared/auth.ts";
import { createSessionAttendanceFinalizeHandler } from "./handler.ts";
import { createSessionAttendanceFinalizeStore } from "./store.ts";

let store: ReturnType<typeof createSessionAttendanceFinalizeStore> | null =
  null;

Deno.serve(createSessionAttendanceFinalizeHandler({
  getCaller: requireCaller,
  getStore: () => {
    if (!store) store = createSessionAttendanceFinalizeStore();
    return store;
  },
}));
