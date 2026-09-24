import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { createEditorSchema, docFromNode, docToNode } from "../index";
import { blockGuard } from "../plugins/block-guard";
import { textStyleKeymap, textStyleMemory } from "../plugins/text-style-keymap";
import { applyLastColor, setTextStyle, textStyleSummary } from "./text-style";
import { MIXED } from "./text-style.types";

const schema = createEditorSchema();

type Content = object[];

function stateOf(blocks: object[], from: number, to = from): EditorState {
  const doc = docToNode(schema, { type: "doc", content: blocks });
  const state = EditorState.create({ doc, plugins: [blockGuard(), textStyleMemory()] });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, from, to)));
}

const paragraph = (content: Content) => ({ type: "paragraph", content });
const text = (value: string, marks?: object[]) =>
  marks === undefined ? { type: "text", text: value } : { type: "text", text: value, marks };
const styled = (value: string, attrs: object) => text(value, [{ type: "textStyle", attrs }]);

function run(command: Command, state: EditorState) {
  let next = state;
  let dispatched = 0;
  const ok = command(state, (tr) => {
    dispatched += 1;
    next = state.apply(tr);
  });
  return { ok, state: next, dispatched };
}

/** 첫 문단의 글자 조각마다 [글자, textStyle 속성 | undefined] */
function styleRuns(state: EditorState): [string, object | undefined][] {
  return state.doc.child(0).content.content.map((node) => {
    const mark = node.marks.find((candidate) => candidate.type.name === "textStyle");
    return [node.text ?? "", mark === undefined ? undefined : cleanAttrs(mark.attrs)];
  });
}

const cleanAttrs = (attrs: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(attrs).filter(([, value]) => value !== null));

