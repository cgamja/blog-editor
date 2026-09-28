import type { Doc } from "@blog-editor/content-schema";

/**
 * 서버에서 읽은 판을 어떻게 할까(openspec editor-live-reflect) — 무시 · 바꿔 끼우기 · 띠로 알리기 · 조합 뒤로 미루기
 */
export type LiveReflectAction = "ignore" | "replace" | "notify" | "defer";

export interface LiveReflectInput {
  /** 지금 서버의 revision */
  serverRevision: string;
  /** 내가 가진 판 — 불러온 판이나 내 마지막 저장이 돌려준 revision */
  knownRevision: string | null;
  /** 저장하지 않은 고침(본문 · 글 정보)이 있다 */
  hasUnsavedChanges: boolean;
  /** 한글 조합 중이다 */
  isComposing: boolean;
}

/**
 * 같은 revision이면 자기 판이다 — 조합 중이어도 무시한다. 다른 판이고 저장 안 한 고침이 있으면 띠로 알린다
 * (띠는 문서를 바꾸지 않으니 조합 중이어도 된다). 고침이 없으면 바꿔 끼우되, 조합 중이면 끝난 뒤로 미룬다
 * (CLAUDE.md `view.composing`).
 */
export function liveReflectActionOf({
  serverRevision,
  knownRevision,
  hasUnsavedChanges,
  isComposing,
}: LiveReflectInput): LiveReflectAction {
  if (serverRevision === knownRevision) return "ignore";
  if (hasUnsavedChanges) return "notify";
  return isComposing ? "defer" : "replace";
}

/**
 * 바뀐 최상위 블록 번호(0부터) — 같은 번호끼리 비교하고, `after`에 새로 붙은 번호도 넣는다. 정규형이 하나라
 * (키 순서 · 마크 순서) JSON 글자로 비교한다. 지워지기만 한 블록은 칠할 자리가 없어 넣지 않는다.
 */
export function changedTopBlocks(before: Doc, after: Doc): number[] {
  const previous = before.content.map((block) => JSON.stringify(block));
  return after.content.flatMap((block, index) =>
    previous[index] === JSON.stringify(block) ? [] : [index],
  );
}
