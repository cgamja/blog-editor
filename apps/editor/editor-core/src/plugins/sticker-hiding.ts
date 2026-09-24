import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { StickerRef } from "../commands/sticker-edit";
import { stickersIn } from "../commands/sticker-query";

/**
 * 끄는 동안 원래 자리의 스티커를 숨긴다 — spec: editor-sticker-edit, sticker-polish design.md 3.
 * 스티커 img는 ProseMirror가 그린 DOM이라 직접 고치면 DOMObserver가 다시 읽는다. 최상위 블록에 노드 장식
 * 속성만 달고, 어느 img를 가릴지는 editor-react CSS가 순번으로 고른다
 * (https://prosemirror.net/docs/ref/#view.Decoration^node). 문서는 바꾸지 않는다(메타만).
 */

/** 장식이 다는 속성 — 값은 가릴 스티커의 순번 */
export const STICKER_HIDDEN_ATTR = "data-sticker-hidden";

/** 플러그인 상태 = 숨긴 스티커, 없으면 null */
export const stickerHidingKey = new PluginKey<StickerRef | null>("stickerHiding");

export function stickerHiding(): Plugin<StickerRef | null> {
  return new Plugin<StickerRef | null>({
    key: stickerHidingKey,
    state: {
      init: () => null,
      // https://prosemirror.net/docs/ref/#state.StateField.apply — 문서가 바뀌면(놓기 · 다른 편집) 숨김을 푼다.
      // 참조가 낡기 때문이고, 끄는 쪽도 문서가 바뀌면 끌기를 취소한다
      apply(tr, previous) {
        const meta = tr.getMeta(stickerHidingKey) as StickerRef | null | undefined;
        if (meta !== undefined) return meta;
        return tr.docChanged ? null : previous;
      },
    },
    props: {
      decorations(state) {
        const hidden = stickerHidingKey.getState(state);
        if (hidden === null || hidden === undefined) return null;
        const node = state.doc.nodeAt(hidden.blockPos);
        if (node === null || stickersIn(state.doc, hidden.blockPos)[hidden.index] === undefined) {
          return null;
        }
        return DecorationSet.create(state.doc, [
          Decoration.node(hidden.blockPos, hidden.blockPos + node.nodeSize, {
            [STICKER_HIDDEN_ATTR]: String(hidden.index),
          }),
        ]);
      },
    },
  });
}

/**
 * 스티커 하나를 숨기거나(ref) 숨김을 푼다(null). 플러그인이 없거나, 풀 것이 없는데 null이면 false —
 * 빈 트랜잭션을 보내지 않는다.
 */
export function hideSticker(ref: StickerRef | null): Command {
  return (state, dispatch) => {
    const current = stickerHidingKey.getState(state);
    if (current === undefined) return false;
    if (ref === null && current === null) return false;
    if (dispatch) dispatch(state.tr.setMeta(stickerHidingKey, ref));
    return true;
  };
}
