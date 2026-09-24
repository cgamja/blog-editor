/**
 * 브라우저에서 이미지를 한도 안으로 굽는다(ADR-021, image-insert design.md 2). 무엇을 할지는
 * image-insert-model.ts가 정하고, 여기는 브라우저 API만 부른다.
 * - HTMLImageElement naturalWidth/Height(load 때 헤더만으로 알 수 있고 EXIF 방향이 반영된다 — CSS image-orientation
 *   기본값 from-image): https://developer.mozilla.org/docs/Web/CSS/image-orientation
 * - createImageBitmap(imageOrientation "from-image" · resizeWidth/Height — 큰 사진을 원본 크기로 풀지 않고
 *   목표 크기로 바로 푼다): https://developer.mozilla.org/docs/Web/API/Window/createImageBitmap
 * - HTMLCanvasElement.toBlob — 지원하지 않는 형식이면 PNG로 떨어진다:
 *   https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement/toBlob
 */
import { IMAGE_MAX_BYTES } from "@blog-editor/content-schema";
import { fitWithin, nextQuality, passesThrough } from "./image-insert-model";
import type { Size } from "./image-insert-model";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";

export type PreparedImage = { ok: true; blob: Blob } | { ok: false; message: string };

const WEBP = "image/webp";
/** WebP 인코딩을 못 하는 브라우저(Safari 일부)의 대체 — 캔버스 출력이라 EXIF가 남지 않는다 */
const JPEG = "image/jpeg";
/** JPEG에는 투명이 없어 투명한 곳이 검게 나온다 — 흰 종이(tokens.json surface)를 먼저 칠한다 */
const JPEG_BACKGROUND = "#ffffff";

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** 방향이 반영된 원본 크기 — 픽셀 전체를 풀지 않고 이미지 요소의 load로 읽는다 */
function naturalSizeOf(file: Blob): Promise<Size | null> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  return new Promise<Size | null>((resolve) => {
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

/** 목표 크기로 바로 푼다. 옵션을 모르는 브라우저면 원본 크기로 풀고 캔버스가 줄인다 */
async function decodeAt(file: Blob, size: Size): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, {
      imageOrientation: "from-image",
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: "high",
    });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

function canvasOf(size: Size, paint: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  paint(context);
  return canvas;
}

/** JPEG로 굽는 캔버스 — 흰 바탕 위에 옮겨 그린다 */
function onWhite(source: HTMLCanvasElement): HTMLCanvasElement | null {
  return canvasOf({ width: source.width, height: source.height }, (context) => {
    context.fillStyle = JPEG_BACKGROUND;
    context.fillRect(0, 0, source.width, source.height);
    context.drawImage(source, 0, 0);
  });
}

/** 품질을 단계대로 낮추며 한도 안으로 굽는다. 마지막 단계에서도 넘으면 이유를 돌려준다 */
async function encodeWithinLimit(canvas: HTMLCanvasElement): Promise<PreparedImage> {
  let target = canvas;
  let type = WEBP;
  for (let quality = nextQuality(null); quality !== null; quality = nextQuality(quality)) {
    const blob = await canvasBlob(target, type, quality);
    if (blob === null) break;
    if (blob.type === type && blob.size <= IMAGE_MAX_BYTES) return { ok: true, blob };
    if (blob.type !== type && type === WEBP) {
      // 요청한 형식을 못 구우면 PNG가 온다 — 무손실이라 크니 흰 바탕 JPEG로 바꿔 같은 품질부터 다시 굽는다
      const white = onWhite(canvas);
      if (white === null) break;
      target = white;
      type = JPEG;
      const jpeg = await canvasBlob(target, type, quality);
      if (jpeg !== null && jpeg.size <= IMAGE_MAX_BYTES) return { ok: true, blob: jpeg };
    }
  }
  return { ok: false, message: IMAGE_INSERT_MESSAGES.tooLarge };
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const natural = await naturalSizeOf(file);
  if (natural === null) return { ok: false, message: IMAGE_INSERT_MESSAGES.cannotDecode };
  if (passesThrough(file, natural)) return { ok: true, blob: file };
  const size = fitWithin(natural);
  const bitmap = await decodeAt(file, size);
  if (bitmap === null) return { ok: false, message: IMAGE_INSERT_MESSAGES.cannotDecode };
  try {
    const canvas = canvasOf(size, (context) =>
      context.drawImage(bitmap, 0, 0, size.width, size.height),
    );
    if (canvas === null) return { ok: false, message: IMAGE_INSERT_MESSAGES.cannotDecode };
    return await encodeWithinLimit(canvas);
  } finally {
    bitmap.close();
  }
}
