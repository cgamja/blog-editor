/**
 * `/` 슬래시 메뉴 상태 — spec: editor-slash-menu, slash-menu design.md. 근거 문서:
 * - Plugin · StateField: https://prosemirror.net/docs/ref/#state.PluginSpec.state
 * - EditorProps.handleTextInput(조합 입력에는 불리지 않는다): https://prosemirror.net/docs/ref/#view.EditorProps.handleTextInput
 * - EditorProps.handleKeyDown: https://prosemirror.net/docs/ref/#view.EditorProps.handleKeyDown
 * - Mapping.map(assoc): https://prosemirror.net/docs/ref/#transform.Mappable.map
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";

/** 슬래시 메뉴 상태. `from`은 `/`의 위치, `query`는 `/` 뒤부터 커서까지의 글자 */
export interface SlashMenuState {
  from: number;
  query: string;
}

export interface SlashMenuOptions {
  /** 열려 있을 때 방향키 · Enter · Tab을 받는 UI 처리기. 처리했으면 true */
  onKey?: ((key: string) => boolean) | undefined;
}

type SlashMenuMeta = { open: number } | typeof CLOSE;

const CLOSE = "close";

/** 별칭 중 가장 긴 것보다 넉넉히 — 이보다 길면 메뉴를 찾는 중이 아니라 글을 쓰는 중이다(design.md 3) */
const MAX_QUERY_LENGTH = 20;

/** UI로 넘기는 키. Esc는 플러그인이 직접 닫는다 */
const FORWARDED_KEYS: ReadonlySet<string> = new Set(["ArrowUp", "ArrowDown", "Enter", "Tab"]);

const SLASH = "/";
const WHITESPACE = /\s/;

export const slashMenuKey = new PluginKey<SlashMenuState | null>("slashMenu");

/** 최상위 문단(깊이 1)만 — 블록 바꾸기 · 넣기 커맨드가 최상위 블록 기준이다(design.md 2) */
function inTopParagraph(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos);
  return $pos.depth === 1 && $pos.parent.type.name === "paragraph";
}

/** 빈 선택, 최상위 문단, 줄 맨 앞이거나 공백 뒤, 코드 마크 밖 */
function canOpenAt(state: EditorState, from: number, to: number): boolean {
  if (from !== to || !inTopParagraph(state, from)) return false;
  const $from = state.doc.resolve(from);
  const before = $from.parentOffset === 0 ? "" : state.doc.textBetween(from - 1, from);
  if (before !== "" && !WHITESPACE.test(before)) return false;
  const marks = [...(state.storedMarks ?? $from.marks()), ...($from.nodeBefore?.marks ?? [])];
  return !marks.some((mark) => mark.type.name === "code");
}

/** 새 문서에서 `/` 자리와 커서를 다시 읽는다 — 조합 중인 글자도 query에 들어간다(design.md 1) */
function readMenu(state: EditorState, from: number): SlashMenuState | null {
  const { selection, doc } = state;
  if (!selection.empty || selection.from <= from || from >= doc.content.size) return null;
  if (!inTopParagraph(state, from) || !doc.resolve(from).sameParent(selection.$from)) return null;
  if (doc.textBetween(from, from + 1) !== SLASH) return null;
  const query = doc.textBetween(from + 1, selection.from);
  if (WHITESPACE.test(query) || query.length > MAX_QUERY_LENGTH) return null;
  return { from, query };
}

function nextMenu(tr: Transaction, prev: SlashMenuState | null, state: EditorState) {
  const meta = tr.getMeta(slashMenuKey) as SlashMenuMeta | undefined;
  if (meta === CLOSE) return null;
  if (meta !== undefined) return readMenu(state, meta.open);
  // `/` 바로 앞에 끼어든 글자는 `/`를 뒤로 민다 — assoc 1로 같이 따라간다
  return prev === null ? null : readMenu(state, tr.mapping.map(prev.from, 1));
}

/**
 * 슬래시 메뉴 플러그인. 여는 것은 handleTextInput의 `/`(한글 자판에서도 조합 없이 들어온다),
 * 거르기 글자는 트랜잭션마다 문서에서 다시 읽는다. 조합 중 키는 UI로 넘기지 않는다 — 조합 중 Enter는
 * 조합 확정만 해야 한다(design.md 5).
 */
export function slashMenu({ onKey }: SlashMenuOptions = {}): Plugin<SlashMenuState | null> {
  return new Plugin<SlashMenuState | null>({
    key: slashMenuKey,
    state: {
      init: () => null,
      apply: (tr, prev, _old, state) => nextMenu(tr, prev, state),
    },
    props: {
      handleTextInput(view, from, to, text) {
        if (text !== SLASH || !canOpenAt(view.state, from, to)) return false;
        const meta: SlashMenuMeta = { open: from };
        view.dispatch(view.state.tr.insertText(SLASH, from, to).setMeta(slashMenuKey, meta));
        return true;
      },
      handleKeyDown(view, event) {
        if (slashMenuKey.getState(view.state) == null) return false;
        if (view.composing || event.isComposing) return false;
        if (event.key === "Escape") return closeSlashMenu(view.state, view.dispatch);
        return FORWARDED_KEYS.has(event.key) && (onKey?.(event.key) ?? false);
      },
    },
  });
}

/** 메뉴를 닫는다. 입력한 글자는 그대로 둔다. 닫혀 있으면 false */
export const closeSlashMenu: Command = (state, dispatch) => {
  if (slashMenuKey.getState(state) == null) return false;
  dispatch?.(state.tr.setMeta(slashMenuKey, CLOSE));
  return true;
};

/** 고른 항목을 적용한 트랜잭션이 메뉴를 닫게 하는 meta */
export const markSlashMenuClosed = (tr: Transaction): Transaction =>
  tr.setMeta(slashMenuKey, CLOSE);

/** UI가 키 처리기를 꽂는 자리(extension storage) */
export interface SlashMenuStorage {
  onKey: ((key: string) => boolean) | null;
}

declare module "@tiptap/core" {
  interface Storage {
    slashMenu: SlashMenuStorage;
  }
}

/**
 * 조립하는 쪽이 고른다. 등록만 한다(adr-002). 키 처리기는 React가 `editor.storage.slashMenu.onKey`에 꽂는다.
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#storage
 */
export const SlashMenu = Extension.create<object, SlashMenuStorage>({
  name: "slashMenu",
  addStorage: () => ({ onKey: null }),
  addProseMirrorPlugins() {
    return [slashMenu({ onKey: (key) => this.storage.onKey?.(key) ?? false })];
  },
});
