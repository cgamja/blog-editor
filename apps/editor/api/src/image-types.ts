import type { IMAGE_EXTENSIONS } from "./image-constants";

export type ImageFormat = "jpeg" | "png" | "webp" | "gif";

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

export interface ImageProbe {
  format: ImageFormat;
  width: number;
  height: number;
  /** JPEG EXIF Orientation(1~8) — 태그가 있을 때만 */
  orientation?: number;
}
