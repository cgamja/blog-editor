import type { PostFile } from "@blog-editor/content-schema";
import { revisionOf, serialize } from "./revision";
import { ConflictError } from "./store";
import type { PostStore } from "./store";

/**
 * 테스트용 저장소. 확인과 쓰기 사이에 await가 없어 한 이벤트 루프 턴 안에서 끝난다
 * — 그래서 동시 put도 하나만 이긴다. 넣고 꺼낼 때 복제해 호출자와 객체를 공유하지 않는다.
 */
export function createMemoryPostStore(): PostStore {
  const posts = new Map<string, { text: string; revision: string }>();

  return {
    async list() {
      return [...posts].map(([slug, { text }]) => ({
        slug,
        meta: (JSON.parse(text) as PostFile).meta,
      }));
    },
    async get(slug) {
      const entry = posts.get(slug);
      if (entry === undefined) return null;
      return { file: JSON.parse(entry.text) as PostFile, revision: entry.revision };
    },
    async put(slug, file, revision) {
      const current = posts.get(slug)?.revision ?? null;
      if (current !== revision) throw new ConflictError(slug);
      const text = serialize(file);
      const next = revisionOf(text);
      posts.set(slug, { text, revision: next });
      return { revision: next };
    },
  };
}
