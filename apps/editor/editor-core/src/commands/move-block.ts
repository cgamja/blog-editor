/**
 * 최상위 블록 옮기기(이슈 #43 · openspec editor-move-block). 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - ResolvedPos.index: https://prosemirror.net/docs/ref/#model.ResolvedPos.index
 * - Transform.delete / insert: https://prosemirror.net/docs/ref/#transform.Transform.delete
 * - Selection.map · StepMap.offset: https://prosemirror.net/docs/ref/#state.Selection.map ·
 *   https://prosemirror.net/docs/ref/#transform.StepMap^offset
 * - keymap: https://prosemirror.net/docs/ref/#keymap.keymap
 */
import { Extension } from "@tiptap/core";
import type { Node, ResolvedPos } from "@tiptap/pm/model";
import { keymap } from "@tiptap/pm/keymap";
import type { Command, EditorState } from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";

interface BlockRange {
  start: number;
  end: number;
}

interface MovePlan {
  neighborIndex: number;
  insertAt: number;
  /** 옮긴 범위 안 모든 위치가 움직인 거리(이웃 블록 크기, 방향 부호) */
  shift: number;
}

/** 최상위 `index`번째 블록이 시작하는 위치(블록 바로 앞) — drag-block도 쓴다 */
export function blockStart(doc: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

/** $pos가 최상위 블록의 첫 글자 자리인가 — 블록부터 텍스트 블록까지 모두 첫째 자식을 따라 내려왔는가. */
function isAtTopBlockStart($pos: ResolvedPos): boolean {
  if ($pos.depth === 0 || $pos.parentOffset !== 0) return false;
  for (let depth = 1; depth < $pos.depth; depth += 1) {
    if ($pos.index(depth) !== 0) return false;
  }
  return true;
}

/**
 * 선택이 걸친 최상위 블록 범위 [start, end). 깊이 0의 빈 선택(GapCursor)은 gap 바로 뒤 블록, 뒤가 없으면
 * 앞 블록 하나. 드래그 끝이 다음 블록 첫 글자 자리에 걸친 선택은 그 블록을 빼고 센다(design.md 1).
 */
function selectedBlockRange(state: EditorState): BlockRange | null {
  const { doc, selection } = state;
  const { $from, $to, empty } = selection;
  if (doc.childCount === 0) return null;
  if (empty && $from.depth === 0) {
    const after = $from.index(0);
    const index = after < doc.childCount ? after : after - 1;
    return { start: index, end: index + 1 };
  }
  const start = $from.index(0);
  // 깊이 0의 끝(노드 선택의 끝 경계)과 다음 블록 첫 글자에 걸친 끝은 그 블록을 포함하지 않는다
  const excludesLast = $to.depth === 0 || (!empty && isAtTopBlockStart($to));
  const end = excludesLast ? $to.index(0) : $to.index(0) + 1;
  return end > start ? { start, end } : null;
}

function planUp(doc: Node, { start, end }: BlockRange): MovePlan | null {
  const neighborIndex = start - 1;
  if (neighborIndex < 0) return null;
  const size = doc.child(neighborIndex).nodeSize;
  // 이웃을 지우면 범위가 그 크기만큼 당겨지므로, 넣을 자리(범위 끝)도 같이 당겨서 센다
  return { neighborIndex, insertAt: blockStart(doc, end) - size, shift: -size };
}

function planDown(doc: Node, { start, end }: BlockRange): MovePlan | null {
  const neighborIndex = end;
  if (neighborIndex >= doc.childCount) return null;
  const size = doc.child(neighborIndex).nodeSize;
  return { neighborIndex, insertAt: blockStart(doc, start), shift: size };
}

/**
 * 범위를 옮기는 대신 이웃 블록 하나를 지우고 반대편에 다시 넣는다 — 옮기는 블록의 노드는 그대로라
 * attrs · 스티커(블록 상대 좌표, adr-008)가 바뀔 틈이 없고, 한 트랜잭션이라 undo 한 번에 되돌아간다.
 * 선택은 옮긴 범위와 같은 거리만큼 평행 이동한다 — 선택 클래스마다 자기 map 규칙을 쓰므로 텍스트 · 노드 ·
 * GapCursor를 따로 분기하지 않는다. 기본 매핑(tr.selection)은 범위 경계의 gap을 블록에서 떼어 놓는다.
 */
function moveBlock(plan: typeof planUp): Command {
  return (state, dispatch) => {
    const { doc } = state;
    const range = selectedBlockRange(state);
    const move = range === null ? null : plan(doc, range);
    if (move === null) return false;
    if (dispatch === undefined) return true;

    const neighbor = doc.child(move.neighborIndex);
    const neighborPos = blockStart(doc, move.neighborIndex);
    const tr = state.tr
      .delete(neighborPos, neighborPos + neighbor.nodeSize)
      .insert(move.insertAt, neighbor);
    tr.setSelection(state.selection.map(tr.doc, StepMap.offset(move.shift)));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export const moveBlockUp: Command = moveBlock(planUp);
export const moveBlockDown: Command = moveBlock(planDown);

/**
 * 양 끝에서도 키를 삼킨다(true) — 커맨드 자체는 false라 can()은 맞게 나오지만, 키가 빠져나가면 macOS의
 * "Cmd-Shift-Up = 문서 끝까지 선택"이 뜻밖에 실행된다(design.md 4).
 */
export function swallowing(command: Command): Command {
  return (state, dispatch, view) => {
    command(state, dispatch, view);
    return true;
  };
}

/** prosemirror-keymap `keymap()`이 받는 모양. `Mod`는 macOS에서 Cmd, 그 밖에서 Ctrl. */
export const moveBlockKeymap: Record<string, Command> = {
  "Mod-Shift-ArrowUp": swallowing(moveBlockUp),
  "Mod-Shift-ArrowDown": swallowing(moveBlockDown),
};

/**
 * 단축키를 싣는 TipTap 확장. 스키마와 무관한 동작이라 `editorExtensions`에는 넣지 않고 에디터를 조립하는 쪽이
 * 고른다(design.md 4). https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension
 */
export const MoveBlock = Extension.create({
  name: "moveBlock",
  addProseMirrorPlugins() {
    return [keymap(moveBlockKeymap)];
  },
});
