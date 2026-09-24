import type { ImageStore } from "./image-store";

export function createMemoryImageStore(): ImageStore & { count(): Promise<number> } {
  throw new Error("미구현");
}
