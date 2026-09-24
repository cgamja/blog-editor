import type { TurnIntoTarget } from "./block-controls.types";

/**
 * 블록 메뉴 「바꾸기」 — 닫힌 목록(Notion의 Turn into 중 우리 스키마에 있는 것). 제목 수준은 HEADING_LEVELS 안.
 */
export const TURN_INTO_TARGETS = {
  paragraph: { via: "textblock", type: "paragraph" },
  heading2: { via: "textblock", type: "heading", attrs: { level: 2 } },
  heading3: { via: "textblock", type: "heading", attrs: { level: 3 } },
  bulletList: { via: "wrap", wrapper: "bulletList" },
  orderedList: { via: "wrap", wrapper: "orderedList" },
  blockquote: { via: "wrap", wrapper: "blockquote" },
  codeBlock: { via: "textblock", type: "codeBlock" },
} as const satisfies Readonly<Record<string, TurnIntoTarget>>;

export type TurnIntoKind = keyof typeof TURN_INTO_TARGETS;
