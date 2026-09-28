import type { PostFile } from "@blog-editor/content-schema";
import type { AiUndoUnavailableReason } from "./ai-undo-reasons";
import type { AiUndoStore } from "./ai-undo-store";
import type { PostStore } from "./store";

/** 되돌릴 수 없다 — 거절한 까닭이거나 글이 없다 */
export type AiUndoRefusal = AiUndoUnavailableReason | "notFound";

export type AiUndoCheck =
  { ok: true; revision: string; before: PostFile } | { ok: false; reason: AiUndoRefusal };

/**
 * 지금 되돌릴 수 있는가(ADR-041) — 글이 초안이고, 남긴 판이 있고, 지금 revision이 그 AI 저장이 만든 revision과
 * 같고(그 뒤 사람 · 다른 저장 없음), 저장 전 파일이 있을 때만(새로 만든 글은 되돌릴 판이 없다).
 * 저장 전 파일도 초안이어야 한다 — 손으로 고친 기록 파일로 되돌리기가 발행 글을 쓰는 길(MCP 발행 우회)을 막는다.
 * 성공이면 `revision`은 지금 글의 것, `before`는 되돌려 쓸 파일이다.
 */
export async function checkAiUndo(
  store: PostStore,
  aiUndo: AiUndoStore,
  slug: string,
): Promise<AiUndoCheck> {
  const found = await store.get(slug);
  if (found === null) return { ok: false, reason: "notFound" };
  if (found.file.meta.draft !== true) return { ok: false, reason: "published" };
  const entry = await aiUndo.get(slug);
  if (entry === null) return { ok: false, reason: "nothing" };
  if (found.revision !== entry.after) return { ok: false, reason: "changed" };
  if (entry.before === null) return { ok: false, reason: "newPost" };
  if (entry.before.meta.draft !== true) return { ok: false, reason: "published" };
  return { ok: true, revision: found.revision, before: entry.before };
}

export type AiUndoResult = { ok: true; revision: string } | { ok: false; reason: AiUndoRefusal };

/**
 * 마지막 AI 저장을 되돌린다 — 저장 전 파일을 revision 조건으로 다시 쓰고(그사이 바뀌면 ConflictError, 글은 그대로),
 * 남긴 판을 지운다(그사이 새 AI 저장이 남긴 판이면 두고 간다). 저장 전 파일은 AI 저장 경로가 이미 검증해 썼던 초안 그대로다 — 초안이라 서버가 정하는
 * 발행 수정일(published-update)이 끼지 않고, date · source도 그 판의 것이다.
 * @param expected 호출자가 본 revision(REST If-Match) — 지금과 다르면 ConflictError. 없으면 지금 revision
 */
export async function revertAiEdit(
  store: PostStore,
  aiUndo: AiUndoStore,
  slug: string,
  expected?: string,
): Promise<AiUndoResult> {
  const check = await checkAiUndo(store, aiUndo, slug);
  if (!check.ok) return check;
  const { revision } = await store.put(slug, check.before, expected ?? check.revision);
  // 쓰기와 지우기 사이에 새 AI 저장이 들어왔으면 그 판은 새 저장의 것이다 — 되돌린 판(after)일 때만 지운다
  const latest = await aiUndo.get(slug);
  if (latest?.after === check.revision) await aiUndo.delete(slug);
  return { ok: true, revision };
}
