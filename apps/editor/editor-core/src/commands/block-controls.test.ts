import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command, Transaction } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import { history, undo } from "@tiptap/pm/history";
import {
  blockGuard,
  createEditorSchema,
  docFromNode,
  docToNode,
  duplicateTopBlock,
} from "../index";
import {
  atTopBlock,
  deleteTopBlock,
  resizedWidthPercent,
  turnTopBlockInto,
} from "./block-controls";

const schema = createEditorSchema();

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });
const docOf = (...content: unknown[]) => docToNode(schema, { type: "doc", content });

/** 커서는 첫 블록의 첫 글자 뒤 — 손잡이 블록과 커서 블록이 다른 경우를 만든다 */
function stateOf(doc: Node): EditorState {
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 2),
    plugins: [history(), blockGuard()],
  });
}

function run(command: Command, state: EditorState) {
  let tr: Transaction | null = null;
  const ok = command(state, (t) => {
    tr = t;
  });
  return { ok, next: tr === null ? null : state.apply(tr) };
}

const types = (doc: Node) => doc.content.content.map((child) => child.type.name);
const texts = (doc: Node) => doc.content.content.map((child) => child.textContent);

function undone(state: EditorState): EditorState {
  let result = state;
  undo(state, (tr) => {
    result = state.apply(tr);
  });
  return result;
}

describe("editor-block-drag: 최상위 블록을 지운다", () => {
  it("WHEN 문단 A · B · C에서 deleteTopBlock(1) 뒤 undo THEN 지운 직후는 A · C이고 커서는 C 안이며 undo 한 번에 A · B · C다", () => {
    const state = stateOf(docOf(paragraph("가"), paragraph("나"), paragraph("다")));

    const { ok, next } = run(deleteTopBlock(1), state);

    expect(ok).toBe(true);
    expect(texts(next!.doc)).toEqual(["가", "다"]);
    expect(next!.selection.$from.parent.textContent).toBe("다");
    expect(texts(undone(next!).doc)).toEqual(["가", "나", "다"]);
  });

  it("WHEN 문단 A 하나에서 deleteTopBlock(0), 또는 블록 1개 문서에서 deleteTopBlock(1) THEN 앞은 빈 문단 하나, 뒤는 false다", () => {
    const state = stateOf(docOf(paragraph("가")));

    const only = run(deleteTopBlock(0), state);
    expect(only.ok).toBe(true);
    expect(types(only.next!.doc)).toEqual(["paragraph"]);
    expect(only.next!.doc.textContent).toBe("");

    const outside = run(deleteTopBlock(1), state);
    expect(outside.ok).toBe(false);
    expect(outside.next).toBeNull();
  });
});

