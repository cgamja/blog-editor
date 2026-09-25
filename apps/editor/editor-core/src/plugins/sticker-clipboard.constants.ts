/**
 * StickerClipboard 확장의 TipTap 우선순위 — 기본(100)인 붙여넣기 정규화보다 낮아 플러그인이 그 뒤에 온다.
 * transformPasted는 플러그인 순서대로 돌므로(prosemirror-view someProp) 정규화가 스티커를 지운 뒤에 되살린다.
 * 같은 우선순위끼리는 등록 순서를 뒤집어 정렬한다(@tiptap/core 3.31.3 ExtensionManager.plugins) — 배열 순서에 기대지 않는다.
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#priority
 */
export const STICKER_CLIPBOARD_PRIORITY = 90;

/** 복사한 클립보드 HTML의 첫 블록에 다는 표식 속성 — 값은 이 탭만 아는 난수(nonce) */
export const STICKER_CLIP_ATTR = "data-blog-editor-clip";

/** 난수 바이트 수 — 16바이트(128비트)라 추측으로 맞출 수 없다. 16진수로 32자 */
export const CLIP_NONCE_BYTES = 16;

/**
 * 기억하는 복사 수. 클립보드에는 마지막 복사 하나만 남지만, 끌기 시작(dragstart)도 같은 직렬화를 거쳐
 * 표식을 만든다 — 복사 뒤 끌기를 한 번 해도 앞 복사의 표식이 살아 있게 몇 개를 둔다.
 */
export const CLIP_MEMORY_LIMIT = 4;
