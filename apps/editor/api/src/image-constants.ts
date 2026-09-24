/** 이미지 올리기의 한도와 이름 규칙(ADR-021) — 라우트 · 저장소 · 응답 문장이 같은 값을 본다. */

/** plan 3-8 "1MB 이하" — 브라우저가 1600px WebP로 줄인 결과가 들어갈 크기 */
export const MAX_IMAGE_BYTES = 1024 * 1024;

export const IMAGE_EXTENSIONS = ["jpg", "png", "webp", "gif"] as const;

/** 내용 SHA-256 16진수 앞 32자(128비트) — design.md 3 */
export const IMAGE_HASH_LENGTH = 32;
