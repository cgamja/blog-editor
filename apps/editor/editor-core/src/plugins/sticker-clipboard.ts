import { DOMSerializer, Fragment, Slice } from "@tiptap/pm/model";
import type { Node, Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import type { Sticker } from "@blog-editor/content-schema";
import { stickerOrNull } from "../closed-values";
import { canHoldDecoration } from "../commands/decoration";
import { stickerCount, stickersOf } from "../commands/sticker-query";
import { isTopLevelTarget } from "./paste-normalizer";
import { pasteTransaction } from "./sticker-safe-paste";
import {
  CLIP_MEMORY_LIMIT,
  CLIP_NONCE_BYTES,
  STICKER_CLIP_ATTR,
} from "./sticker-clipboard.constants";
import type {
  ClipboardFragmentLike,
  CopiedBlock,
  RandomSource,
  StickerClipMemory,
  StickerClipboardOptions,
} from "./sticker-clipboard.types";

/**
 * 에디터 안 복사 · 붙여넣기에서 스티커를 되살린다(spec: editor-paste, adr-027).
 * ProseMirror는 클립보드에 HTML만 싣고(`data-pm-slice`는 열린 깊이 · 조상만) 붙여넣기 정규화가 스티커를
 * 지운다 — 스티커는 닫힌 집합이라 HTML 속성으로 믿지 않는다. 그래서 복사할 때 스티커를 이 탭의 메모리에 두고
 * 클립보드 HTML에는 추측할 수 없는 표식만 싣는다. 붙여넣은 HTML의 표식이 메모리에 있고 조각의 모양(최상위
 * 노드 종류 · 글자)이 복사한 것과 같을 때만 되살린다. 다른 앱 · 다른 탭 · 흉내 낸 속성에서는 들어오지 않는다.
 * 훅 순서(prosemirror-view 1.42.5): 복사 = transformCopied → clipboardSerializer.serializeFragment,
 * 붙여넣기 = transformPastedHTML → 파싱 → transformPasted.
 * 근거: https://prosemirror.net/docs/ref/#view.EditorProps.transformCopied ·
 * https://prosemirror.net/docs/ref/#view.EditorProps.clipboardSerializer ·
 * https://prosemirror.net/docs/ref/#view.EditorProps.transformPastedHTML ·
 * https://prosemirror.net/docs/ref/#view.EditorProps.transformPasted
 */

// 에디터가 여럿이어도(글을 옮겨 다녀 에디터가 새로 떠도) 같은 탭이면 같은 메모리 — 다른 글로 복사할 수 있다
const tabMemory: StickerClipMemory = new Map();
const HEX_RADIX = 16;
// 한 바이트 = 16진수 두 자리
const HEX_BYTE_WIDTH = 2;
const CLIP_NONCE_PATTERN = new RegExp(
  `${STICKER_CLIP_ATTR}="([0-9a-f]{${CLIP_NONCE_BYTES * HEX_BYTE_WIDTH}})"`,
);
// 최상위 블록 안의 위치 깊이 — 글자 블록이면 그 글자 사이다
const TOP_BLOCK_DEPTH = 1;

export const stickerClipboardKey = new PluginKey("stickerClipboard");

// 표식은 클립보드에 적혀 탭 밖으로 나가지만 값을 알아도 쓸 곳은 이 탭 메모리뿐이다 — 암호학 난수로 만든다
function randomNonce(): string {
  const { crypto } = globalThis as unknown as { crypto: RandomSource };
  const bytes = crypto.getRandomValues(new Uint8Array(CLIP_NONCE_BYTES));
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0")).join(
    "",
  );
}

