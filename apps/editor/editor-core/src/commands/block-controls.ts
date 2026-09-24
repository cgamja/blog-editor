/**
 * 블록 손잡이 메뉴 · 폭 손잡이(이슈 #81, openspec block-controls)가 부르는 커맨드와 계산. 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - Selection.findFrom · NodeSelection.create: https://prosemirror.net/docs/ref/#state.Selection^findFrom
 * - EditorState.create(선택만 다른 상태): https://prosemirror.net/docs/ref/#state.EditorState^create
 * - Transform.step · Selection.map: https://prosemirror.net/docs/ref/#transform.Transform.step
 * - Transform.delete · replaceWith: https://prosemirror.net/docs/ref/#transform.Transform.delete
 */
import { EditorState, NodeSelection, Selection } from "@tiptap/pm/state";
import type { Command, Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import type { Node } from "@tiptap/pm/model";
import { WIDTH_RANGE } from "@blog-editor/content-schema";
import { TURN_INTO_TARGETS } from "./block-controls.constants";
import type { TurnIntoKind } from "./block-controls.constants";
import type { TurnIntoTarget, WidthDrag } from "./block-controls.types";
import { blockStart } from "./move-block";
import { turnIntoTextblock } from "./turn-into";
import { wrapInBlockquote, wrapInBulletList, wrapInOrderedList } from "./wrap";

const PERCENT = 100;
/** 가운데 정렬 블록은 한쪽을 dx 끌면 양쪽이 함께 dx씩 — 폭은 2dx 바뀐다(design.md 6) */
const SYMMETRIC = 2;

const WRAPPERS: Record<Extract<TurnIntoTarget, { via: "wrap" }>["wrapper"], Command> = {
  bulletList: wrapInBulletList,
  orderedList: wrapInOrderedList,
  blockquote: wrapInBlockquote,
};

const isTopIndex = (doc: Node, index: number) =>
  Number.isInteger(index) && index >= 0 && index < doc.childCount;

/**
 * 최상위 `index`번째 블록을 지우고 커서를 그 자리 블록(맨 끝이었으면 앞 블록 끝)에 둔다.
 * 문서는 블록이 하나 이상이어야 해서(doc: block+) 마지막 하나면 빈 문단으로 바꾼다.
 */
export function deleteTopBlock(index: number): Command {
  return (state, dispatch) => {
    const { doc, schema } = state;
    if (!isTopIndex(doc, index)) return false;
    if (dispatch === undefined) return true;

    const start = blockStart(doc, index);
    const end = start + doc.child(index).nodeSize;
    const tr =
      doc.childCount === 1
        ? state.tr.replaceWith(start, end, schema.nodes.paragraph!.create())
        : state.tr.delete(start, end);
    const $at = tr.doc.resolve(Math.min(start, tr.doc.content.size));
    const selection = Selection.findFrom($at, 1) ?? Selection.findFrom($at, -1);
    if (selection !== null) tr.setSelection(selection);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** 그 블록 안 선택 — 글자를 품으면 첫 글자 자리, atom(그림 · 구분선)이면 노드 선택 */
function selectionInTopBlock(doc: Node, index: number): Selection {
  const start = blockStart(doc, index);
  const block = doc.child(index);
  if (block.isAtom) return NodeSelection.create(doc, start);
  return Selection.findFrom(doc.resolve(start + 1), 1, true) ?? NodeSelection.create(doc, start);
}

/**
 * 선택을 최상위 `index`번째 블록으로 옮긴 상태로 `command`를 부른다(design.md 5). 블록 바꾸기 · 감싸기 · 복제는
 * 선택이 든 블록에 작동하는데, 손잡이 블록은 커서와 다를 수 있다.
 * 안쪽 커맨드가 만든 step은 `state.tr`에 옮겨 담아 보낸다 — TipTap 체인은 `state.tr`로 공유 트랜잭션을 주고
 * 커맨드가 부른 dispatch는 무시한 채 그 공유 트랜잭션만 적용하기 때문이다
 * (https://tiptap.dev/docs/editor/api/commands#chain-commands). 선택만 다른 상태라 문서가 같아 step이 그대로 맞는다.
 * 되돌리면 커서는 원래 자리로 돌아온다.
 */
export function atTopBlock(index: number, command: Command): Command {
  return (state, dispatch) => {
    if (!isTopIndex(state.doc, index)) return false;
    // state.tr를 건드리지 않고 만든다 — 체인에서는 공유 트랜잭션이라 can()만 물어도 선택이 바뀐다
    const selected = EditorState.create({
      doc: state.doc,
      selection: selectionInTopBlock(state.doc, index),
      plugins: state.plugins,
    });
    const inner: Transaction[] = [];
    const ok = command(selected, dispatch === undefined ? undefined : (tr) => inner.push(tr));
    if (!ok || dispatch === undefined || inner.length === 0) return ok;

    const tr = state.tr;
    for (const innerTr of inner) for (const step of innerTr.steps) tr.step(step);
    const last = inner.at(-1)!;
    tr.setSelection(last.selection.map(tr.doc, new Mapping()));
    if (last.scrolledIntoView) tr.scrollIntoView();
    dispatch(tr);
    return true;
  };
}

/** 블록 메뉴 「바꾸기」 — 최상위 `index`번째 블록을 `kind`로. 바꿀 수 없으면(구분선 · 이미 그 모양 등) false */
export function turnTopBlockInto(index: number, kind: TurnIntoKind): Command {
  // 타입이 막아도 실행 중에는 문자열이 올 수 있다 — 목록 밖이면 거부
  if (!Object.hasOwn(TURN_INTO_TARGETS, kind)) return () => false;
  const target: TurnIntoTarget = TURN_INTO_TARGETS[kind];
  const command =
    target.via === "textblock"
      ? turnIntoTextblock(target.type, target.attrs ?? null)
      : WRAPPERS[target.wrapper];
  return atTopBlock(index, command);
}

/** 폭 손잡이를 끈 만큼의 새 폭(%) — 반올림하고 WIDTH_RANGE 끝에서 멈춘다(UI 입력이라 잘라도 된다, design.md 6) */
export function resizedWidthPercent({
  startPercent,
  startX,
  x,
  side,
  containerWidth,
}: WidthDrag): number {
  if (containerWidth <= 0) return startPercent;
  const direction = side === "right" ? 1 : -1;
  const delta = (((x - startX) * direction * SYMMETRIC) / containerWidth) * PERCENT;
  return Math.min(WIDTH_RANGE.max, Math.max(WIDTH_RANGE.min, Math.round(startPercent + delta)));
}
