import type { EditingSession } from "./types";

/**
 * 경로가 바뀌었을 때의 편집 세션. 화면이 스스로 옮긴 주소(새 글의 첫 저장 · 주소 바꾸기)면 세션 키를 이어 가
 * 에디터를 다시 만들지 않는다 — 다시 만들면 커서 · undo가 날아간다(edit-screen design 1).
 */
export function nextEditingSession(state: EditingSession, routeKey: string): EditingSession {
  if (state.routeKey === routeKey) return state;
  const sessionKey = state.adopted === routeKey ? state.sessionKey : routeKey;
  return { routeKey, sessionKey, adopted: null };
}

/** 화면이 곧 이 주소로 옮긴다 — 다음 경로 변화에서 세션을 이어 간다 */
export function adoptSlug(state: EditingSession, slug: string): EditingSession {
  return { ...state, adopted: slug };
}