describe("editor-text-style: 고른 글자의 글자 스타일 속성을 합친다", () => {
  it("WHEN 문단 글자 일부를 고르고 setTextStyle({ color: 'brand' })를 부른다 THEN true이고 그 글자에 textStyle { color: 'brand' }가 있다", () => {
    const { ok, state } = run(
      setTextStyle({ color: "brand" }),
      stateOf([paragraph([text("앞글자뒤")])], 2, 4),
    );

    expect(ok).toBe(true);
    expect(styleRuns(state)).toEqual([
      ["앞", undefined],
      ["글자", { color: "brand" }],
      ["뒤", undefined],
    ]);
  });

  it("WHEN textStyle { size: 'lg' }인 글자를 고르고 setTextStyle({ color: 'brand' })를 부른다 THEN 그 글자는 { size: 'lg', color: 'brand' }다", () => {
    const { state } = run(
      setTextStyle({ color: "brand" }),
      stateOf([paragraph([styled("글자", { size: "lg" })])], 1, 3),
    );

    expect(styleRuns(state)).toEqual([["글자", { size: "lg", color: "brand" }]]);
  });

  it("WHEN size lg 조각과 스타일 없는 조각을 함께 고르고 color를 건다 THEN 조각마다 제 속성을 지킨다", () => {
    const { state } = run(
      setTextStyle({ color: "brand" }),
      stateOf([paragraph([styled("가나", { size: "lg" }), text("다라")])], 1, 5),
    );

    expect(styleRuns(state)).toEqual([
      ["가나", { size: "lg", color: "brand" }],
      ["다라", { color: "brand" }],
    ]);
  });

  it("WHEN textStyle { color: 'brand' }인 글자를 고르고 setTextStyle({ color: null })을 부른다 THEN textStyle 마크가 없다", () => {
    const { ok, state } = run(
      setTextStyle({ color: null }),
      stateOf([paragraph([styled("글자", { color: "brand" })])], 1, 3),
    );

    expect(ok).toBe(true);
    expect(styleRuns(state)).toEqual([["글자", undefined]]);
  });

  it("WHEN setTextStyle({ color: 'pink' }) 또는 ({ color: '#FFF' })를 부른다 THEN false이고 문서는 그대로다", () => {
    const before = stateOf([paragraph([text("글자")])], 1, 3);

    for (const color of ["pink", "#FFF"]) {
      const { ok, state } = run(setTextStyle({ color }), before);
      expect(ok).toBe(false);
      expect(state.doc.eq(before.doc)).toBe(true);
    }
  });

  it("WHEN blockGuard를 단 상태에서 글꼴 · 두께 · 크기 · 글자색 · 배경색을 차례로 건다 THEN 매번 true이고 docFromNode가 결과를 받는다", () => {
    let state = stateOf([paragraph([text("글자")])], 1, 3);
    const patches = [
      { font: "pretendard" },
      { weight: "medium" },
      { size: "xl" },
      { color: "#3366aa" },
      { highlight: "mint" },
    ] as const;

    for (const patch of patches) {
      const result = run(setTextStyle(patch), state);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(() => docFromNode(state.doc)).not.toThrow();
    expect(styleRuns(state)).toEqual([
      [
        "글자",
        { font: "pretendard", weight: "medium", size: "xl", color: "#3366aa", highlight: "mint" },
      ],
    ]);
  });
});

describe("editor-text-style: 두께는 그 글꼴에 있는 것만", () => {
  it("WHEN textStyle { font: 'jua' }인 글자를 고르고 setTextStyle({ weight: 'light' })를 부른다 THEN false이고 문서는 그대로다", () => {
    const before = stateOf([paragraph([styled("글자", { font: "jua" })])], 1, 3);
    const { ok, state } = run(setTextStyle({ weight: "light" }), before);

    expect(ok).toBe(false);
    expect(state.doc.eq(before.doc)).toBe(true);
  });

  it("WHEN textStyle { weight: 'heavy' }인 글자를 고르고 setTextStyle({ font: 'gaegu' })를 부른다 THEN { font: 'gaegu' }다", () => {
    const { ok, state } = run(
      setTextStyle({ font: "gaegu" }),
      stateOf([paragraph([styled("글자", { weight: "heavy" })])], 1, 3),
    );

    expect(ok).toBe(true);
    expect(styleRuns(state)).toEqual([["글자", { font: "gaegu" }]]);
  });
});

describe("editor-text-style: 바꿀 것이 없으면 기록을 남기지 않는다", () => {
  it("WHEN textStyle { color: 'brand' }인 글자에 같은 색을 건다 THEN true이고 dispatch가 불리지 않는다", () => {
    const { ok, dispatched } = run(
      setTextStyle({ color: "brand" }),
      stateOf([paragraph([styled("글자", { color: "brand" })])], 1, 3),
    );

    expect(ok).toBe(true);
    expect(dispatched).toBe(0);
  });

  it("WHEN 빈 선택에서, 또는 코드 블록 글자를 고르고 색을 건다 THEN 둘 다 false다", () => {
    const cursor = stateOf([paragraph([text("글자")])], 2);
    const code = stateOf([{ type: "codeBlock", content: [text("const a")] }], 1, 4);

    expect(run(setTextStyle({ color: "brand" }), cursor).ok).toBe(false);
    expect(run(setTextStyle({ color: "brand" }), code).ok).toBe(false);
  });
});

describe("editor-text-style: 도구줄이 보일 값을 요약한다", () => {
  it("WHEN brand 조각과 red 조각(둘 다 굵게)을 함께 고른다 THEN color는 MIXED, size는 null, bold는 true, italic은 false, canStyle은 true다", () => {
    const bold = { type: "bold" };
    const state = stateOf(
      [
        paragraph([
          text("가나", [bold, { type: "textStyle", attrs: { color: "brand" } }]),
          text("다라", [bold, { type: "textStyle", attrs: { color: "red" } }]),
        ]),
      ],
      1,
      5,
    );
    const summary = textStyleSummary(state);

    expect(summary.color).toBe(MIXED);
    expect(summary.size).toBeNull();
    expect(summary.marks.bold).toBe(true);
    expect(summary.marks.italic).toBe(false);
    expect(summary.canStyle).toBe(true);
  });
});

describe("editor-text-style: 마지막 색을 다시 건다", () => {
  it("WHEN 한 글자에 highlight #3366aa를 건 뒤 다른 글자를 고르고 applyLastColor를 부른다 THEN 그 글자는 { highlight: '#3366aa' }다", () => {
    const first = run(
      setTextStyle({ highlight: "#3366aa" }),
      stateOf([paragraph([text("가나다라")])], 1, 2),
    ).state;
    const moved = first.apply(first.tr.setSelection(TextSelection.create(first.doc, 3, 5)));
    const { ok, state } = run(applyLastColor, moved);

    expect(ok).toBe(true);
    expect(styleRuns(state)).toEqual([
      ["가", { highlight: "#3366aa" }],
      ["나", undefined],
      ["다라", { highlight: "#3366aa" }],
    ]);
  });

  it("WHEN 색을 건 적 없는 상태에서 applyLastColor를 부른다 THEN false다", () => {
    expect(run(applyLastColor, stateOf([paragraph([text("글자")])], 1, 3)).ok).toBe(false);
  });

  it("WHEN textStyleKeymap을 본다 THEN Mod-u · Mod-Shift-s · Mod-Shift-h가 있다", () => {
    expect(Object.keys(textStyleKeymap).sort()).toEqual(["Mod-Shift-h", "Mod-Shift-s", "Mod-u"]);
  });
});