describe("editor-block-drag: 손잡이 블록에 커맨드를 부른다", () => {
  it("WHEN 커서가 문단 A 안인 A · B 문서에서 turnTopBlockInto(1, heading2) THEN B가 큰 제목이 되고 A는 그대로이며 docFromNode를 통과한다", () => {
    const state = stateOf(docOf(paragraph("가"), paragraph("나")));

    const { ok, next } = run(turnTopBlockInto(1, "heading2"), state);

    expect(ok).toBe(true);
    expect(types(next!.doc)).toEqual(["paragraph", "heading"]);
    expect(next!.doc.child(1).attrs.level).toBe(2);
    expect(texts(next!.doc)).toEqual(["가", "나"]);
    expect(() => docFromNode(next!.doc)).not.toThrow();
  });

  it("WHEN TipTap 체인처럼 state.tr가 늘 같은 트랜잭션을 돌려주고 dispatch는 아무것도 하지 않는 상태에서 turnTopBlockInto(1, heading2) THEN 그 공유 트랜잭션을 적용하면 B가 큰 제목이다", () => {
    const state = stateOf(docOf(paragraph("가"), paragraph("나")));
    // TipTap createChainableState와 같은 모양 — tr 게터가 체인의 트랜잭션 하나를 돌려준다
    const shared = state.tr;
    const chainLike = Object.create(state, { tr: { get: () => shared } }) as EditorState;

    const ok = turnTopBlockInto(1, "heading2")(chainLike, () => undefined);

    expect(ok).toBe(true);
    const next = state.apply(shared);
    expect(types(next.doc)).toEqual(["paragraph", "heading"]);
    expect(texts(next.doc)).toEqual(["가", "나"]);
  });

  it("WHEN 커서가 A 안인 A · B에서 atTopBlock(1, duplicateTopBlock), 또는 turnTopBlockInto(0, bulletList) THEN 앞은 A · B · B, 뒤는 A가 점 목록 안이다", () => {
    const state = stateOf(docOf(paragraph("가"), paragraph("나")));

    const duplicated = run(atTopBlock(1, duplicateTopBlock), state);
    expect(duplicated.ok).toBe(true);
    expect(texts(duplicated.next!.doc)).toEqual(["가", "나", "나"]);

    const wrapped = run(turnTopBlockInto(0, "bulletList"), state);
    expect(wrapped.ok).toBe(true);
    expect(types(wrapped.next!.doc)).toEqual(["bulletList", "paragraph"]);
    expect(texts(wrapped.next!.doc)).toEqual(["가", "나"]);
  });

  it("WHEN 구분선 블록에 turnTopBlockInto(i, heading2), 또는 범위 밖 번호 THEN false이고 dispatch하지 않는다", () => {
    const doc = docOf(paragraph("가"), { type: "horizontalRule" }, paragraph("나"));
    const state = stateOf(doc);

    const rule = run(turnTopBlockInto(1, "heading2"), state);
    expect(rule.ok).toBe(false);
    expect(rule.next).toBeNull();

    const outside = run(turnTopBlockInto(3, "heading2"), state);
    expect(outside.ok).toBe(false);
    expect(outside.next).toBeNull();
    expect(state.selection instanceof NodeSelection).toBe(false);
  });
});

describe("editor-block-resize: 가운데 기준으로 폭을 대칭 조절한다", () => {
  it("WHEN 폭 600px 본문, 시작 50%에서 오른쪽 손잡이를 30px 오른쪽으로 끈다 THEN 60이다. 왼쪽 손잡이를 30px 왼쪽으로 끌어도 60이다", () => {
    expect(
      resizedWidthPercent({
        startPercent: 50,
        startX: 400,
        x: 430,
        side: "right",
        containerWidth: 600,
      }),
    ).toBe(60);
    expect(
      resizedWidthPercent({
        startPercent: 50,
        startX: 200,
        x: 170,
        side: "left",
        containerWidth: 600,
      }),
    ).toBe(60);
  });

  it('WHEN 폭 600px 본문, 시작 50%, align: "left"에서 오른쪽 손잡이를 30px 오른쪽으로, align: "right"에서 왼쪽 손잡이를 30px 왼쪽으로 끈다 THEN 둘 다 55다', () => {
    const base = { startPercent: 50, containerWidth: 600 };
    expect(
      resizedWidthPercent({ ...base, startX: 400, x: 430, side: "right", align: "left" }),
    ).toBe(55);
    expect(
      resizedWidthPercent({ ...base, startX: 200, x: 170, side: "left", align: "right" }),
    ).toBe(55);
  });

  it("WHEN 시작 50%에서 오른쪽 손잡이를 1000px 오른쪽으로, 또는 왼쪽 손잡이를 1000px 오른쪽으로 끈다 THEN 100, 25다", () => {
    const base = { startPercent: 50, startX: 300, x: 1300, containerWidth: 600 };
    expect(resizedWidthPercent({ ...base, side: "right" })).toBe(100);
    expect(resizedWidthPercent({ ...base, side: "left" })).toBe(25);
    expect(resizedWidthPercent({ ...base, side: "right", containerWidth: 0 })).toBe(50);
  });
});
