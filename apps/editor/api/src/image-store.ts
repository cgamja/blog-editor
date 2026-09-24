import { IMAGE_EXTENSIONS, IMAGE_HASH_LENGTH } from "./image-constants";

/**
 * 이미지 저장소 계약(ADR-021). 이름은 `<내용 해시 32자>.<확장자>`이고 호출하는 쪽이 짓는다 —
 * 같은 이름은 같은 내용이라 덮어써도 결과가 같다. 구현은 이름 모양을 다시 확인해 경로 밖으로 나갈 길을 막는다.
 * 저장한 이미지를 직접 내주는 구현(S3 + CloudFront 등)은 응답에 `contentType` · `X-Content-Type-Options: nosniff` ·
 * `Content-Security-Policy: default-src 'none'; sandbox`를 붙여야 한다 — 로컬 `GET /images/*`와 같은 방어.
 */
export interface ImageStore {
  has(name: string): Promise<boolean>;
  put(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(name: string): Promise<Uint8Array | null>;
}

const IMAGE_NAME_PATTERN = new RegExp(
  `^[0-9a-f]{${IMAGE_HASH_LENGTH}}\\.(?:${IMAGE_EXTENSIONS.join("|")})$`,
);

export function isImageName(name: string): boolean {
  return IMAGE_NAME_PATTERN.test(name);
}
