import { toggleMark } from "@tiptap/pm/commands";
import type { Mark, Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { docSchema } from "@blog-editor/content-schema";
import {
  blockGuard,
  createEditorSchema,
  docFromNode,
  hardBreakOrEnter,
  insertHardBreak,
  turnIntoTextblock,
} from "../index";

const schema = createEditorSchema();
const paragraph = schema.nodes.paragraph!;
const bold = schema.marks.bold!;

/** 문서를 만들고 커서를 `at`(문서 안 위치)에 둔 상태 */
function stateAt(blocks: Node[], at: number): EditorState {
  const doc = schema.nodes.doc!.create(null, blocks);
  const state = EditorState.create({ schema, doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, at)));
}

function run(state: EditorState, command: Command = insertHardBreak) {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

const hardBreakNode = () => schema.nodes.hardBreak!.create();

/** 문단 가 · hardBreak · 나 */
const brokenParagraph = () =>
  paragraph.create(null, [schema.text("가"), hardBreakNode(), schema.text("나")]);

describe("editor-hard-break: 문단에서 Shift+Enter는 강제 줄바꿈을 넣는다", () => {
  it("WHEN 문단 가나 사이에서 insertHardBreak를 실행한다 THEN 문단이 가 · hardBreak · 나이고 커서는 나 앞이다", () => {
    const { ok, state } = run(stateAt([paragraph.create(null, schema.text("가나"))], 2));

    expect(ok).toBe(true);
    expect(docFromNode(state.doc).content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "가" },
          { type: "hardBreak" },
          { type: "text", text: "나" },
        ],
      },
    ]);
    expect(state.selection.from).toBe(3);
  });

  it("WHEN 굵은 가 끝에서 insertHardBreak를 실행하고 저장 경계를 지난다 THEN docSchema를 통과하고 hardBreak에 marks가 없다", () => {
    const start = stateAt(
      [paragraph.create(null, [schema.text("가", [bold.create()]), schema.text("나")])],
      2,
    );
    const { ok, state } = run(start);

    const saved = docFromNode(state.doc);
    expect(ok).toBe(true);
    expect(docSchema.safeParse(saved).success).toBe(true);
    const first = saved.content[0];
    expect(first?.type === "paragraph" && first.content?.[1]).toEqual({ type: "hardBreak" });
  });

  it("WHEN 굵은 가 끝에서 insertHardBreak를 실행하고 나를 친다 THEN 나도 굵다", () => {
    const start = stateAt([paragraph.create(null, schema.text("가", [bold.create()]))], 2);
    const { ok, state } = run(start);

    const typed = state.apply(state.tr.insertText("나"));

    expect(ok).toBe(true);
    expect(docFromNode(typed.doc).content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "가", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          { type: "text", text: "나", marks: [{ type: "bold" }] },
        ],
      },
    ]);
  });

  it("WHEN 제목 · 코드 블록 · 표 칸 안에서 insertHardBreak를 실행한다 THEN 세 경우 모두 false이고 문서가 그대로다", () => {
    const heading = schema.nodes.heading!.create({ level: 2 }, schema.text("제목"));
    const code = schema.nodes.codeBlock!.create(null, schema.text("code"));
    const cell = schema.nodes.tableCell!.create(null, paragraph.create(null, schema.text("칸")));
    const table = schema.nodes.table!.create(null, schema.nodes.tableRow!.create(null, cell));

    for (const [block, at] of [
      [heading, 2],
      [code, 2],
      [table, 4],
    ] as const) {
      const state = stateAt([block], at);
      const result = run(state);
      expect(result.ok).toBe(false);
      expect(result.state.doc.eq(state.doc)).toBe(true);
    }
  });
});

describe("editor-hard-break: Shift+Enter는 문단 밖에서 Enter와 같고 표 칸에서는 삼킨다", () => {
  it("WHEN 표 칸 안에서 hardBreakOrEnter를 실행한다 THEN true이고 문서가 그대로다", () => {
    const cell = schema.nodes.tableCell!.create(null, paragraph.create(null, schema.text("칸")));
    const table = schema.nodes.table!.create(null, schema.nodes.tableRow!.create(null, cell));
    const state = stateAt([table], 4);

    const result = run(state, hardBreakOrEnter);

    expect(result.ok).toBe(true);
    expect(result.state.doc.eq(state.doc)).toBe(true);
  });

  it("WHEN 제목 끝에서 hardBreakOrEnter를 실행한다 THEN 제목이 끝나고 새 문단이 생긴다", () => {
    const heading = schema.nodes.heading!.create({ level: 2 }, schema.text("제목"));

    const result = run(stateAt([heading], 3), hardBreakOrEnter);

    expect(result.ok).toBe(true);
    expect(docFromNode(result.state.doc).content).toEqual([
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "제목" }] },
      { type: "paragraph" },
    ]);
  });

  it("WHEN 코드 블록 끝에서 hardBreakOrEnter를 실행한다 THEN 코드 글자에 줄바꿈 글자가 들어간다", () => {
    const code = schema.nodes.codeBlock!.create(null, schema.text("code"));

    const result = run(stateAt([code], 5), hardBreakOrEnter);

    expect(result.ok).toBe(true);
    expect(result.state.doc.firstChild?.textContent).toBe("code\n");
  });

  it("WHEN 목록 항목 둘에 걸친 선택에서 hardBreakOrEnter를 실행한다 THEN 마지막 삼키기가 받아 true이고 문서가 그대로다", () => {
    const item = (text: string) =>
      schema.nodes.listItem!.create(null, paragraph.create(null, schema.text(text)));
    const list = schema.nodes.bulletList!.create(null, [item("하나"), item("둘")]);
    const doc = schema.nodes.doc!.create(null, [list]);
    const base = EditorState.create({ schema, doc });
    const state = base.apply(base.tr.setSelection(TextSelection.create(doc, 4, 10)));

    const result = run(state, hardBreakOrEnter);

    expect(result.ok).toBe(true);
    expect(result.state.doc.eq(state.doc)).toBe(true);
  });
});

