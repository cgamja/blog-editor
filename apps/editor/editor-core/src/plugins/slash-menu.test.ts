import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Plugin, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { undo } from "@tiptap/pm/history";
import {
  applySlashItem,
  closeSlashMenu,
  createEditorSchema,
  docFromNode,
  docToNode,
  historyPlugins,
  slashMenu,
  slashMenuKey,
} from "../index";
import { blockGuard } from "./block-guard";

const schema = createEditorSchema();

const HEART = { id: "heart", x: 50, y: 50, size: 10, rotate: 0 };

const text = (value: string, marks?: object[]) => ({
  type: "text",
  text: value,
  ...(marks === undefined ? {} : { marks }),
});

const paragraph = (value = "", attrs?: Record<string, unknown>) => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  ...(value === "" ? {} : { content: [text(value)] }),
});

interface FakeView {
  state: EditorState;
  composing: boolean;
  dispatch(tr: Transaction): void;
}

/** 슬래시 메뉴 · blockGuard · history를 단 상태. 커서는 cursor(기본: 첫 블록 글자 끝) */
function start(
  content: object[],
  { cursor, onKey }: { cursor?: number; onKey?: (key: string) => boolean } = {},
): FakeView {
  const doc = docToNode(schema, { type: "doc", content });
  const created = EditorState.create({
    doc,
    plugins: [slashMenu({ onKey }), blockGuard(), ...historyPlugins()],
  });
  const at = cursor ?? 1 + doc.child(0).content.size;
  const view: FakeView = {
    state: created.apply(created.tr.setSelection(TextSelection.create(doc, at))),
    composing: false,
    dispatch(tr) {
      view.state = view.state.apply(tr);
    },
  };
  return view;
}

const pluginOf = (state: EditorState): Plugin => {
  const plugin = slashMenuKey.get(state);
  if (plugin === undefined) throw new Error("슬래시 메뉴 플러그인이 없다");
  return plugin;
};

/**
 * 한 글자씩 친다. 플러그인 handleTextInput(가짜 뷰 — state · composing · dispatch만 읽는다)을 부르고,
 * 처리하지 않은 글자는 브라우저처럼 그대로 넣는다.
 */
function type(view: FakeView, value: string): void {
  for (const char of value) {
    const { from, to } = view.state.selection;
    const insert = () => view.state.tr.insertText(char, from, to);
    const handled =
      pluginOf(view.state).props.handleTextInput?.call(
        pluginOf(view.state),
        view as unknown as EditorView,
        from,
        to,
        char,
        insert,
      ) ?? false;
    if (!handled) view.dispatch(insert());
  }
}

/** handleTextInput을 거치지 않는 입력 — 조합 중 DOMObserver가 보내는 트랜잭션과 같다 */
function composeInto(view: FakeView, value: string): void {
  const { from, to } = view.state.selection;
  view.dispatch(view.state.tr.insertText(value, from, to));
}

function pressKey(
  view: FakeView,
  key: string,
  {
    isComposing = false,
    shiftKey = false,
    metaKey = false,
  }: { isComposing?: boolean; shiftKey?: boolean; metaKey?: boolean } = {},
): boolean {
  const plugin = pluginOf(view.state);
  return (
    plugin.props.handleKeyDown?.call(
      plugin,
      view as unknown as EditorView,
      // editor-core에는 DOM 타입이 없다 — 핸들러가 읽는 key · isComposing · 수정키만 갖춘 값
      {
        key,
        isComposing,
        shiftKey,
        metaKey,
        ctrlKey: false,
        altKey: false,
      } as unknown as Parameters<NonNullable<Plugin["props"]["handleKeyDown"]>>[1],
    ) ?? false
  );
}

const menuOf = (view: FakeView) => slashMenuKey.getState(view.state) ?? null;

function run(view: FakeView, command: ReturnType<typeof applySlashItem>): boolean {
  return command(view.state, (tr) => view.dispatch(tr));
}

const saved = (view: FakeView) => docFromNode(view.state.doc).content;