/**
 * 열린 끝 조각(블록 일부만 고른 앞 · 뒤)이 원래 블록 전체인가 — 세 번 클릭 · 끌기로 블록 글자를 다 고르면 열린
 * 조각이지만 블록 전체다. 일부만 골랐으면 스티커가 누구 것인지(자리 · 크기의 기준 블록) 모호해 싣지 않는다.
 * 선택(Selection.content)은 문서 뿌리부터 자른 조각이라 조각의 최상위 노드는 선택 양끝의 최상위 블록이다.
 * https://prosemirror.net/docs/ref/#state.Selection.content
 */
function coversWholeBlock(node: Node, original: Node | null): boolean {
  return (
    original !== null && original.type === node.type && original.textContent === node.textContent
  );
}

/** 스티커가 있는 복사만 기억하고 표식을 돌려준다. 없으면 표식도 없다 */
function remember(
  memory: StickerClipMemory,
  slice: Slice,
  state: EditorState,
  nonce: () => string,
): string | null {
  const { $from, $to } = state.selection;
  const last = slice.content.childCount - 1;
  const blocks: CopiedBlock[] = [];
  slice.content.forEach((node, _offset, i) => {
    const openFirst = i === 0 && slice.openStart > 0;
    const openLast = i === last && slice.openEnd > 0;
    const whole =
      (!openFirst || coversWholeBlock(node, state.doc.maybeChild($from.index(0)))) &&
      (!openLast || coversWholeBlock(node, state.doc.maybeChild($to.index(0))));
    blocks.push({
      type: node.type.name,
      text: node.textContent,
      stickers: whole ? stickersOf(node) : [],
    });
  });
  if (!blocks.some((block) => block.stickers.length > 0)) return null;
  const key = nonce();
  memory.delete(key);
  memory.set(key, blocks);
  // Map은 넣은 순서를 지킨다 — 가장 오래된 것부터 버린다
  for (const oldest of memory.keys()) {
    if (memory.size <= CLIP_MEMORY_LIMIT) break;
    memory.delete(oldest);
  }
  return key;
}

/** 표식이 달린 클립보드 HTML — 복사 직전 transformCopied가 정한 표식을 첫 블록 요소에 단다 */
class MarkedClipboardSerializer extends DOMSerializer {
  readonly #currentNonce: () => string | null;

  constructor(base: DOMSerializer, currentNonce: () => string | null) {
    super(base.nodes, base.marks);
    this.#currentNonce = currentNonce;
  }

  override serializeFragment(
    ...args: Parameters<DOMSerializer["serializeFragment"]>
  ): ReturnType<DOMSerializer["serializeFragment"]> {
    const result = super.serializeFragment(...args);
    // 노드 안쪽을 그릴 때도 이 메서드가 target(세 번째 인자)과 함께 다시 불린다 — 맨 바깥 호출에서만 단다
    const nonce = this.#currentNonce();
    if (args[2] === undefined && nonce !== null) {
      (result as ClipboardFragmentLike).firstElementChild?.setAttribute(STICKER_CLIP_ATTR, nonce);
    }
    return result;
  }
}

/** 표식만 믿지 않는다 — 오래된 표식(앞 복사)이나 같은 표식에 다른 조각이 오면 스티커를 엉뚱한 블록에 붙이지 않게 모양까지 본다 */
function sameShape(slice: Slice, copied: readonly CopiedBlock[]): boolean {
  const { content } = slice;
  return (
    content.childCount === copied.length &&
    copied.every(
      (block, i) =>
        content.child(i).type.name === block.type && content.child(i).textContent === block.text,
    )
  );
}

/** 앞에서부터 `keep`개만 남긴다 — 넘치는 것은 붙인 쪽 뒤에서부터 빠진다 */
function keepFirst(lists: readonly Sticker[][], keep: number): Sticker[][] {
  let left = keep;
  return lists.map((stickers) => {
    const kept = stickers.slice(0, Math.max(left, 0));
    left -= kept.length;
    return kept;
  });
}

