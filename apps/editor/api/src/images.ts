/**
 * 이미지 올리기 · 받기(ADR-021, spec image-upload-api). 서버는 줄이지 않는다 — 헤더로 형식 · 크기를 검사하고
 * 내용 해시 이름으로 저장만 한다. 줄이기는 브라우저가 한다(plan 3-8).
 */
import { createHash } from "node:crypto";
import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { NATURAL_SIZE_RANGE } from "@blog-editor/content-schema";
import { probeImage } from "./image-probe";
import type { ImageFormat } from "./image-probe";
import { IMAGE_HASH_LENGTH, isImageName } from "./image-store";
import type { ImageExtension, ImageStore } from "./image-store";
import { IMAGE_FORMAT_MESSAGE, IMAGE_TOO_LARGE_MESSAGE, IMAGE_TOO_WIDE_MESSAGE } from "./messages";

/** plan 3-8 "1MB 이하" — 브라우저가 1600px WebP로 줄인 결과가 들어갈 크기 */
export const MAX_IMAGE_BYTES = 1024 * 1024;

const UPLOAD_PATH = "/api/images";
const PUBLIC_PREFIX = "/images/";
/** 내용 해시 이름이라 같은 주소의 내용은 바뀌지 않는다 */
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const EXTENSION_OF: Record<ImageFormat, ImageExtension> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

const CONTENT_TYPE_OF: Record<ImageExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, IMAGE_HASH_LENGTH);
}

function extensionOfName(name: string): ImageExtension {
  return name.slice(name.lastIndexOf(".") + 1) as ImageExtension;
}

export function registerImageRoutes(app: Hono, images: ImageStore): void {
  app.post(
    UPLOAD_PATH,
    bodyLimit({
      maxSize: MAX_IMAGE_BYTES,
      onError: (c) => c.json({ message: IMAGE_TOO_LARGE_MESSAGE }, 413),
    }),
    async (c) => {
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      const probe = probeImage(bytes);
      if (probe === null) return c.json({ message: IMAGE_FORMAT_MESSAGE }, 415);
      if (Math.max(probe.width, probe.height) > NATURAL_SIZE_RANGE.max) {
        return c.json({ message: IMAGE_TOO_WIDE_MESSAGE }, 422);
      }

      const name = `${contentHash(bytes)}.${EXTENSION_OF[probe.format]}`;
      const existed = await images.has(name);
      if (!existed) await images.put(name, bytes);
      return c.json(
        {
          path: `${PUBLIC_PREFIX}${name}`,
          naturalWidth: probe.width,
          naturalHeight: probe.height,
        },
        existed ? 200 : 201,
      );
    },
  );

  // 로컬 개발용 — 배포에서는 CloudFront가 같은 경로를 준다(plan 3-8). 모양이 아닌 이름도 404라 규칙을 드러내지 않는다
  app.get(`${PUBLIC_PREFIX}:name`, async (c) => {
    const name = c.req.param("name");
    if (!isImageName(name)) return c.notFound();
    const bytes = await images.get(name);
    if (bytes === null) return c.notFound();
    // Hono body는 ArrayBuffer 기반 뷰만 받는다 — 저장소가 돌려준 뷰를 그 모양으로 한 번 복사한다
    return c.body(new Uint8Array(bytes), 200, {
      "Content-Type": CONTENT_TYPE_OF[extensionOfName(name)],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": IMMUTABLE_CACHE_CONTROL,
    });
  });
}
