/**
 * 「+」 메뉴 · `/` 메뉴 뒤에 붙는 동작 항목 — 블록 종류(INSERTABLE_BLOCKS)가 아니라 파일 고르기 같은 동작이라
 * 문서 커맨드 목록과 따로 둔다. 두 메뉴가 이 순서 그대로 쓴다.
 */
export const BLOCK_MENU_ACTIONS = ["image"] as const;

export type BlockMenuAction = (typeof BLOCK_MENU_ACTIONS)[number];