function withStickers(slice: Slice, lists: readonly Sticker[][]): Slice {
  const nodes: Node[] = [];
  slice.content.forEach((node, _offset, i) => {
    const stickers = lists[i] ?? [];
    nodes.push(
      stickers.length === 0
        ? node
        : node.type.create({ ...node.attrs, stickers }, node.content, node.marks),
    );
  });
  return new Slice(Fragment.fromArray(nodes), slice.openStart, slice.openEnd);
}

/**
 * 붙일 자리가 제 것이 없는 빈 최상위 글자 블록(글자 · 스티커 없음)인가. 글자를 고른 자리는 넣지 않는다 — 닫힌
 * 조각이 자리 블록을 통째로 대신하면 그 블록의 종류(제목 → 문단) · 스티커 · 꾸밈이 말없이 사라지고, 복사 원본에
 * 스티커가 있느냐에 따라 결과가 갈린다.
 */
function isEmptyTopTextblock(selection: Selection): boolean {
  const { $from, empty } = selection;
  return (
    empty &&
    $from.depth === TOP_BLOCK_DEPTH &&
    $from.parent.isTextblock &&
    $from.parent.content.size === 0 &&
    stickersOf($from.parent).length === 0
  );
}

interface RestorePlan {
  /** 스티커를 얹을 조각 — 열린 끝 블록을 되살릴 때는 양끝을 닫은 것 */
  base: Slice;
  /** 최상위 노드마다 되살릴 스티커 */
  lists: Sticker[][];
}

/**
 * 열린 끝 블록(세 번 클릭 · 끌기로 고른 블록 글자)은 붙일 자리 블록에 합쳐지고 속성은 자리 블록 것이 남는다
 * (prosemirror-transform 1.12.1 replaceRange — 열린 조각은 글자만 자리 블록에 넣는다). 그래서 자리가 빈 최상위 글자
 * 블록일 때만 조각을 닫는다 — 닫힌 블록은 빈 자리 블록을 통째로 대신한다(같은 소스, 덮는 깊이 확장). 그 밖의 자리에서
 * 열린 끝 블록의 스티커는 되살리지 않는다(남의 글자에 섞이면 누구의 스티커인지 모호하다). 복사 쪽(transformCopied)에서
 * 닫지 않는 이유: 문장 안에 붙이면 글자로 들어가던 것이 블록 삽입으로 바뀐다.
 */
function planOpenEnds(slice: Slice, valid: Sticker[][], state: EditorState): RestorePlan {
  const last = valid.length - 1;
  const isOpenEnd = (i: number) =>
    (i === 0 && slice.openStart > 0) || (i === last && slice.openEnd > 0);
  const close =
    isEmptyTopTextblock(state.selection) &&
    valid.some((stickers, i) => isOpenEnd(i) && stickers.length > 0);
  return {
    base: close ? new Slice(slice.content, 0, 0) : slice,
    lists: valid.map((stickers, i) => (isOpenEnd(i) && !close ? [] : stickers)),
  };
}

/**
 * 복사한 스티커를 붙여넣은 조각에 되살린다. 꾸밈 자리는 최상위 블록에만 있으므로(adr-008) 최상위에 붙일 때만.
 * 메모리의 값도 닫힌 집합으로 다시 거른다. 붙인 결과가 글 하나 상한을 넘으면 붙인 쪽 스티커를 뒤에서부터 뺀다 —
 * 결과 문서로 센다(잘라내기는 이미 원래 자리를 지웠다).
 */
