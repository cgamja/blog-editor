/** 이미지 올리기의 한도와 이름 규칙(ADR-021) — 라우트 · 저장소 · 응답 문장이 같은 값을 본다. */
import { IMAGE_MAX_BYTES } from "@blog-editor/content-schema";

/** plan 3-8 "1MB 이하" — 브라우저가 줄일 때 맞추는 한도와 같은 값이라 content-schema 한 곳에서 가져온다 */
export const MAX_IMAGE_BYTES = IMAGE_MAX_BYTES;

export const IMAGE_EXTENSIONS = ["jpg", "png", "webp", "gif"] as const;

/** 내용 SHA-256 16진수 앞 32자(128비트) — design.md 3 */
export const IMAGE_HASH_LENGTH = 32;
