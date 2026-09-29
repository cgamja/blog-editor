import { createMemorySiteRebuildStore } from "./memory-site-rebuild-store";
import { describeSiteRebuildStoreContract } from "./site-rebuild-store.contract";

describeSiteRebuildStoreContract("MemorySiteRebuildStore", async () =>
  createMemorySiteRebuildStore(),
);
