import type { InsertableBlockKind, TurnIntoKind } from "@blog-editor/editor-core";

/** 에디터 화면의 사용자 문장 — 한 곳에서 고친다. */

export const BLOCK_HANDLE_MESSAGES = {
  add: "블록 추가",
  move: "블록 옮기기",
  moveHint: "끌어서 옮기기 · 누르면 블록 메뉴 · 키보드는 Ctrl/⌘ + Shift + ↑/↓",
} as const;

/** 손잡이를 누르면 여는 블록 메뉴(Notion의 블록 메뉴 — 바꾸기 · 복제 · 지우기) */
export const BLOCK_MENU_MESSAGES = {
  menu: "블록 메뉴",
  turnInto: "바꾸기",
  duplicate: "복제",
  remove: "지우기",
} as const;

/** 「바꾸기」 항목 이름. 키 타입이 TURN_INTO_TARGETS와 같아서 종류가 늘면 typecheck가 빠진 이름을 잡는다. */
export const TURN_INTO_LABELS: Record<TurnIntoKind, string> = {
  paragraph: "문단",
  heading2: "큰 제목",
  heading3: "작은 제목",
  bulletList: "점 목록",
  orderedList: "번호 목록",
  blockquote: "인용",
  codeBlock: "코드",
};

/** ⌘K 링크 팝오버. 허용 목록은 content-schema hrefSchema — http(s) · mailto · 사이트 안 경로 */
export const LINK_MESSAGES = {
  dialog: "링크",
  address: "링크 주소",
  apply: "적용",
  remove: "링크 빼기",
  invalid: "https://, mailto:, 또는 /로 시작하는 주소만 넣을 수 있어요.",
} as const;

/** 「블록 추가」 메뉴 이름. 키 타입이 INSERTABLE_BLOCKS와 같아서 종류가 늘면 typecheck가 빠진 이름을 잡는다. */
export const INSERTABLE_BLOCK_LABELS: Record<InsertableBlockKind, string> = {
  paragraph: "문단",
  heading2: "큰 제목",
  heading3: "작은 제목",
  bulletList: "점 목록",
  orderedList: "번호 목록",
  blockquote: "인용",
  calloutNote: "콜아웃 · 메모",
  calloutTip: "콜아웃 · 팁",
  calloutWarning: "콜아웃 · 주의",
  horizontalRule: "구분선",
};