describe("editor-hard-break: 강제 줄바꿈에 걸친 선택에도 마크를 붙일 수 있다", () => {
  it("WHEN 강제 줄바꿈에 걸친 선택에 굵게 · 링크 · 글자색을 붙인다 THEN 문서가 바뀌고 docFromNode를 통과한다", () => {
    const marks: Mark[] = [
      schema.marks.bold!.create(),
      schema.marks.link!.create({ href: "/a" }),
      schema.marks.textStyle!.create({ color: "brand" }),
    ];
    for (const mark of marks) {
      const doc = schema.nodes.doc!.create(null, [brokenParagraph()]);
      const base = EditorState.create({ schema, doc, plugins: [blockGuard()] });
      const state = base.apply(base.tr.setSelection(TextSelection.create(doc, 1, 4)));

      const next = state.apply(state.tr.addMark(1, 4, mark));

      expect(next.doc.eq(state.doc)).toBe(false);
      expect(docSchema.safeParse(docFromNode(next.doc)).success).toBe(true);
    }
  });

  it("WHEN 강제 줄바꿈에 걸친 선택에 toggleMark(bold)를 실행한다 THEN 글자만 굵고 저장 결과의 hardBreak에는 마크가 없다", () => {
    const doc = schema.nodes.doc!.create(null, [brokenParagraph()]);
    const base = EditorState.create({ schema, doc, plugins: [blockGuard()] });
    const state = base.apply(base.tr.setSelection(TextSelection.create(doc, 1, 4)));

    const result = run(state, toggleMark(schema.marks.bold!));

    expect(result.ok).toBe(true);
    expect(docFromNode(result.state.doc).content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "가", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          { type: "text", text: "나", marks: [{ type: "bold" }] },
        ],
      },
    ]);
  });
});

describe("editor-hard-break: 블록 바꾸기에서 강제 줄바꿈은 자리에 맞게 바뀐다", () => {
  it("WHEN 문단 가 · hardBreak · 나를 turnIntoTextblock으로 코드 블록으로 바꾼다 THEN 코드 글자는 가\\n나다", () => {
    const result = run(stateAt([brokenParagraph()], 1), turnIntoTextblock("codeBlock"));

    expect(result.ok).toBe(true);
    expect(result.state.doc.firstChild?.type.name).toBe("codeBlock");
    expect(result.state.doc.firstChild?.textContent).toBe("가\n나");
  });

  it("WHEN 두 줄 코드 블록을 turnIntoTextblock으로 문단으로 바꾼다 THEN 줄마다 문단 하나가 된다", () => {
    const code = schema.nodes.codeBlock!.create(null, schema.text("가\n나"));

    const result = run(stateAt([code], 1), turnIntoTextblock("paragraph"));

    expect(result.ok).toBe(true);
    expect(docFromNode(result.state.doc).content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "가" }] },
      { type: "paragraph", content: [{ type: "text", text: "나" }] },
    ]);
  });

  it("WHEN 문단 첫 줄 · hardBreak · 둘째 줄을 제목으로 바꾼다 THEN 강제 줄바꿈이 공백 하나가 된다", () => {
    const broken = paragraph.create(null, [
      schema.text("첫 줄"),
      hardBreakNode(),
      schema.text("둘째 줄"),
    ]);

    const result = run(stateAt([broken], 1), turnIntoTextblock("heading", { level: 2 }));

    expect(result.ok).toBe(true);
    expect(docFromNode(result.state.doc).content).toEqual([
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "첫 줄 둘째 줄" }] },
    ]);
  });

  it("WHEN 굵은 가 · hardBreak · 굵은 나 문단을 제목으로 바꾼다 THEN 공백도 굵어 굵은 글자 하나가 된다", () => {
    const boldText = (text: string) => schema.text(text, [bold.create()]);
    const broken = paragraph.create(null, [boldText("가"), hardBreakNode(), boldText("나")]);

    const result = run(stateAt([broken], 1), turnIntoTextblock("heading", { level: 2 }));

    expect(docFromNode(result.state.doc).content).toEqual([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "가 나", marks: [{ type: "bold" }] }],
      },
    ]);
  });
});
