import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import {
  createEditorSchema,
  docFromNode,
  docToNode,
  insertBlockAfter,
  markdownShortcutPlugins,
  toggleTaskItem,
  turnTopBlockInto,
} from "../index";
import { el, readWith } from "../dom.test.helpers";
import { blockGuard } from "../plugins/block-guard";
import { enterInList } from "../plugins/list-keymap";
import { typeText } from "../plugins/markdown-shortcuts.test.helpers";

const schema = createEditorSchema();

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value = "") =>
  value === "" ? { type: "paragraph" } : { type: "paragraph", content: [text(value)] };
const item = (value: string, attrs?: Record<string, unknown>, nested: object[] = []) => ({
  type: "listItem",
  ...(attrs === undefined ? {} : { attrs }),
  content: [paragraph(value), ...nested],
});
const bulletList = (...items: object[]) => ({ type: "bulletList", content: items });

/** 입력 규칙 · blockGuard를 단 상태. 커서는 cursor(기본: 문서 맨 앞 글자 자리) */
function start(content: object[], cursor = 1): EditorState {
  const doc = docToNode(schema, { type: "doc", content });
  const state = EditorState.create({ doc, plugins: [...markdownShortcutPlugins(), blockGuard()] });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, cursor)));
}

function run(command: Command, state: EditorState): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

describe("editor-task-list: 에디터 목록 항목은 체크 여부를 오간다", () => {
  it("WHEN 체크 여부가 false · true · 없음인 항목과 안쪽 할 일 항목이 든 문서를 에디터로 옮겼다가 저장 문서로 꺼낸다 THEN 입력과 같다", () => {
    const input = {
      type: "doc",
      content: [
        bulletList(
          item("할 일", { checked: false }),
          item("끝", { checked: true }),
          item("보통", undefined, [bulletList(item("안쪽", { checked: true }))]),
        ),
      ],
    };

    expect(docFromNode(docToNode(schema, input))).toEqual(input);
  });

  it("WHEN 공개 HTML의 li.post-task(체크 칸 checked)와 에디터 HTML의 li[data-checked=false]를 읽는다 THEN checked가 차례로 true · false다", () => {
    const published = el({
      tag: "li",
      attrs: { class: "post-task" },
      children: [
        el({
          tag: "p",
          children: [
            el({
              tag: "input",
              attrs: { type: "checkbox", disabled: "", checked: "", "aria-label": "완료" },
            }),
            "끝",
          ],
        }),
      ],
    });
    const editorHtml = el({
      tag: "li",
      attrs: { "data-checked": "false" },
      children: [el({ tag: "p", children: ["할 일"] })],
    });

    expect(readWith(schema, "nodes", "listItem", published)).toMatchObject({ checked: true });
    expect(readWith(schema, "nodes", "listItem", editorHtml)).toMatchObject({ checked: false });
  });
});

describe("editor-task-list: 체크 칸을 누르면 체크가 바뀐다", () => {
  it("WHEN 할 일 항목에 toggleTaskItem을 두 번, 보통 항목에 한 번 적용한다 THEN 할 일은 true → false이고 보통 항목에서는 false다", () => {
    const initial = start([bulletList(item("할 일", { checked: false }), item("보통"))]);
    const taskPos = 1;
    const plainPos = 1 + initial.doc.child(0).child(0).nodeSize;
    const checkedOf = (state: EditorState) =>
      (docFromNode(state.doc).content[0] as { content: { attrs?: object }[] }).content[0]?.attrs;

    const once = run(toggleTaskItem(taskPos), initial);
    expect(once.ok).toBe(true);
    expect(checkedOf(once.state)).toEqual({ checked: true });
    const twice = run(toggleTaskItem(taskPos), once.state);
    expect(checkedOf(twice.state)).toEqual({ checked: false });

    const plain = run(toggleTaskItem(plainPos), initial);
    expect(plain.ok).toBe(false);
    expect(plain.state.doc.eq(initial.doc)).toBe(true);
  });
});

