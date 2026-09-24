import { LOCAL_COPY_PREFIX, LOCAL_DRAFT_PREFIX } from "./constants";
import type { LocalDraft, RestoreDecision } from "./types";

/**
 * 다시 들어왔을 때 브라우저에 남은 글을 어떻게 할지(edit-screen design 3). 같은 revision 위에서 쓰던 글이면
 * 되살리고, 그사이 서버가 바뀌었으면 충돌 대화상자로 넘긴다.
 */
export function restoreDecisionOf(
  local: LocalDraft | null,
  serverRevision: string,
): RestoreDecision {
  if (local === null) return "none";
  return local.baseRevision === serverRevision ? "restore" : "conflict";
}

// 브라우저 저장소는 사생활 보호 창 · 막힌 사이트 데이터에서 던질 수 있다 — 저장 실패가 편집을 막지 않는다
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLocalDraft(key: string): LocalDraft | null {
  try {
    const text = storage()?.getItem(`${LOCAL_DRAFT_PREFIX}${key}`) ?? null;
    return text === null ? null : (JSON.parse(text) as LocalDraft);
  } catch {
    return null;
  }
}

export function writeLocalDraft(key: string, draft: LocalDraft): void {
  try {
    storage()?.setItem(`${LOCAL_DRAFT_PREFIX}${key}`, JSON.stringify(draft));
  } catch {
    // 가득 찼거나 막혔다 — 서버 저장은 그대로 간다
  }
}

export function clearLocalDraft(key: string): void {
  try {
    storage()?.removeItem(`${LOCAL_DRAFT_PREFIX}${key}`);
  } catch {
    // 막혔다 — 남은 글은 다음에 revision 비교로 걸러진다
  }
}

/** 충돌 때 「내 글을 복사해 두고」 — 최신 글을 열어도 내 글이 이 키에 남는다 */
export function writeLocalCopy(key: string, draft: LocalDraft): void {
  try {
    storage()?.setItem(`${LOCAL_COPY_PREFIX}${key}`, JSON.stringify(draft));
  } catch {
    // 막혔다 — 클립보드 사본이 남는다
  }
}
