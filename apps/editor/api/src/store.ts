import type { PostFile, PostMeta } from "@blog-editor/content-schema";

/** 목록 한 줄 — 본문 없이 메타만(plan 3-6 `GET /api/posts`). */
export interface PostSummary {
  slug: string;
  meta: PostMeta;
}

/**
 * 글 저장소 계약(plan 3-6 · adr-004). revision은 저장소가 정하는 불투명 문자열이고,
 * 넘겨받은 revision이 현재와 어긋나면 put은 ConflictError를 던지고 아무것도 바꾸지 않는다.
 * revision `null` = "없는 글에 새로 쓴다".
 */
export interface PostStore {
  list(): Promise<PostSummary[]>;
  get(slug: string): Promise<{ file: PostFile; revision: string } | null>;
  put(slug: string, file: PostFile, revision: string | null): Promise<{ revision: string }>;
}

export class ConflictError extends Error {
  constructor(slug: string) {
    super(`revision이 어긋났다 — slug: ${slug}`);
    this.name = "ConflictError";
  }
}
