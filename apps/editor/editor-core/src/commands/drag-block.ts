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
import type { Command } from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";

/** 최상위 블록 하나의 화면 세로 범위(getBoundingClientRect의 top · bottom). */
export interface BlockBand {
  top: number;
  bottom: number;
}

export interface InsertableBlock {
  /** 스키마 노드 이름 */
  type: string;
  attrs?: Readonly<Record<string, unknown>>;
}

/**
 * 「블록 추가」 메뉴에서 넣을 수 있는 블록 — 닫힌 목록. 값은 스키마의 닫힌 집합(HEADING_LEVELS · CALLOUT_TONES)
 * 안에서만 고른다. 그림 · 앱 스크린샷은 저장 경로가 있어야 해서 사진 올리기(M5) 뒤에 더한다.
 */
export const INSERTABLE_BLOCKS: Readonly<Record<string, InsertableBlock>> = {
  paragraph: { type: "paragraph" },
  heading2: { type: "heading", attrs: { level: 2 } },
  heading3: { type: "heading", attrs: { level: 3 } },
  bulletList: { type: "bulletList" },
  orderedList: { type: "orderedList" },
  blockquote: { type: "blockquote" },
  calloutNote: { type: "callout", attrs: { tone: "note" } },
  calloutTip: { type: "callout", attrs: { tone: "tip" } },
  calloutWarning: { type: "callout", attrs: { tone: "warning" } },
  horizontalRule: { type: "horizontalRule" },
};

function blockStart(doc: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

const isIndex = (value: number, size: number) =>
  Number.isInteger(value) && value >= 0 && value < size;

/**
 * 최상위 `from`번째 블록을 gap(0 = 맨 앞 … childCount = 맨 끝)으로 옮긴다. 노드 객체를 그대로 다시 넣으니
 * attrs · 스티커(블록 상대 좌표, adr-008)가 바뀔 틈이 없고, 한 트랜잭션이라 undo 한 번에 되돌아간다.
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
export function insertBlockAfter(index: number, kind: string): Command {
  return (state, dispatch) => {
    const { doc, schema } = state;
    const spec = Object.hasOwn(INSERTABLE_BLOCKS, kind) ? INSERTABLE_BLOCKS[kind] : undefined;
    if (spec === undefined || !isIndex(index, doc.childCount)) return false;
    const block = schema.nodes[spec.type]?.createAndFill(spec.attrs ?? null);
    if (block === undefined || block === null) return false;
    if (dispatch === undefined) return true;

    const at = blockStart(doc, index + 1);
    const tr = state.tr.insert(at, block);
    const after = at + block.nodeSize;
    if (block.isLeaf && tr.doc.nodeAt(after)?.type.name !== "paragraph") {
      tr.insert(after, schema.node("paragraph"));
    }
    const cursor = Selection.findFrom(tr.doc.resolve(at), 1, true);
    if (cursor !== null) tr.setSelection(cursor);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** y를 품은 블록 번호. 블록 사이 여백 · 바깥이면 가장 가까운 블록(같으면 앞), 블록이 없으면 null. */
export function blockIndexAt(rects: readonly BlockBand[], y: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  rects.forEach(({ top, bottom }, index) => {
    const distance = y < top ? top - y : y > bottom ? y - bottom : 0;
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
