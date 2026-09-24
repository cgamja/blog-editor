/**
 * 최상위 블록 옮기기(이슈 #43 · openspec editor-move-block). 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - ResolvedPos.index: https://prosemirror.net/docs/ref/#model.ResolvedPos.index
 * - Transform.delete / insert: https://prosemirror.net/docs/ref/#transform.Transform.delete
 * - Selection.fromJSON: https://prosemirror.net/docs/ref/#state.Selection^fromJSON
 * - keymap: https://prosemirror.net/docs/ref/#keymap.keymap
 */
import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { keymap } from "@tiptap/pm/keymap";
import { Selection } from "@tiptap/pm/state";
import type { Command, EditorState } from "@tiptap/pm/state";

type Direction = "up" | "down";

/** 선택이 걸친 최상위 블록 범위 [start, end). 노드 선택의 끝은 블록 뒤 경계(깊이 0)라 그 블록은 빼고 센다. */
function selectedBlockRange(state: EditorState): { start: number; end: number } {
  const { $from, $to } = state.selection;
  const start = $from.index(0);
  const end = $to.depth === 0 ? $to.index(0) : $to.index(0) + 1;
  return { start, end: Math.max(end, start + 1) };
}

function blockStart(doc: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

/** 선택 JSON의 위치 값(anchor · head)만 옮긴다 — 텍스트 선택 · 노드 선택을 따로 분기하지 않으려고. */
function shiftSelectionJson(json: Record<string, unknown>, by: number): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(json).map(([key, value]) => [
      key,
      (key === "anchor" || key === "head") && typeof value === "number" ? value + by : value,
    ]),
  );
}

/**
 * 범위를 옮기는 대신 이웃 블록 하나를 지우고 반대편에 다시 넣는다 — 옮기는 블록의 노드는 그대로라
 * attrs · 스티커(블록 상대 좌표, adr-008)가 바뀔 틈이 없고, 한 트랜잭션이라 undo 한 번에 되돌아간다.
 */
function moveBlock(direction: Direction): Command {
  return (state, dispatch) => {
    const { doc } = state;
    const { start, end } = selectedBlockRange(state);
    const neighborIndex = direction === "up" ? start - 1 : end;
    if (neighborIndex < 0 || neighborIndex >= doc.childCount) return false;
    if (dispatch === undefined) return true;

    const neighbor = doc.child(neighborIndex);
    const neighborPos = blockStart(doc, neighborIndex);
    const tr = state.tr.delete(neighborPos, neighborPos + neighbor.nodeSize);
    // 지운 뒤의 좌표: 위로면 범위가 neighbor 크기만큼 당겨져 범위 끝 = 원래 범위 끝 - 크기, 아래로면 범위 시작 그대로
    const insertAt =
      direction === "up" ? blockStart(doc, end) - neighbor.nodeSize : blockStart(doc, start);
    tr.insert(insertAt, neighbor);

    const shift = direction === "up" ? -neighbor.nodeSize : neighbor.nodeSize;
    const selectionJson = state.selection.toJSON() as Record<string, unknown>;
    tr.setSelection(Selection.fromJSON(tr.doc, shiftSelectionJson(selectionJson, shift)));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export const moveBlockUp: Command = moveBlock("up");
export const moveBlockDown: Command = moveBlock("down");

/** prosemirror-keymap `keymap()`이 받는 모양. `Mod`는 macOS에서 Cmd, 그 밖에서 Ctrl. */
export const moveBlockKeymap: Record<string, Command> = {
  "Mod-Shift-ArrowUp": moveBlockUp,
  "Mod-Shift-ArrowDown": moveBlockDown,
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
