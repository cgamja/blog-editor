/**
 * 키를 받는 확장들의 TipTap 우선순위 — 높을수록 먼저 본다. 값 사이의 **순서가 계약**이라 한 곳에 순서대로 둔다.
 * 앞 확장이 false를 돌려주면 다음 확장으로 넘어가고, 모두 지나면 코어 Keymap(우선순위 100)이다.
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#priority
 */

/** 열린 슬래시 메뉴의 Enter · Tab · 방향키 — 메뉴가 열려 있으면 무엇보다 먼저 받는다. 닫혀 있으면 넘긴다 */
export const SLASH_MENU_PRIORITY = 1200;

/** 입력 규칙 직후 Backspace로 되돌리기 — 되돌릴 게 없으면 넘긴다 */
export const MARKDOWN_SHORTCUTS_PRIORITY = 1100;

/** 목록 항목의 Enter · Tab · Backspace — 스티커 분할 · 커스텀 블록 Backspace보다 앞 */
export const LIST_KEYS_PRIORITY = 1050;

/** 스티커가 있는 블록의 Enter — 스티커 없는 블록이면 넘긴다 */
export const STICKER_SPLIT_PRIORITY = 1000;

/** 커스텀 블록 바로 뒤 Backspace(editor-react가 등록) — 스티커 분할과 서로 다른 키라 같은 층이다 */
export const CUSTOM_BLOCK_KEYS_PRIORITY = 1000;
