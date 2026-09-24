import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command, Selection } from "@tiptap/pm/state";
import { GapCursor } from "@tiptap/pm/gapcursor";
import type { Node } from "@tiptap/pm/model";
import { CAPTION_MAX_LENGTH } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import {
  backspaceAfterCustomBlock,
  createEditorSchema,
  docFromNode,
  docToNode,
  insertAppScreenshot,
  insertCallout,
  setCalloutTone,
} from "../index";

// ── 문서 · 상태 도구 (EditorState만 — DOM · EditorView 없음) ──

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const text = (value: string): Json => ({ type: "text", text: value });
const paragraph = (value = "", attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  ...(value === "" ? {} : { content: [text(value)] }),
});
const heading = (value: string): Json => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
});
const bulletList = (...items: string[]): Json => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
});
const callout = (tone: string, children: Json[], decoration: Json = {}): Json => ({
  type: "callout",
  attrs: { tone, ...decoration },
  content: children,
});
const appScreenshot = (): Json => ({
  type: "appScreenshot",
  attrs: { src: "/images/app.webp", caption: "화면" },
});
const doc = (...blocks: Json[]): Json => ({ type: "doc", content: blocks });

/** 최상위 블록 index 바로 앞 위치 */
function blockStart(node: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += node.child(i).nodeSize;
  return pos;
}

type Place = (node: Node) => Selection;

// 최상위 블록 index의 첫 텍스트 자리 + offset(문단 · 제목은 한 겹, 콜아웃 · 목록 첫 항목은 더 깊다)
const at =
  (index: number, depth = 1, offset = 0): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, index) + depth + offset);
const inCallout = (index: number) => at(index, 2);
const inFirstListItem = (index: number) => at(index, 3);
const atDocEnd: Place = (node) => new GapCursor(node.resolve(node.content.size));

function stateAt(raw: Json, place: Place): EditorState {
  const node = docToNode(schema, raw);
  return EditorState.create({ doc: node, selection: place(node) });
}

interface CommandRun {
  ok: boolean;
  dispatched: boolean;
  state: EditorState;
  /** 결과 문서를 저장 형식으로 — 저장할 수 없는 문서면 docFromNode가 던진다(모든 커맨드가 지킬 불변식) */
  saved: Doc;
}

function run(state: EditorState, command: Command): CommandRun {
  let next = state;
  let dispatched = false;
  const ok = command(state, (tr) => {
    dispatched = true;
    next = state.apply(tr);
  });
  return { ok, dispatched, state: next, saved: docFromNode(next.doc) };
}

const types = (saved: Doc) => saved.content.map((block) => block.type);

function expectUnchanged(state: EditorState, result: CommandRun) {
  expect(result.ok).toBe(false);
  expect(result.dispatched).toBe(false);
  expect(result.state.doc.eq(state.doc)).toBe(true);
}

function expectNodeSelected(result: CommandRun, type: string) {
  expect(result.state.selection).toBeInstanceOf(NodeSelection);
  expect((result.state.selection as NodeSelection).node.type.name).toBe(type);
}

// ── 시나리오 ──

describe("editor-custom-blocks: 콜아웃을 넣고 종류를 바꾼다", () => {
  it('WHEN 빈 문단에서 insertCallout("tip") THEN 그 자리가 빈 문단 하나 든 콜아웃이고 커서가 그 안이다', () => {
    const result = run(stateAt(doc(paragraph("가"), paragraph()), at(1)), insertCallout("tip"));

    expect(result.ok).toBe(true);
    expect(result.saved.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "가" }] },
      { type: "callout", attrs: { tone: "tip" }, content: [{ type: "paragraph" }] },
    ]);
    const { $from } = result.state.selection;
    expect($from.node(1).type.name).toBe("callout");
    expect($from.parent.type.name).toBe("paragraph");
  });

  it('WHEN 글이 있는 문단에서 insertCallout("note") THEN 원래 문단은 그대로이고 바로 뒤에 콜아웃이 있다', () => {
    const result = run(
      stateAt(doc(paragraph("가"), paragraph("나")), at(0, 1, 1)),
      insertCallout("note"),
    );

    expect(result.ok).toBe(true);
    expect(types(result.saved)).toEqual(["paragraph", "callout", "paragraph"]);
    expect(result.saved.content[0]).toEqual(paragraph("가"));
  });

  it('WHEN font가 붙은 빈 문단에서 insertCallout("note") THEN 그 문단은 그대로이고 바로 뒤에 콜아웃이 있다', () => {
    const result = run(
      stateAt(doc(paragraph("", { font: "gaegu" })), at(0)),
      insertCallout("note"),
    );

    expect(result.ok).toBe(true);
    expect(types(result.saved)).toEqual(["paragraph", "callout"]);
    expect(result.saved.content[0]).toEqual(paragraph("", { font: "gaegu" }));
  });

  it('WHEN 앱 스크린샷으로 끝나는 문서의 끝 틈에서 insertCallout("note") THEN 마지막 블록이 콜아웃이다', () => {
    const result = run(
      stateAt(doc(paragraph("가"), appScreenshot()), atDocEnd),
      insertCallout("note"),
    );

    expect(result.ok).toBe(true);
    expect(types(result.saved)).toEqual(["paragraph", "appScreenshot", "callout"]);
  });

  it.each([
    [
      '콜아웃 안에서 insertCallout("note")',
      doc(callout("note", [paragraph("가")])),
      inCallout(0),
      "note",
    ],
    ['문단에서 insertCallout("bogus")', doc(paragraph("가")), at(0), "bogus"],
  ])("WHEN %s THEN false이고 문서가 그대로다", (_name, raw, place, tone) => {
    const state = stateAt(raw, place);
    expectUnchanged(state, run(state, insertCallout(tone)));
  });

  it('WHEN font가 있는 콜아웃 안에서 setCalloutTone("warning") THEN tone만 바뀌고 font는 그대로다', () => {
    const state = stateAt(doc(callout("note", [paragraph("가")], { font: "gaegu" })), inCallout(0));
    const result = run(state, setCalloutTone("warning"));

    expect(result.ok).toBe(true);
    expect(result.saved.content[0]).toMatchObject({
      type: "callout",
      attrs: { tone: "warning", font: "gaegu" },
    });
  });

  it('WHEN 일반 문단에서 setCalloutTone("warning") THEN false이고 문서가 그대로다', () => {
    const state = stateAt(doc(paragraph("가")), at(0));
    expectUnchanged(state, run(state, setCalloutTone("warning")));
  });
});

