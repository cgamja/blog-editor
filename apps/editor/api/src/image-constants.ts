/**
 * 이미지 올리기의 이름 규칙(ADR-021) — 라우트 · 저장소가 같은 값을 본다. 용량 한도는 브라우저 줄이기와 같은 값이라
 * content-schema IMAGE_MAX_BYTES를 쓴다.
 */

export const IMAGE_EXTENSIONS = ["jpg", "png", "webp", "gif"] as const;

/** 내용 SHA-256 16진수 앞 32자(128비트) — design.md 3 */
export const IMAGE_HASH_LENGTH = 32;
