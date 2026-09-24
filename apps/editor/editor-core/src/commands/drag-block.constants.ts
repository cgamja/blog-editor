import type { InsertableBlock } from "./drag-block.types";

/**
 * 「블록 추가」 메뉴에서 넣을 수 있는 블록 — 닫힌 목록. 값은 스키마의 닫힌 집합(HEADING_LEVELS · CALLOUT_TONES)
 * 안에서만 고른다. 그림 · 앱 스크린샷은 저장 경로가 있어야 해서 사진 올리기(M5) 뒤에 더한다.
 */
export const INSERTABLE_BLOCKS = {
  paragraph: { type: "paragraph" },
  heading2: { type: "heading", attrs: { level: 2 } },
  heading3: { type: "heading", attrs: { level: 3 } },
  bulletList: { type: "bulletList" },
  orderedList: { type: "orderedList" },
  blockquote: { type: "blockquote" },
  calloutNote: { type: "callout", attrs: { tone: "note" } },
  calloutTip: { type: "callout", attrs: { tone: "tip" } },
  calloutWarning: { type: "callout", attrs: { tone: "warning" } },
  horizontalRule: { type: "horizontalRule" },
} as const satisfies Readonly<Record<string, InsertableBlock>>;

export type InsertableBlockKind = keyof typeof INSERTABLE_BLOCKS;
