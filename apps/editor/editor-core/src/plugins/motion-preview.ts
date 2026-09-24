import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command, EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { selectedTopBlocks } from "../commands/decoration";

/**
 * 움직임 미리 보기 — spec: decoration-panel, design.md 3.
 * 편집 화면은 움직임을 재생하지 않는다. 미리 보기는 고른 블록에 노드 장식 클래스를 잠깐 단다 —
 * ProseMirror가 그리는 DOM에 클래스를 직접 넣으면 DOMObserver가 되돌리므로 장식이 공식 경로다
 * (https://prosemirror.net/docs/ref/#view.Decoration^node). 문서는 바꾸지 않는다(메타만).
 */

/** 장식이 다는 클래스 — editor-react editor.css가 이 클래스에만 시간 기반 애니메이션을 준다 */
export const MOTION_PREVIEW_CLASS = "editor-motion-preview";

/** 장식을 떼기까지 — editor-react editor.css 애니메이션(0.6초)보다 조금 길게 */
const PREVIEW_MS = 1000;

/** 플러그인 상태 = 미리 보는 최상위 블록의 시작 위치, 없으면 null */
export const motionPreviewKey = new PluginKey<number | null>("motionPreview");

const hasMotion = (state: EditorState, pos: number) => state.doc.nodeAt(pos)?.attrs.motion != null;

export function motionPreview(): Plugin<number | null> {
  return new Plugin<number | null>({
    key: motionPreviewKey,
    state: {
      init: () => null,
      // https://prosemirror.net/docs/ref/#state.StateField.apply — 메타가 있으면 그것, 아니면 위치를 매핑한다
      apply(tr, previous) {
        const meta = tr.getMeta(motionPreviewKey) as number | null | undefined;
        if (meta !== undefined) return meta;
        if (previous === null) return null;
        // https://prosemirror.net/docs/ref/#transform.Mapping.mapResult — 블록이 지워졌으면 뗀다
        const mapped = tr.mapping.mapResult(previous, 1);
        return mapped.deleted ? null : mapped.pos;
      },
    },
    // 타이머는 에디터 수명에 묶는다 — 패널이 먼저 사라져도 장식이 남지 않고, 에디터가 없어지면 타이머도 없다
    // https://prosemirror.net/docs/ref/#state.PluginSpec.view
    view(editorView) {
      // editor-core는 DOM lib 없이 컴파일된다 — 타이머는 에디터가 붙은 창의 것을 쓴다
      const win = editorView.dom.ownerDocument.defaultView;
      let timer: number | undefined;
      const clear = () => {
        if (timer !== undefined) win?.clearTimeout(timer);
        timer = undefined;
      };
      return {
        update(view, previousState) {
          const pos = motionPreviewKey.getState(view.state) ?? null;
          if (pos === (motionPreviewKey.getState(previousState) ?? null)) return;
          clear();
          if (pos !== null) {
            timer = win?.setTimeout(() => endMotionPreview(view.state, view.dispatch), PREVIEW_MS);
          }
        },
        destroy: clear,
      };
    },
    props: {
      decorations(state) {
        const pos = motionPreviewKey.getState(state);
        if (pos === null || pos === undefined || !hasMotion(state, pos)) return null;
        const node = state.doc.nodeAt(pos);
        if (node === null) return null;
        return DecorationSet.create(state.doc, [
          Decoration.node(pos, pos + node.nodeSize, { class: MOTION_PREVIEW_CLASS }),
        ]);
      },
    },
  });
}

/** 선택의 첫 최상위 블록에 움직임이 있으면 미리 보기를 시작한다. 없거나 대상이 없으면 false */
export const previewMotion: Command = (state, dispatch) => {
  const [first] = selectedTopBlocks(state);
  if (first === undefined || !hasMotion(state, first.pos)) return false;
  if (dispatch) dispatch(state.tr.setMeta(motionPreviewKey, first.pos));
  return true;
};

/** 미리 보기 장식을 뗀다. 미리 보는 중이 아니면 false */
export const endMotionPreview: Command = (state, dispatch) => {
  const pos = motionPreviewKey.getState(state);
  if (pos === null || pos === undefined) return false;
  if (dispatch) dispatch(state.tr.setMeta(motionPreviewKey, null));
  return true;
};
