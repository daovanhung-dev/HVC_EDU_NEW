import { requireCaller } from "../_shared/auth.ts";
import { createRoomRentalsHandler } from "./handler.ts";
import { createRoomRentalsStore } from "./store.ts";

let store: ReturnType<typeof createRoomRentalsStore> | null = null;

Deno.serve(createRoomRentalsHandler({
  getCaller: requireCaller,
  getStore: () => {
    if (!store) store = createRoomRentalsStore();
    return store;
  },
}));