describe("editor-custom-blocks: 앱 스크린샷을 넣는다", () => {
  const valid = { src: "/images/app.webp", caption: "알림 화면" };

  it("WHEN 두 문단 사이 빈 문단에서 insertAppScreenshot THEN 그 자리가 스크린샷이고 커서가 다음 문단 맨 앞이다", () => {
    const result = run(
      stateAt(doc(paragraph("가"), paragraph(), paragraph("나")), at(1)),
      insertAppScreenshot(valid),
    );

    expect(result.ok).toBe(true);
    expect(types(result.saved)).toEqual(["paragraph", "appScreenshot", "paragraph"]);
    const { $from } = result.state.selection;
    expect($from.index(0)).toBe(2);
    expect($from.parentOffset).toBe(0);
    expect($from.parent.textContent).toBe("나");
  });

  it.each([
    ["마지막 문단", doc(paragraph("가")), ["paragraph", "appScreenshot", "paragraph"]],
    [
      "콜아웃 바로 앞 문단",
      doc(paragraph("가"), callout("note", [paragraph("나")])),
      ["paragraph", "appScreenshot", "paragraph", "callout"],
    ],
  ])(
    "WHEN %s에서 insertAppScreenshot THEN 스크린샷 뒤에 빈 문단이 생기고 커서가 거기 있다",
    (_name, raw, expected) => {
      const result = run(stateAt(raw, at(0, 1, 1)), insertAppScreenshot(valid));

      expect(result.ok).toBe(true);
      expect(types(result.saved)).toEqual(expected);
      expect(result.saved.content[2]).toEqual({ type: "paragraph" });
      const { $from } = result.state.selection;
      expect($from.index(0)).toBe(2);
      expect($from.parent.type.name).toBe("paragraph");
    },
  );

  it.each([
    ["절대 URL src", { src: "https://evil.example/a.webp", caption: "" }],
    ["너무 긴 caption", { src: "/images/app.webp", caption: "가".repeat(CAPTION_MAX_LENGTH + 1) }],
  ])("WHEN %s로 insertAppScreenshot THEN false이고 문서가 그대로다", (_name, attrs) => {
    const state = stateAt(doc(paragraph("가")), at(0));
    expectUnchanged(state, run(state, insertAppScreenshot(attrs)));
  });
});

describe("editor-custom-blocks: 커스텀 블록 바로 뒤 Backspace는 블록을 고른다", () => {
  it("WHEN 콜아웃 바로 뒤 빈 문단 맨 앞에서 backspaceAfterCustomBlock THEN 빈 문단이 없어지고 콜아웃이 노드 선택이다", () => {
    const result = run(
      stateAt(doc(callout("note", [paragraph("가")]), paragraph()), at(1)),
      backspaceAfterCustomBlock,
    );

    expect(result.ok).toBe(true);
    expect(types(result.saved)).toEqual(["callout"]);
    expectNodeSelected(result, "callout");
  });

  it.each([
    ["콜아웃 뒤 문단", callout("note", [paragraph("가")]), paragraph("나"), at(1)],
    ["앱 스크린샷 뒤 문단", appScreenshot(), paragraph("나"), at(1)],
    ["콜아웃 뒤 제목", callout("note", [paragraph("가")]), heading("나"), at(1)],
    [
      "콜아웃 뒤 목록",
      callout("note", [paragraph("가")]),
      bulletList("나", "다"),
      inFirstListItem(1),
    ],
  ])(
    "WHEN %s의 첫 글자 자리에서 실행 THEN 문서가 그대로이고 앞 블록이 노드 선택이다",
    (_name, before, block, place) => {
      const state = stateAt(doc(before, block), place);
      const result = run(state, backspaceAfterCustomBlock);

      expect(result.ok).toBe(true);
      expect(result.state.doc.eq(state.doc)).toBe(true);
      expectNodeSelected(result, before.type as string);
    },
  );

  it.each([
    ["일반 문단 뒤 문단 맨 앞", doc(paragraph("가"), paragraph("나")), at(1)],
    [
      "콜아웃 뒤 문단의 중간",
      doc(callout("note", [paragraph("가")]), paragraph("나다")),
      at(1, 1, 1),
    ],
  ])("WHEN %s에서 실행 THEN false이고 문서가 그대로다", (_name, raw, place) => {
    const state = stateAt(raw, place);
    expectUnchanged(state, run(state, backspaceAfterCustomBlock));
  });
});