describe("editor-slash-menu: 여는 자리", () => {
  it("WHEN 빈 최상위 문단에서 / THEN { from: 1, query: '' }이고 문서에 /가 있다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    expect(menuOf(view)).toEqual({ from: 1, query: "" });
    expect(view.state.doc.textContent).toBe("/");
  });

  it("WHEN '가 ' 뒤 / THEN 열리고, 'a' 뒤 /는 열리지 않는다", () => {
    const afterSpace = start([paragraph("가 ")]);
    type(afterSpace, "/");
    expect(menuOf(afterSpace)).toEqual({ from: 3, query: "" });

    const afterLetter = start([paragraph("a")]);
    type(afterLetter, "/");
    expect(menuOf(afterLetter)).toBeNull();
    expect(afterLetter.state.doc.textContent).toBe("a/");
  });

  it("WHEN 점 목록 항목 · 코드 블록 · 코드 마크 자리에서 / THEN 셋 다 열리지 않는다", () => {
    const inList = start(
      [{ type: "bulletList", content: [{ type: "listItem", content: [paragraph()] }] }],
      { cursor: 3 },
    );
    type(inList, "/");
    expect(menuOf(inList)).toBeNull();

    const inCode = start([{ type: "codeBlock" }], { cursor: 1 });
    type(inCode, "/");
    expect(menuOf(inCode)).toBeNull();

    const inCodeMark = start([
      { type: "paragraph", content: [text("a "), text("x ", [{ type: "code" }])] },
    ]);
    type(inCodeMark, "/");
    expect(menuOf(inCodeMark)).toBeNull();
  });
});

describe("editor-slash-menu: 거르기", () => {
  it("WHEN 연 뒤 handleTextInput을 거치지 않고 '제목'을 넣는다 THEN query는 '제목'이다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    composeInto(view, "제");
    composeInto(view, "목");
    expect(menuOf(view)).toEqual({ from: 1, query: "제목" });
  });
});

describe("editor-slash-menu: 닫기", () => {
  it("WHEN '/제' 뒤 공백 THEN 상태는 null이고 '/제 '가 남는다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    composeInto(view, "제");
    type(view, " ");
    expect(menuOf(view)).toBeNull();
    expect(view.state.doc.textContent).toBe("/제 ");
  });

  it("WHEN 연 직후 /를 지운다 THEN 상태는 null이다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    view.dispatch(view.state.tr.delete(1, 2));
    expect(menuOf(view)).toBeNull();
  });

  it("WHEN 커서를 / 앞으로 옮기거나 closeSlashMenu THEN 상태는 null이고 글자는 남는다", () => {
    const moved = start([paragraph("가 ")]);
    type(moved, "/");
    moved.dispatch(moved.state.tr.setSelection(TextSelection.create(moved.state.doc, 1)));
    expect(menuOf(moved)).toBeNull();

    const closed = start([paragraph()]);
    type(closed, "/");
    composeInto(closed, "제");
    expect(run(closed, closeSlashMenu)).toBe(true);
    expect(menuOf(closed)).toBeNull();
    expect(closed.state.doc.textContent).toBe("/제");
  });

  it("WHEN '/제목'에서 Escape THEN true를 돌려주고 상태는 null이며 '/제목'은 남는다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    composeInto(view, "제목");
    expect(pressKey(view, "Escape")).toBe(true);
    expect(menuOf(view)).toBeNull();
    expect(view.state.doc.textContent).toBe("/제목");
  });
});

describe("editor-slash-menu: 키 넘기기", () => {
  it("WHEN 조합 중 Enter THEN 처리기는 불리지 않고 false, 조합이 아니면 처리기 결과가 나온다", () => {
    const keys: string[] = [];
    const view = start([paragraph()], {
      onKey: (key) => {
        keys.push(key);
        return true;
      },
    });
    type(view, "/");

    view.composing = true;
    expect(pressKey(view, "Enter")).toBe(false);
    view.composing = false;
    expect(pressKey(view, "Enter", { isComposing: true })).toBe(false);
    expect(keys).toEqual([]);

    expect(pressKey(view, "ArrowDown")).toBe(true);
    expect(pressKey(view, "Enter")).toBe(true);
    expect(keys).toEqual(["ArrowDown", "Enter"]);
  });

  it("WHEN 열린 상태에서 Shift+Enter · ⌘+Shift+↓ THEN 처리기를 부르지 않고 false", () => {
    const keys: string[] = [];
    const view = start([paragraph()], {
      onKey: (key) => {
        keys.push(key);
        return true;
      },
    });
    type(view, "/");
    expect(pressKey(view, "Enter", { shiftKey: true })).toBe(false);
    expect(pressKey(view, "ArrowDown", { shiftKey: true, metaKey: true })).toBe(false);
    expect(keys).toEqual([]);
    expect(menuOf(view)).not.toBeNull();
  });

  it("WHEN 닫힌 상태에서 Enter THEN 처리기를 부르지 않는다", () => {
    const keys: string[] = [];
    const view = start([paragraph("가")], {
      onKey: (key) => {
        keys.push(key);
        return true;
      },
    });
    expect(pressKey(view, "Enter")).toBe(false);
    expect(keys).toEqual([]);
  });
});

