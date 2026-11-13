import { requireCaller } from "../_shared/auth.ts";
import { createTeacherProfileUpdateHandler } from "./handler.ts";
import { createTeacherProfileStore } from "./store.ts";

let store: ReturnType<typeof createTeacherProfileStore> | null = null;

Deno.serve(createTeacherProfileUpdateHandler({
  getCaller: requireCaller,
  getStore: () => {
    if (!store) store = createTeacherProfileStore();
    return store;
  },
}));
