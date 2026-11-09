import { requireCaller } from "../_shared/auth.ts";
import { createMonthTemplateAdditionHandler } from "./handler.ts";
import { createMonthTemplateAdditionStore } from "./store.ts";

let store: ReturnType<typeof createMonthTemplateAdditionStore> | null = null;

Deno.serve(createMonthTemplateAdditionHandler({
  getCaller: requireCaller,
  getStore: () => {
    if (!store) store = createMonthTemplateAdditionStore();
    return store;
  },
}));
