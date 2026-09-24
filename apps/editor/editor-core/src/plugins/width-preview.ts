import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { WidthPreviewState } from "../commands/block-controls.types";
import { canHoldDecoration } from "../commands/decoration";
import { widthOrNull } from "../closed-values";

/**
 * 폭 손잡이를 끄는 동안의 폭 미리보기 — spec: editor-block-resize, block-controls design.md 6.
 * 블록 DOM은 ProseMirror가 그린 것이라 style을 직접 고치면 DOMObserver가 다시 읽는다. 대신 노드 장식으로
 * `style="--w:N"`을 단다 — 장식 style은 노드 자신의 style 뒤에 붙어 이긴다
 * (https://prosemirror.net/docs/ref/#view.Decoration^node). 문서는 바꾸지 않는다(메타만).
 */

/** 플러그인 상태 = 미리 보일 블록과 폭, 없으면 null */
export const widthPreviewKey = new PluginKey<WidthPreviewState | null>("widthPreview");

export function widthPreview(): Plugin<WidthPreviewState | null> {
  return new Plugin<WidthPreviewState | null>({
    key: widthPreviewKey,
    state: {
      init: () => null,
      // https://prosemirror.net/docs/ref/#state.StateField.apply — 문서가 바뀌면(놓기 · 다른 편집) 위치가 낡는다
      apply(tr, previous) {
        const meta = tr.getMeta(widthPreviewKey) as WidthPreviewState | null | undefined;
        if (meta !== undefined) return meta;
        return tr.docChanged ? null : previous;
      },
    },
    props: {
      decorations(state) {
        const preview = widthPreviewKey.getState(state);
        if (preview === null || preview === undefined) return null;
        const node = state.doc.nodeAt(preview.pos);
        if (node === null || !canHoldDecoration(node, "width")) return null;
        return DecorationSet.create(state.doc, [
          Decoration.node(preview.pos, preview.pos + node.nodeSize, {
            style: `--w:${preview.width}`,
          }),
        ]);
      },
    },
  });
}

/** pos가 최상위 블록 시작이고 그 블록이 폭을 가질 수 있는가 */
function isWidthBlockAt(state: Parameters<Command>[0], pos: number): boolean {
  const { doc } = state;
  if (!Number.isInteger(pos) || pos < 0 || pos >= doc.content.size) return false;
  if (doc.resolve(pos).depth !== 0) return false;
  const node = doc.nodeAt(pos);
  return node !== null && canHoldDecoration(node, "width");
}

/**
 * 폭 미리보기를 켜거나(pos · width) 끈다(null). 플러그인이 없거나, 폭을 못 가지는 블록 · 범위 밖 폭이거나,
 * 끌 것이 없는데 null이면 false — 빈 트랜잭션을 보내지 않는다.
 */
export function previewBlockWidth(pos: number, width: number | null): Command {
  return (state, dispatch) => {
    const current = widthPreviewKey.getState(state);
    if (current === undefined) return false;
    if (width === null) {
      if (current === null) return false;
      if (dispatch) dispatch(state.tr.setMeta(widthPreviewKey, null));
      return true;
    }
    const checked = widthOrNull(width);
    if (checked === null || !isWidthBlockAt(state, pos)) return false;
    if (dispatch) dispatch(state.tr.setMeta(widthPreviewKey, { pos, width: checked }));
    return true;
  };
}
