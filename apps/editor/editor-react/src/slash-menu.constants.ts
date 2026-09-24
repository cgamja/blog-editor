import type { InsertableBlockKind } from "@blog-editor/editor-core";

/**
 * 슬래시 메뉴 영문 별칭 — 화면에 보이는 문장이 아니라 거르기용 검색 키다. 한글 이름에 더해 이 말로도 거른다
 * (Notion · 마크다운 습관). 키 타입이 INSERTABLE_BLOCKS와
 * 같아서 종류가 늘면 typecheck가 빠진 별칭을 잡는다.
 */
export const SLASH_ALIASES: Record<InsertableBlockKind, readonly string[]> = {
  paragraph: ["text", "p"],
  heading2: ["heading", "h2"],
  heading3: ["heading", "h3"],
  bulletList: ["bullet", "list", "ul"],
  orderedList: ["numbered", "list", "ol"],
  blockquote: ["quote"],
  calloutNote: ["callout", "note"],
  calloutTip: ["callout", "tip"],
  calloutWarning: ["callout", "warning"],
  horizontalRule: ["divider", "hr"],
};
