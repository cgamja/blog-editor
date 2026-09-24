/**
 * 이미지 저장소 계약(ADR-021). 이름은 `<내용 해시 32자>.<확장자>`이고 호출하는 쪽이 짓는다 —
 * 같은 이름은 같은 내용이라 덮어써도 결과가 같다. 구현은 이름 모양을 다시 확인해 경로 밖으로 나갈 길을 막는다.
 */
export interface ImageStore {
  has(name: string): Promise<boolean>;
  put(name: string, bytes: Uint8Array): Promise<void>;
  get(name: string): Promise<Uint8Array | null>;
}

export const IMAGE_EXTENSIONS = ["jpg", "png", "webp", "gif"] as const;
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

/** 내용 SHA-256 16진수 앞 32자(128비트) — design.md 3 */
export const IMAGE_HASH_LENGTH = 32;

const IMAGE_NAME_PATTERN = new RegExp(
  `^[0-9a-f]{${IMAGE_HASH_LENGTH}}\\.(?:${IMAGE_EXTENSIONS.join("|")})$`,
);

export function isImageName(name: string): boolean {
  return IMAGE_NAME_PATTERN.test(name);
}