describe("editor-slash-menu: 항목 고르기", () => {
  it("WHEN 빈 문단 '/제목'에서 heading2 THEN 빈 h2 · 커서 안 · 닫힘, undo 한 번에 '/제목' 문단", () => {
    const view = start([paragraph()]);
    type(view, "/");
    composeInto(view, "제목");
    expect(run(view, applySlashItem("heading2"))).toBe(true);

    expect(saved(view)).toEqual([{ type: "heading", attrs: { level: 2 } }]);
    expect(view.state.selection.$from.parent.type.name).toBe("heading");
    expect(menuOf(view)).toBeNull();

    expect(undo(view.state, (tr) => view.dispatch(tr))).toBe(true);
    expect(view.state.doc.child(0).type.name).toBe("paragraph");
    expect(view.state.doc.textContent).toBe("/제목");
  });

  it("WHEN 스티커가 붙은 빈 문단에서 / 뒤 bulletList THEN 최상위 점 목록이고 스티커는 목록에 있다", () => {
    const view = start([paragraph("", { stickers: [HEART] })]);
    type(view, "/");
    expect(run(view, applySlashItem("bulletList"))).toBe(true);

    const [list] = saved(view) as { type: string; attrs?: { stickers?: unknown[] } }[];
    expect(list?.type).toBe("bulletList");
    expect(list?.attrs?.stickers).toEqual([HEART]);
  });

  it("WHEN '가 /콜' 뒤 calloutTip THEN 첫 문단은 '가 '이고 뒤에 tip 콜아웃, 커서가 그 안", () => {
    const view = start([paragraph("가 ")]);
    type(view, "/");
    composeInto(view, "콜");
    expect(run(view, applySlashItem("calloutTip"))).toBe(true);

    const blocks = saved(view) as { type: string; attrs?: { tone?: string } }[];
    expect(blocks[0]).toEqual(paragraph("가 "));
    expect(blocks[1]?.type).toBe("callout");
    expect(blocks[1]?.attrs?.tone).toBe("tip");
    expect(view.state.selection.$from.node(1).type.name).toBe("callout");
  });

  it("WHEN 빈 문단 / 뒤 horizontalRule THEN 그 자리가 구분선이고 뒤 문단에 커서", () => {
    const view = start([paragraph()]);
    type(view, "/");
    expect(run(view, applySlashItem("horizontalRule"))).toBe(true);

    expect(view.state.doc.child(0).type.name).toBe("horizontalRule");
    expect(view.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(view.state.selection.$from.index(0)).toBe(1);
  });

  it("WHEN 빈 문단 '/문'에서 paragraph THEN 글자만 지워진 빈 문단이고 메뉴는 닫힌다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    composeInto(view, "문");
    expect(run(view, applySlashItem("paragraph"))).toBe(true);
    expect(saved(view)).toEqual([paragraph()]);
    expect(menuOf(view)).toBeNull();
  });

  it("WHEN 적용 직후 글자를 친다 THEN undo 한 번은 친 글자만, 두 번째가 블록 변환을 되돌린다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    composeInto(view, "제목");
    run(view, applySlashItem("heading2"));
    type(view, "가");

    undo(view.state, (tr) => view.dispatch(tr));
    expect(view.state.doc.child(0).type.name).toBe("heading");
    expect(view.state.doc.textContent).toBe("");

    undo(view.state, (tr) => view.dispatch(tr));
    expect(view.state.doc.child(0).type.name).toBe("paragraph");
    expect(view.state.doc.textContent).toBe("/제목");
  });

  it("WHEN undo로 '/제목'이 되살아난다 THEN 메뉴는 열리지 않는다", () => {
    const view = start([paragraph()]);
    type(view, "/");
    composeInto(view, "제목");
    run(view, applySlashItem("heading2"));
    undo(view.state, (tr) => view.dispatch(tr));
    expect(view.state.doc.textContent).toBe("/제목");
    expect(menuOf(view)).toBeNull();
  });

  it("WHEN 붙여넣기처럼 handleTextInput 없이 /가 들어온다 THEN 메뉴는 열리지 않는다", () => {
    const view = start([paragraph()]);
    composeInto(view, "/");
    expect(menuOf(view)).toBeNull();
  });

  it("WHEN 닫힌 상태에서 applySlashItem THEN false이고 문서는 그대로", () => {
    const view = start([paragraph("가")]);
    const before = view.state.doc;
    expect(run(view, applySlashItem("heading2"))).toBe(false);
    expect(view.state.doc.eq(before)).toBe(true);
  });
});
