import type { Command } from "@tiptap/pm/state";
import type { InsertableBlockKind } from "./drag-block.constants";

export function applySlashItem(kind: InsertableBlockKind): Command {
  return () => {
    throw new Error(`미구현: ${kind}`);
  };
}
