import type { PostFile } from "@blog-editor/content-schema";

/**
 * 글 하나의 "마지막 AI 저장" 기록(openspec ai-undo · ADR-041). MCP 쓰기 도구가 저장에 성공할 때마다 덮는다.
 * `before`는 그 저장 직전 파일(새로 만든 글이면 null — 되돌릴 판이 없다), `after`는 그 저장이 만든 revision.
 * 지금 revision이 `after`와 같을 때만(그 뒤 사람 · 다른 저장이 없을 때) 되돌릴 수 있다.
 */
export interface AiUndoEntry {
  before: PostFile | null;
  after: string;
}

/** 워크스페이스마다 하나(adr-007) — 글마다 한 단계만 남긴다. 공개 API에 나가지 않는다 */
export interface AiUndoStore {
  get(slug: string): Promise<AiUndoEntry | null>;
  put(slug: string, entry: AiUndoEntry): Promise<void>;
  /**
   * 없는 slug를 지워도 실패하지 않는다. `after`를 주면 지금 기록의 `after`가 같을 때만 지운다 — 확인과 지우기가
   * 저장소 안에서 한 번에 일어나, 그사이 새 AI 저장이 남긴 기록을 지우지 않는다
   */
  delete(slug: string, after?: string): Promise<void>;
}
