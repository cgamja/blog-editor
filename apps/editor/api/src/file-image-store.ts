import type { ImageStore } from "./image-store";

export const createFileImageStore: (options: { root: string }) => ImageStore = () => {
  throw new Error("미구현");
};
