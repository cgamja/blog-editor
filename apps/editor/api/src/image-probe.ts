export type ImageFormat = "jpeg" | "png" | "webp" | "gif";

export interface ImageProbe {
  format: ImageFormat;
  width: number;
  height: number;
}

export const probeImage: (bytes: Uint8Array) => ImageProbe | null = () => {
  throw new Error("미구현");
};
