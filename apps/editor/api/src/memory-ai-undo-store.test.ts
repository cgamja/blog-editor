import { describeAiUndoStoreContract } from "./ai-undo-store.contract";
import { createMemoryAiUndoStore } from "./memory-ai-undo-store";

describeAiUndoStoreContract("MemoryAiUndoStore", async () => createMemoryAiUndoStore());
