import type { Hono } from "hono";
import type { PostStore } from "./store";

export interface AppOptions {
  store: PostStore;
  /** 워크스페이스 설정의 카테고리 목록 — 저장 검증과 공개 응답이 같은 것을 쓴다 */
  categories: readonly [string, ...string[]];
  /** 저장된 이미지 경로 앞에 붙는 주소(plan 3-8) */
  imageBaseUrl: string;
}

export function createApp(options: AppOptions): Hono {
  throw new Error(`not implemented: ${options.imageBaseUrl}`);
}
