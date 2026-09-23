/**
 * check.ts(토큰 검사) · directives.ts(지시어) · parser.ts(doc 조립)가 공유하는 모양.
 * 여기 따로 둔 이유는 오직 하나 — check.ts ↔ directives.ts가 서로를 import하는 순환을 끊는다.
 */

/** 최상위 블록의 "의미" 종류 — markdown-it 토큰 type과 doc의 node type 사이 다리다. */
export type SemanticType =
  | "paragraph"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "callout"
  | "codeBlock"
  | "horizontalRule"
  | "image";

export type ContainerKind = "blockquote" | "listItem" | "callout";

/** 토큰을 한 번 훑으며 만드는 블록 레지스트리 한 칸 — 지시어 귀속 · 메시지의 블록 번호가 이걸 쓴다. */
export interface BlockRecord {
  /** 0-based, 원문(지시어를 걷어낸 뒤) 줄 번호 — 지시어 귀속 매칭 키. */
  mapStart0: number;
  mapEnd0: number;
  semantic: SemanticType;
  /** 바로 감싼 컨테이너 — "top"이면 doc.content 바로 아래(꾸미기 · 지시어 자리가 있다). */
  container: "top" | ContainerKind;
  /** 최상위 블록 순번(1부터) — 이 블록을 감싼 최상위 블록의 번호(자신이 최상위면 자기 번호). */
  topLevel: number;
}
