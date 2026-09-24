/**
 * 브라우저에서 이미지를 한도 안으로 굽는다(ADR-021, image-insert design.md 2). 무엇을 할지는
 * image-insert-model.ts가 정하고, 여기는 브라우저 API만 부른다.
 * - createImageBitmap(imageOrientation "from-image"로 EXIF 방향을 픽셀에 굽는다):
 *   https://developer.mozilla.org/docs/Web/API/Window/createImageBitmap
 * - HTMLCanvasElement.toBlob — 지원하지 않는 형식이면 PNG로 떨어진다:
 *   https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement/toBlob
 */
import { IMAGE_MAX_BYTES } from "@blog-editor/content-schema";
import { fitWithin, nextQuality, passesThrough } from "./image-insert-model";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";

export type PreparedImage = { ok: true; blob: Blob } | { ok: false; message: string };

const WEBP = "image/webp";
/** WebP 인코딩을 못 하는 브라우저(Safari 일부)의 대체 — 캔버스 출력이라 EXIF가 남지 않는다 */
const JPEG = "image/jpeg";

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

/** 품질을 단계대로 낮추며 한도 안으로 굽는다. 마지막 단계에서도 넘으면 이유를 돌려준다 */
async function encodeWithinLimit(canvas: HTMLCanvasElement): Promise<PreparedImage> {
  let type = WEBP;
  for (let quality = nextQuality(null); quality !== null; quality = nextQuality(quality)) {
    const blob = await canvasBlob(canvas, type, quality);
    if (blob === null) break;
    if (blob.type !== type) {
      // 요청한 형식을 못 구우면 PNG가 온다 — 무손실이라 크니 JPEG로 바꿔 같은 품질부터 다시 굽는다
      type = JPEG;
      const jpeg = await canvasBlob(canvas, type, quality);
      if (jpeg !== null && jpeg.size <= IMAGE_MAX_BYTES) return { ok: true, blob: jpeg };
      continue;
    }
    if (blob.size <= IMAGE_MAX_BYTES) return { ok: true, blob };
  }
  return { ok: false, message: IMAGE_INSERT_MESSAGES.tooLarge };
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await decode(file);
  if (bitmap === null) return { ok: false, message: IMAGE_INSERT_MESSAGES.cannotDecode };
  try {
    const natural = { width: bitmap.width, height: bitmap.height };
    if (passesThrough(file, natural)) return { ok: true, blob: file };
    const size = fitWithin(natural);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (context === null) return { ok: false, message: IMAGE_INSERT_MESSAGES.cannotDecode };
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return await encodeWithinLimit(canvas);
  } finally {
    bitmap.close();
  }
}
