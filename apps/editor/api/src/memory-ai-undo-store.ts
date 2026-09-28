import type { AiUndoEntry, AiUndoStore } from "./ai-undo-store";

/** 테스트 · 기본값용 ai-undo 저장소. 넣고 꺼낼 때 복제해 호출자와 객체를 공유하지 않는다. */
export function createMemoryAiUndoStore(): AiUndoStore {
  const entries = new Map<string, string>();
  return {
    async get(slug) {
      const text = entries.get(slug);
      return text === undefined ? null : (JSON.parse(text) as AiUndoEntry);
    },
    async put(slug, entry) {
      entries.set(slug, JSON.stringify(entry));
    },
    async delete(slug, after) {
      const text = entries.get(slug);
      if (text === undefined) return;
      if (after !== undefined && (JSON.parse(text) as AiUndoEntry).after !== after) return;
      entries.delete(slug);
    },
  };
}
