import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import type { Command, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { LIVE_CHANGED_ATTR, LIVE_CHANGED_MS } from "./live-changed.constants";

/**
 * 다른 곳(AI의 MCP 도구)에서 바뀐 초안으로 문서를 바꿔 끼우고, 바뀐 최상위 블록을 잠깐 칠한다
 * (openspec editor-live-reflect). 칠하기는 노드 장식 속성이다 — ProseMirror가 그린 DOM에 직접 넣으면
 * DOMObserver가 되돌린다(https://prosemirror.net/docs/ref/#view.Decoration^node). 문서는 바꾸지 않는다.
 */

/**
 * 플러그인 상태 — 칠한 최상위 블록들의 시작 위치와, 새로 칠할 때마다 오르는 회차(시계를 다시 맞추는 기준)
 */
export interface LiveChangedState {
  positions: readonly number[];
  round: number;
}

export const liveChangedKey = new PluginKey<LiveChangedState>("liveChanged");

/** 바꿔 끼우기 트랜잭션의 표시 — 자동 저장처럼 "사람이 고쳤다"로 읽는 쪽이 거른다 */
const REPLACED_META = "liveReplaced";

export function liveChanged(): Plugin<LiveChangedState> {
  return new Plugin<LiveChangedState>({
    key: liveChangedKey,
    state: {
      init: () => ({ positions: [], round: 0 }),
      // https://prosemirror.net/docs/ref/#state.StateField.apply — 메타가 있으면 새 회차, 아니면 위치를 매핑한다
      apply(tr, previous) {
        const meta = tr.getMeta(liveChangedKey) as readonly number[] | undefined;
        if (meta !== undefined) return { positions: meta, round: previous.round + 1 };
        if (previous.positions.length === 0 || !tr.docChanged) return previous;
        // https://prosemirror.net/docs/ref/#transform.Mapping.mapResult — 지워진 블록은 칠하지 않는다
        const positions = previous.positions.flatMap((pos) => {
          const mapped = tr.mapping.mapResult(pos, 1);
          return mapped.deleted ? [] : [mapped.pos];
        });
        return { positions, round: previous.round };
      },
    },
    // 타이머는 에디터 수명에 묶는다(motion-preview와 같다) — https://prosemirror.net/docs/ref/#state.PluginSpec.view
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
          const current = liveChangedKey.getState(view.state);
          if (
            current === undefined ||
            current.round === liveChangedKey.getState(previousState)?.round
          ) {
            return;
          }
          clear();
          if (current.positions.length > 0) {
            timer = win?.setTimeout(
              () => endLiveChanged(view.state, view.dispatch),
              LIVE_CHANGED_MS,
            );
          }
        },
        destroy: clear,
      };
    },
    props: {
      decorations(state) {
        const positions = liveChangedKey.getState(state)?.positions ?? [];
        if (positions.length === 0) return null;
        const decorations = positions.flatMap((pos) => {
          const node = state.doc.nodeAt(pos);
          return node === null
            ? []
            : [Decoration.node(pos, pos + node.nodeSize, { [LIVE_CHANGED_ATTR]: "" })];
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

/** 최상위 블록 번호(0부터)들의 시작 위치 — 없는 번호는 뺀다 */
function topBlockPositions(doc: Node, indexes: readonly number[]): number[] {
  const starts: number[] = [];
  doc.forEach((_node, offset) => starts.push(offset));
  return indexes.flatMap((index) => (starts[index] === undefined ? [] : [starts[index]]));
}

/**
 * 문서 전체를 `next`로 바꿔 끼우고 `changed` 번호의 최상위 블록을 칠한다.
 * 되돌리기 기록에 넣지 않는다 — 다른 곳의 판이 사람의 ⌘Z로 섞이지 않게
 * (`addToHistory: false`, https://prosemirror.net/docs/ref/#history.history).
 * 선택은 같은 위치 가까이에 둔다(https://prosemirror.net/docs/ref/#state.Selection^near).
 */
export function replaceDocument(next: Node, changed: readonly number[]): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const tr = state.tr.replaceWith(0, state.doc.content.size, next.content);
      const anchor = Math.min(state.selection.from, tr.doc.content.size);
      tr.setSelection(Selection.near(tr.doc.resolve(anchor)))
        .setMeta("addToHistory", false)
        .setMeta(REPLACED_META, true)
        .setMeta(liveChangedKey, topBlockPositions(tr.doc, changed));
      dispatch(tr);
    }
    return true;
  };
}

/** 이 트랜잭션이 바꿔 끼우기인가 — 사람의 고침이 아니다 */
export const isDocumentReplacement = (tr: Transaction): boolean =>
  tr.getMeta(REPLACED_META) === true;

/** 칠하기를 뗀다. 칠한 것이 없으면 false */
export const endLiveChanged: Command = (state, dispatch) => {
  const positions = liveChangedKey.getState(state)?.positions;
  if (positions === undefined || positions.length === 0) return false;
  if (dispatch) dispatch(state.tr.setMeta(liveChangedKey, []));
  return true;
};
