import type { PostStore } from "./store";

export function createFilePostStore(options: { root: string; workspaceId: string }): PostStore {
  throw new Error(`not implemented: ${options.root}`);
}
