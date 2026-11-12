import { requireCaller } from "../_shared/auth.ts";
import { createClassMembershipEnrollmentStore } from "../_shared/class-membership-enrollment.ts";
import { createClassMembershipHandler } from "./handler.ts";

let store: ReturnType<typeof createClassMembershipEnrollmentStore> | null =
  null;

Deno.serve(createClassMembershipHandler({
  getCaller: requireCaller,
  getStore: () => {
    if (!store) store = createClassMembershipEnrollmentStore();
    return store;
  },
}));
