import type { InsertableBlockKind } from "@blog-editor/editor-core";

/**
 * 「+」 메뉴 · `/` 메뉴 뒤에 붙는 동작 항목 — 블록 종류(INSERTABLE_BLOCKS)가 아니라 파일 고르기 같은 동작이라
 * 문서 커맨드 목록과 따로 둔다. 두 메뉴가 이 순서 그대로 쓴다.
 */
export const BLOCK_MENU_ACTIONS = ["image"] as const;

export type BlockMenuAction = (typeof BLOCK_MENU_ACTIONS)[number];

/** 쓸 수 있는 동작과 그 동작 — 결과를 넣을 최상위 자리(gap)를 받는다. 없는 동작은 메뉴에서 빠진다 */
export type BlockMenuActionHandlers = Partial<Record<BlockMenuAction, (gap: number) => void>>;

/** `/` 메뉴 항목 — 블록 종류이거나 동작 */
export type SlashItem = InsertableBlockKind | BlockMenuAction;