function restoreCopiedStickers(
  slice: Slice,
  copied: readonly CopiedBlock[],
  state: EditorState,
): Slice {
  if (!isTopLevelTarget(state.selection) || !sameShape(slice, copied)) return slice;
  const valid = copied.map((block, i) =>
    canHoldDecoration(slice.content.child(i), "stickers")
      ? block.stickers.map(stickerOrNull).filter((sticker) => sticker !== null)
      : [],
  );
  const { base, lists } = planOpenEnds(slice, valid, state);
  for (let keep = lists.flat().length; keep > 0; keep -= 1) {
    const candidate = withStickers(base, keepFirst(lists, keep));
    // 붙인 결과로 센다 — 나뉜 자리 문단의 복제분은 stickerSafePaste가 지우므로 세지 않는다(#126). 닫아 붙이는
    // 경우(pasteClosed)는 replaceSelection으로 붙여 교체 함수가 다를 수 있지만, 자리가 스티커 없는 빈 블록이라 스티커 수는 같다
    if (stickerCount(pasteTransaction(state, candidate).doc) <= MAX_STICKERS_PER_DOC) {
      return candidate;
    }
  }
  return slice;
}

/**
 * 닫아 붙인 조각을 직접 붙인다 — 기본 붙여넣기(prosemirror-view 1.42.5 doPaste)는 닫힌 블록 하나를
 * replaceSelectionWith로 넣고, 커서를 넣은 끝에서 앞으로 찾아(prosemirror-state 1.4.4 selectionToInsertionEnd,
 * 마지막이 블록이면 bias 1) 다음 블록 맨 앞에 둔다. 사용자는 글자를 붙였으니 붙인 글자 끝에서 이어 쳐야 한다.
 * 자리(빈 블록)를 대신한 범위의 끝을 매핑해 그 앞(bias -1)에 커서를 둔다. 메타는 doPaste와 같다.
 * https://prosemirror.net/docs/ref/#view.EditorProps.handlePaste ·
 * https://prosemirror.net/docs/ref/#state.Selection^near
 */
function pasteClosed(view: EditorView, slice: Slice): void {
  const { state } = view;
  const replacedEnd = state.selection.$to.after(TOP_BLOCK_DEPTH);
  const tr = state.tr.replaceSelection(slice);
  tr.setSelection(Selection.near(tr.doc.resolve(tr.mapping.map(replacedEnd)), -1));
  view.dispatch(tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
}

export function stickerClipboard(
  schema: Schema,
  { nonce = randomNonce, memory = tabMemory }: StickerClipboardOptions = {},
): Plugin {
  // 한 번의 복사 · 붙여넣기 안에서 앞 훅이 정한 것을 뒤 훅이 읽는다 — 훅은 동기로 이어 불린다
  let copiedNonce: string | null = null;
  let pastedCopy: CopiedBlock[] | null = null;
  let closedPaste: Slice | null = null;
  const base = DOMSerializer.fromSchema(schema);
  const serializer = new MarkedClipboardSerializer(base, () => copiedNonce);

  return new Plugin({
    key: stickerClipboardKey,
    props: {
      transformCopied(slice, view) {
        copiedNonce = remember(memory, slice, view.state, nonce);
        return slice;
      },
      clipboardSerializer: serializer,
      transformPastedHTML(html) {
        const found = CLIP_NONCE_PATTERN.exec(html)?.[1];
        pastedCopy = found === undefined ? null : (memory.get(found) ?? null);
        return html;
      },
      // 붙여넣기 정규화(pasteNormalizer)가 스티커를 지운 뒤에 돈다 — StickerClipboard 확장의 우선순위가 그 뒤다(extensions.ts)
      transformPasted(slice, view) {
        const copied = pastedCopy;
        pastedCopy = null;
        const restored = copied === null ? slice : restoreCopiedStickers(slice, copied, view.state);
        // 열린 조각을 닫았으면 붙이기는 이 플러그인이 한다 — 끌어 놓기(handleDrop)는 handlePaste를 거치지 않아 여기서 비운다
        const wasOpen = slice.openStart > 0 || slice.openEnd > 0;
        closedPaste =
          wasOpen && restored.openStart === 0 && restored.openEnd === 0 ? restored : null;
        return restored;
      },
      handlePaste(view, _event, slice) {
        const closed = closedPaste;
        closedPaste = null;
        if (closed === null || slice !== closed) return false;
        pasteClosed(view, slice);
        return true;
      },
    },
  });
}
