/**
 * 이미지 넣기의 순수 계산(DOM 없음) — spec: editor-image-insert, image-insert design.md 2.
 * 굽기 · 올리기(브라우저 API)는 encode-image.ts · upload-image.ts가 하고, 여기는 무엇을 할지만 정한다.
 */
import { IMAGE_MAX_BYTES, NATURAL_SIZE_RANGE, imagePathSchema } from "@blog-editor/content-schema";
import type { UploadedImageAttrs } from "@blog-editor/editor-core";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";

export interface Size {
  width: number;
  height: number;
}

/** 파일에서 판정에 쓰는 부분만 — node 테스트가 File 없이 부를 수 있게 */
export interface FileLike {
  type: string;
  size: number;
}

/** WebP 품질을 이 순서로 낮춰 다시 굽는다 — 마지막에도 한도를 넘으면 포기하고 이유를 보인다 */
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55] as const;

/** 서버가 받는 형식이 아니어도 브라우저가 풀 수 있으면 다시 구워 올린다(HEIC 등). SVG는 풀어도 막는다 */
const REFUSED_TYPES: ReadonlySet<string> = new Set(["image/svg+xml"]);

/** API가 사람에게 보일 문장을 `message`로 주는 상태 — 그대로 보인다 */
const API_MESSAGE_STATUSES: ReadonlySet<number> = new Set([413, 415, 422]);
const UNAUTHORIZED = 401;

/** 긴 변을 1600px 안으로, 비율을 지켜 줄인다. 이미 안이면 그대로 */
export function fitWithin({ width, height }: Size): Size {
  const longest = Math.max(width, height);
  if (longest <= NATURAL_SIZE_RANGE.max) return { width, height };
  const scale = NATURAL_SIZE_RANGE.max / longest;
  return {
    width: Math.max(NATURAL_SIZE_RANGE.min, Math.round(width * scale)),
    height: Math.max(NATURAL_SIZE_RANGE.min, Math.round(height * scale)),
  };
}

/** 처음(null)이면 첫 품질, 아니면 다음 단계. 더 낮출 단계가 없으면 null */
export function nextQuality(previous: number | null): number | null {
  if (previous === null) return QUALITY_STEPS[0];
  const index = QUALITY_STEPS.findIndex((quality) => quality === previous);
  return index === -1 ? null : (QUALITY_STEPS[index + 1] ?? null);
}

/** 한도 안의 GIF는 원본 그대로 올린다 — 캔버스는 첫 프레임만 구워 움직임이 사라진다(ADR-021) */
export function passesThrough(file: FileLike, size: Size): boolean {
  return (
    file.type === "image/gif" &&
    file.size <= IMAGE_MAX_BYTES &&
    Math.max(size.width, size.height) <= NATURAL_SIZE_RANGE.max
  );
}

export function imageFilesOf<T extends FileLike>(files: readonly T[]): T[] {
  return files.filter((file) => file.type.startsWith("image/") && !REFUSED_TYPES.has(file.type));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** 올리기 응답 `{ path, naturalWidth, naturalHeight }` → image attrs(대체 텍스트는 비워 둔다). 모양이 틀리면 null */
export function imageAttrsFrom(body: unknown): UploadedImageAttrs | null {
  if (!isRecord(body)) return null;
  const { path, naturalWidth, naturalHeight } = body;
  if (!imagePathSchema.safeParse(path).success) return null;
  if (typeof naturalWidth !== "number" || typeof naturalHeight !== "number") return null;
  return { src: path as string, alt: "", naturalWidth, naturalHeight };
}

/** 상태 코드 → 보일 문장. 413 · 415 · 422는 API 문장 그대로, 401은 로그인 안내 */
export function uploadErrorMessage(status: number, body: unknown): string {
  if (status === UNAUTHORIZED) return IMAGE_INSERT_MESSAGES.loginRequired;
  const message = isRecord(body) ? body.message : undefined;
  if (API_MESSAGE_STATUSES.has(status) && typeof message === "string") return message;
  return IMAGE_INSERT_MESSAGES.uploadFailed;
}