describe("editor-task-list: [ ] · [x] 입력이 할 일 항목을 만든다", () => {
  it("WHEN 점 목록 항목 맨 앞에서 [ ] 를, 빈 최상위 문단에서 [x] 를 입력한다 THEN checked false 항목 · checked true 항목 하나인 점 목록이 되고 표시 글자는 없다", () => {
    const inItem = typeText(start([bulletList(item(""))], 3), "[ ] ");
    const topLevel = typeText(start([paragraph()]), "[x] ");

    expect(inItem.handled).toBe(true);
    expect(docFromNode(inItem.state.doc).content).toEqual([
      bulletList({ type: "listItem", attrs: { checked: false }, content: [paragraph()] }),
    ]);
    expect(topLevel.handled).toBe(true);
    expect(docFromNode(topLevel.state.doc).content).toEqual([
      bulletList({ type: "listItem", attrs: { checked: true }, content: [paragraph()] }),
    ]);
  });
});

describe("editor-task-list: 할 일 항목에서 Enter로 만든 새 항목은 체크하지 않은 할 일이다", () => {
  it("WHEN 끝난 할 일 항목 우유 끝과 맨 앞에서 각각 Enter를 누른다 THEN 새로 생긴 빈 항목만 checked false이고 우유는 true 그대로다", () => {
    const doc = [bulletList(item("우유", { checked: true }))];
    const emptyTodo = { type: "listItem", attrs: { checked: false }, content: [paragraph()] };

    const atEnd = run(enterInList, start(doc, 5));
    const atStart = run(enterInList, start(doc, 3));

    expect(atEnd.ok).toBe(true);
    expect(docFromNode(atEnd.state.doc).content).toEqual([
      bulletList(item("우유", { checked: true }), emptyTodo),
    ]);
    expect(atStart.ok).toBe(true);
    expect(docFromNode(atStart.state.doc).content).toEqual([
      bulletList(emptyTodo, item("우유", { checked: true })),
    ]);
  });
});

describe("editor-task-list: 블록 메뉴와 / 메뉴에 할 일 목록이 있다", () => {
  it("WHEN 문단을 할 일 목록으로 바꾸고, 보통 점 목록을 같은 바꾸기로 바꾸고, 문단 뒤에 할 일 목록을 넣는다 THEN 보통 항목은 checked false가 되고 체크된 항목은 그대로인 점 목록이다", () => {
    const fromParagraph = run(turnTopBlockInto(0, "taskList"), start([paragraph("우유")], 2));
    const fromList = run(
      turnTopBlockInto(0, "taskList"),
      start([bulletList(item("가"), item("나", { checked: true }))], 3),
    );
    const inserted = run(insertBlockAfter(0, "taskList"), start([paragraph("앞")], 2));

    expect(fromParagraph.ok).toBe(true);
    expect(docFromNode(fromParagraph.state.doc).content).toEqual([
      bulletList(item("우유", { checked: false })),
    ]);
    expect(fromList.ok).toBe(true);
    expect(docFromNode(fromList.state.doc).content).toEqual([
      bulletList(item("가", { checked: false }), item("나", { checked: true })),
    ]);
    expect(inserted.ok).toBe(true);
    expect(docFromNode(inserted.state.doc).content).toEqual([
      paragraph("앞"),
      bulletList({ type: "listItem", attrs: { checked: false }, content: [paragraph()] }),
    ]);
  });
});

describe("editor-task-list: 바꾸기로 감싼 목록의 항목은 모두 할 일이다", () => {
  it("WHEN 콜아웃 안 문단에 「바꾸기 → 할 일 목록」을 적용한다 THEN 감싼 목록의 모든 항목이 checked false다", () => {
    const initial = start([
      { type: "callout", attrs: { tone: "tip" }, content: [paragraph("우유")] },
    ]);

    const result = run(turnTopBlockInto(0, "taskList"), initial);

    const items: { checked: unknown }[] = [];
    result.state.doc.descendants((node) => {
      if (node.type.name === "listItem") items.push({ checked: node.attrs.checked });
    });
    expect(result.ok).toBe(true);
    expect(items).toEqual([{ checked: false }]);
  });
});
