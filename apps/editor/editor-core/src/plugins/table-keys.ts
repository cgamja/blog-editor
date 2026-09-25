/**
 * 표 편집 — spec: editor-table, adr-028. prosemirror-tables `tableEditing()`(칸 선택 · 칸 복사/붙여넣기 · 표 모양
 * 고치기)에 우리 키(Tab · Shift+Tab · Enter)와 열 정렬 장식을 더한다. 등록만 한다(adr-002).
 * - tableEditing은 방향키 · 마우스를 넓게 받아 "플러그인 목록 끝 쪽(near the end)"에 두라고 README가 권한다 —
 *   그래서 키맵 · 장식(TableKeys)과 따로, 가장 낮은 우선순위 확장(TableEditing)으로 싣는다.
 *   https://github.com/ProseMirror/prosemirror-tables#documentation
 * - 한글 조합 중 keydown은 prosemirror-view가 handleKeyDown에 넘기기 전에 버린다 — 1.42.5
 *   editHandlers.keydown의 `if (inOrNearComposition(view, event)) return`
 *   https://github.com/ProseMirror/prosemirror-view/blob/1.42.5/src/input.ts#L110 (list-keymap과 같다)
 * - 노드 장식: https://prosemirror.net/docs/ref/#view.Decoration^node
 */
import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { keymap } from "@tiptap/pm/keymap";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { tableEditing } from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { enterInTable, nextCellOrNewRow, previousCell } from "../commands/table";
import { TABLE_EDITING_PRIORITY, TABLE_KEYS_PRIORITY } from "../keymap-priority.constants";

export const tableKeymap: Record<string, Command> = {
  Tab: nextCellOrNewRow,
  "Shift-Tab": previousCell,
  Enter: enterInTable,
};

const ALIGN_DOM_ATTR = "data-align";

/** 표 하나의 본문 칸에 머리 행 칸의 열 정렬을 장식으로 단다 — 저장은 머리 행 칸에만 있다(adr-028) */
function alignDecorations(table: Node, tablePos: number): Decoration[] {
  const head = table.firstChild;
  if (head === null) return [];
  const aligns = Array.from({ length: head.childCount }, (_, col) => head.child(col).attrs.align);
  const decorations: Decoration[] = [];
  let rowPos = tablePos + 1 + head.nodeSize;
  for (let row = 1; row < table.childCount; row += 1) {
    const rowNode = table.child(row);
    let cellPos = rowPos + 1;
    rowNode.forEach((cell, _offset, col) => {
      const align = aligns[col];
      if (align != null) {
        decorations.push(
          Decoration.node(cellPos, cellPos + cell.nodeSize, { [ALIGN_DOM_ATTR]: String(align) }),
        );
      }
      cellPos += cell.nodeSize;
    });
    rowPos += rowNode.nodeSize;
  }
  return decorations;
}

export const tableColumnAlignKey = new PluginKey("tableColumnAlign");

/** 에디터에서도 열 정렬이 본문 칸에 보이게 한다 — 표는 최상위에만 있다 */
export function tableColumnAlign(): Plugin {
  return new Plugin({
    key: tableColumnAlignKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.forEach((node, pos) => {
          if (node.type.spec.tableRole === "table")
            decorations.push(...alignDecorations(node, pos));
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

/** 우리 키맵 · 열 정렬 장식 — 목록 키와 같은 층(TABLE_KEYS_PRIORITY) */
export function tableKeyPlugins(): Plugin[] {
  return [keymap(tableKeymap), tableColumnAlign()];
}

/** ProseMirror만으로 쓸 때의 순서 그대로 — 키맵 · 장식 뒤에 tableEditing(README "near the end") */
export function tablePlugins(): Plugin[] {
  return [...tableKeyPlugins(), tableEditing()];
}

export const TableKeys = Extension.create({
  name: "tableKeys",
  priority: TABLE_KEYS_PRIORITY,
  addProseMirrorPlugins: () => tableKeyPlugins(),
});

/** 칸 선택 · 칸 복사/붙여넣기 · 표 모양 고치기 — 다른 확장의 키 · 붙여넣기 처리가 먼저 돌게 가장 뒤에 */
export const TableEditing = Extension.create({
  name: "tableEditing",
  priority: TABLE_EDITING_PRIORITY,
  addProseMirrorPlugins: () => [tableEditing()],
});
