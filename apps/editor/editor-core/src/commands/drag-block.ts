/**
 * 블록 손잡이(이슈 #59 · openspec block-drag-handle)가 부르는 커맨드와 기하 계산. 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - Transform.delete / insert: https://prosemirror.net/docs/ref/#transform.Transform.delete
 * - Selection.map · StepMap.offset: https://prosemirror.net/docs/ref/#state.Selection.map ·
 *   https://prosemirror.net/docs/ref/#transform.StepMap^offset
 * - NodeType.createAndFill: https://prosemirror.net/docs/ref/#model.NodeType.createAndFill
 * - Selection.findFrom: https://prosemirror.net/docs/ref/#state.Selection^findFrom
 */
import type { Node } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";
import { INSERTABLE_BLOCKS } from "./drag-block.constants";
import type { InsertableBlockKind } from "./drag-block.constants";
import type { BlockBand, InsertableBlock } from "./drag-block.types";
import { blockStart } from "./move-block";
import { createTable } from "./table";
import { NEW_TABLE_SIZE } from "./table.constants";
import { carriedAttrs } from "./turn-into";

const isIndex = (value: number, size: number) =>
  Number.isInteger(value) && value >= 0 && value < size;

/**
 * 최상위 `from`번째 블록을 gap(0 = 맨 앞 … childCount = 맨 끝)으로 옮긴다. 노드 객체를 그대로 다시 넣으니
 * attrs · 스티커(블록 상대 좌표, adr-008)가 바뀔 틈이 없고, 한 트랜잭션이라 undo 한 번에 되돌아간다.
 * HTML5 DnD의 Slice 붙여넣기 경로(정규화)를 타지 않으니 꾸미기가 걸러지지 않는다.
 * 선택이 옮긴 블록 안이면 같은 거리만큼 평행 이동하고(#43과 같은 방식), 그 밖이면 기본 매핑을 따른다.
 */
export function moveTopBlockTo(from: number, gap: number): Command {
  return (state, dispatch) => {
    const { doc, selection } = state;
    const count = doc.childCount;
    if (!isIndex(from, count) || !Number.isInteger(gap) || gap < 0 || gap > count) return false;
    if (gap === from || gap === from + 1) return false;
    if (dispatch === undefined) return true;

    const block = doc.child(from);
    const start = blockStart(doc, from);
    const end = start + block.nodeSize;
    // 지운 뒤 좌표 — 뒤로 가면 지운 크기만큼 당겨진다
    const insertAt = gap > from ? blockStart(doc, gap) - block.nodeSize : blockStart(doc, gap);
    const tr = state.tr.delete(start, end).insert(insertAt, block);
    if (selection.from >= start && selection.to <= end) {
      tr.setSelection(selection.map(tr.doc, StepMap.offset(insertAt - start)));
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * 최상위 `index`번째 블록 바로 뒤에 `kind`의 빈 블록을 넣고 커서를 그 안 첫 글자 자리에 둔다.
 * 글자를 품지 않는 블록(구분선)이면 바로 뒤가 문단이 아닐 때 이어 쓸 빈 문단을 두고 거기에 커서를 둔다
 * (insertAppScreenshot과 같은 규칙).
 */
export function insertBlockAfter(index: number, kind: InsertableBlockKind): Command {
  return (state, dispatch) => {
    const { doc } = state;
    if (!isIndex(index, doc.childCount)) return false;
    const block = insertableBlock(state, kind, null);
    if (block === null) return false;
    if (dispatch === undefined) return true;

    const at = blockStart(doc, index + 1);
    dispatch(placeBlock(state.tr.insert(at, block), at, block).scrollIntoView());
    return true;
  };
}

/**
 * 최상위 `index`번째 빈 문단 자리를 `kind`의 빈 블록으로 바꾼다(슬래시 메뉴, spec: editor-slash-menu).
 * 문단의 꾸미기는 새 블록이 자리를 가진 것만 옮긴다(carriedAttrs — 스티커가 사라지지 않게).
 * 커서 규칙은 insertBlockAfter와 같다. 빈 문단이 아니면 false.
 */
export function replaceEmptyTopParagraph(index: number, kind: InsertableBlockKind): Command {
  return (state, dispatch) => {
    const { doc } = state;
    if (!isIndex(index, doc.childCount)) return false;
    const old = doc.child(index);
    if (old.type.name !== "paragraph" || old.content.size > 0) return false;
    const block = insertableBlock(state, kind, old);
    if (block === null) return false;
    if (dispatch === undefined) return true;

    const at = blockStart(doc, index);
    const tr = state.tr.replaceWith(at, at + old.nodeSize, block);
    dispatch(placeBlock(tr, at, block).scrollIntoView());
    return true;
  };
}

/** `kind`의 빈 블록. `from`이 있으면 그 블록의 꾸미기를 옮긴다. 목록 밖 kind면 null */
function insertableBlock(state: EditorState, kind: InsertableBlockKind, from: Node | null) {
  // 타입이 막아도 실행 중에는 문자열이 올 수 있다 — 목록 밖이면 거부
  if (!Object.hasOwn(INSERTABLE_BLOCKS, kind)) return null;
  const spec: InsertableBlock = INSERTABLE_BLOCKS[kind];
  const type = state.schema.nodes[spec.type];
  if (type === undefined) return null;
  const attrs = from === null ? (spec.attrs ?? null) : carriedAttrs(from, type, spec.attrs ?? null);
  // createAndFill은 표를 1×1로 채운다 — 머리 행 + 본문 행이 있는 크기로 만든다(spec: editor-table)
  if (type.spec.tableRole === "table") {
    return createTable(state.schema, NEW_TABLE_SIZE.rows, NEW_TABLE_SIZE.columns, attrs);
  }
  return type.createAndFill(attrs);
}

/**
 * `at`에 막 놓인 블록 안 첫 글자 자리에 커서를 둔다. 글자를 품지 않는 블록(구분선)이면 바로 뒤가 문단이 아닐 때
 * 이어 쓸 빈 문단을 두고 거기에 둔다(insertAppScreenshot과 같은 규칙).
 */
function placeBlock(tr: Transaction, at: number, block: Node): Transaction {
  const after = at + block.nodeSize;
  if (block.isLeaf && tr.doc.nodeAt(after)?.type.name !== "paragraph") {
    tr.insert(after, tr.doc.type.schema.node("paragraph"));
  }
  const cursor = Selection.findFrom(tr.doc.resolve(at), 1, true);
  if (cursor !== null) tr.setSelection(cursor);
  return tr;
}

/** y를 품은 블록 번호. 블록 사이 여백 · 바깥이면 가장 가까운 블록(같으면 앞), 블록이 없으면 null. */
export function blockIndexAt(rects: readonly BlockBand[], y: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  rects.forEach(({ top, bottom }, index) => {
    const distance = Math.max(top - y, y - bottom, 0);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** 놓일 gap — 세로 중앙이 y보다 위인 블록의 개수. 블록 위쪽 절반이면 그 앞, 아래쪽 절반이면 그 뒤. */
export function dropGapAt(rects: readonly BlockBand[], y: number): number {
  return rects.filter(({ top, bottom }) => (top + bottom) / 2 < y).length;
}
