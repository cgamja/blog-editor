import { createMemoryPostStore } from "./memory-store";
import { describePostStoreContract } from "./post-store.contract";

describePostStoreContract("MemoryPostStore", async () => createMemoryPostStore());
