import { isImageName } from "./image-store";
import type { ImageStore } from "./image-store";

/** 테스트용 저장소 — 파일 구현과 같은 이름 규칙을 지킨다. count는 "거절이 아무것도 쓰지 않았나"를 보려고 둔다 */
export function createMemoryImageStore(): ImageStore & { count(): Promise<number> } {
  const images = new Map<string, Uint8Array>();
  return {
    has(name) {
      return Promise.resolve(images.has(name));
    },
    put(name, bytes) {
      if (!isImageName(name))
        return Promise.reject(new Error(`이미지 이름 모양이 아니다 — ${name}`));
      images.set(name, bytes.slice());
      return Promise.resolve();
    },
    get(name) {
      const found = images.get(name);
      return Promise.resolve(found === undefined ? null : found.slice());
    },
    count() {
      return Promise.resolve(images.size);
    },
  };
}
