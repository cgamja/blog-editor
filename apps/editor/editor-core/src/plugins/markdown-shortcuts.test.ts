import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import {
  createEditorSchema,
  docFromNode,
  docToNode,
  duplicateTopBlock,
  markdownShortcutKeymap,
  markdownShortcutPlugins,
} from "../index";
import { blockGuard } from "./block-guard";
import { endComposition, typeText } from "./markdown-shortcuts.test.helpers";

const schema = createEditorSchema();

const HEART = { id: "heart", x: 50, y: 50, size: 10, rotate: 0 };

const paragraph = (text = "", attrs?: Record<string, unknown>) => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  ...(text === "" ? {} : { content: [{ type: "text", text }] }),
});

/** 입력 규칙 · 단축키 · blockGuard를 단 상태. 커서는 cursor(기본: 첫 블록 글자 끝) */
function start(content: object[], cursor?: number): EditorState {
  const doc = docToNode(schema, { type: "doc", content });
  const state = EditorState.create({ doc, plugins: [...markdownShortcutPlugins(), blockGuard()] });
  const at = cursor ?? 1 + doc.child(0).content.size;
  return state.apply(state.tr.setSelection(TextSelection.create(doc, at)));
}

function run(
  command: Command | undefined,
  state: EditorState,
): { ok: boolean; state: EditorState } {
  if (command === undefined) throw new Error("단축키가 없다");
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

describe("editor-markdown-shortcuts: 줄 맨 앞 입력 규칙", () => {
  it.each([
    ["- ", "bulletList"],
    ["* ", "bulletList"],
    ["+ ", "bulletList"],
    ["1. ", "orderedList"],
  ])(
    "WHEN 빈 최상위 문단에서 %j를 입력하면 THEN %s의 첫 항목 문단이 되고 표시 글자는 없다",
    (input, list) => {
      const { handled, state } = typeText(start([paragraph()]), input);

      expect(handled).toBe(true);
      expect(state.doc.child(0).type.name).toBe(list);
      expect(state.doc.textContent).toBe("");
      expect(state.selection.$from.parent.type.name).toBe("paragraph");
    },
  );

  it.each([
    ["# ", 2],
    ["## ", 2],
    ["### ", 3],
  ])("WHEN 빈 최상위 문단에서 %j를 입력하면 THEN level %i 제목이 된다", (input, level) => {
    const { handled, state } = typeText(start([paragraph()]), input);

    expect(handled).toBe(true);
    expect(state.doc.child(0).type.name).toBe("heading");
    expect(state.doc.child(0).attrs.level).toBe(level);
    expect(state.doc.textContent).toBe("");
  });

  it.each([
    ['" ', "blockquote"],
    ["> ", "blockquote"],
    ["```", "codeBlock"],
  ])("WHEN 빈 최상위 문단에서 %j를 입력하면 THEN %s가 된다", (input, type) => {
    const { handled, state } = typeText(start([paragraph()]), input);

    expect(handled).toBe(true);
    expect(state.doc.child(0).type.name).toBe(type);
    expect(state.doc.textContent).toBe("");
  });

  it("WHEN `--`만 있는 최상위 문단 끝에서 `-`를 입력하면 THEN 구분선과 그 뒤 빈 문단에 커서가 있다", () => {
    const { handled, state } = typeText(start([paragraph("--")]), "-");

    expect(handled).toBe(true);
    expect(state.doc.child(0).type.name).toBe("horizontalRule");
    expect(state.doc.child(1).type.name).toBe("paragraph");
    expect(state.doc.child(1).textContent).toBe("");
    expect(state.selection.$from.index(0)).toBe(1);
  });

  it("WHEN font · 스티커가 있는 빈 문단에서 blockGuard를 단 채 `- `를 입력하면 THEN 점 목록이 그 꾸미기를 갖고 거부되지 않는다", () => {
    const { handled, state } = typeText(
      start([paragraph("", { font: "jua", stickers: [HEART] })]),
      "- ",
    );

    expect(handled).toBe(true);
    const list = state.doc.child(0);
    expect(list.type.name).toBe("bulletList");
    expect(list.attrs.font).toBe("jua");
    expect(list.attrs.stickers).toEqual([HEART]);
    expect(() => docFromNode(state.doc)).not.toThrow();
  });

  it("WHEN font · 스티커가 있는 빈 문단에서 ```을 입력하면 THEN 코드 블록은 스티커를 갖고 font는 없다", () => {
    const { handled, state } = typeText(
      start([paragraph("", { font: "jua", stickers: [HEART] })]),
      "```",
    );

    expect(handled).toBe(true);
    const code = state.doc.child(0);
    expect(code.type.name).toBe("codeBlock");
    expect(code.attrs.stickers).toEqual([HEART]);
    expect(code.attrs.font).toBeUndefined();
    expect(() => docFromNode(state.doc)).not.toThrow();
  });

  it("WHEN 점 목록 항목 문단 맨 앞에서 `- `를 입력하면 THEN 규칙이 처리하지 않는다", () => {
    const list = { type: "bulletList", content: [{ type: "listItem", content: [paragraph()] }] };
    const { handled } = typeText(start([list], 3), "- ");

    expect(handled).toBe(false);
  });
});

describe("editor-markdown-shortcuts: 인라인 입력 규칙", () => {
  it.each([
    ["앞**굵게*", "*", "bold"],
    ["앞*굵게", "*", "italic"],
    ["앞`굵게", "`", "code"],
  ])(
    "WHEN 문단에 %j를 두고 %j를 입력하면 THEN `굵게`에만 %s 마크가 있고 이어 친 글자엔 없다",
    (before, last, mark) => {
      const typed = typeText(start([paragraph(before)]), last);
      const { state } = typeText(typed.state, "뒤");

      expect(typed.handled).toBe(true);
      const block = state.doc.child(0);
      expect(block.textContent).toBe("앞굵게뒤");
      expect(block.child(0).marks).toEqual([]);
      expect(block.child(1).text).toBe("굵게");
      expect(block.child(1).marks.map((each) => each.type.name)).toEqual([mark]);
      expect(block.child(2).marks).toEqual([]);
    },
  );

  it("WHEN 코드 블록에서 `**a*` 뒤에 `*`를 입력하면 THEN 규칙이 처리하지 않는다", () => {
    const code = { type: "codeBlock", content: [{ type: "text", text: "**a*" }] };
    const { handled } = typeText(start([code]), "*");

    expect(handled).toBe(false);
  });
});

describe("editor-markdown-shortcuts: 인라인 규칙이 걸리지 않는 자리", () => {
  it("WHEN 글자를 고른 채로 닫는 `*`를 입력하면 THEN 규칙이 처리하지 않는다", () => {
    const before = start([paragraph("앞**굵게*끝")]);
    const selected = before.apply(before.tr.setSelection(TextSelection.create(before.doc, 7, 8)));
    const { handled } = typeText(selected, "*");

    expect(handled).toBe(false);
  });

  it.each([["2*3"], ["a*b"]])(
    "WHEN 라틴 문자 · 숫자 바로 뒤 %j에 닫는 `*`를 입력하면 THEN 기울임이 걸리지 않는다",
    (before) => {
      const { handled } = typeText(start([paragraph(before)]), "*");

      expect(handled).toBe(false);
    },
  );

  it("WHEN 한글 뒤에 붙여 쓴 `정말*중요`에 `*`를 입력하면 THEN `중요`에 기울임이 걸린다", () => {
    const { handled, state } = typeText(start([paragraph("정말*중요")]), "*");

    expect(handled).toBe(true);
    expect(state.doc.child(0).textContent).toBe("정말중요");
    expect(
      state.doc
        .child(0)
        .child(1)
        .marks.map((mark) => mark.type.name),
    ).toEqual(["italic"]);
  });
});

describe("editor-markdown-shortcuts: 조합 · Backspace 되돌리기", () => {
  it("WHEN 조합으로 `앞**굵게**`가 다 들어간 뒤 조합이 끝나면 THEN `굵게`에 굵게가 걸린다", async () => {
    const state = await endComposition(start([paragraph("앞**굵게**")]));

    expect(state.doc.child(0).textContent).toBe("앞굵게");
    expect(
      state.doc
        .child(0)
        .child(1)
        .marks.map((mark) => mark.type.name),
    ).toEqual(["bold"]);
  });

  it("WHEN 조합 중인 뷰에서 빈 문단에 `- `를 입력하면 THEN 규칙이 처리하지 않고 문서는 그대로다", () => {
    const before = start([paragraph()]);
    const { handled, state } = typeText(before, "- ", { composing: true });

    expect(handled).toBe(false);
    expect(state.doc.eq(before.doc)).toBe(true);
  });

  it("WHEN `- ` 규칙 직후 Backspace 키맵을 부르면 THEN `- ` 글자가 든 문단이다", () => {
    const typed = typeText(start([paragraph()]), "- ");
    const { ok, state } = run(markdownShortcutKeymap.Backspace, typed.state);

    expect(ok).toBe(true);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("- ");
  });
});

describe("editor-markdown-shortcuts: 단축키", () => {
  it.each([
    ["Mod-b", "bold"],
    ["Mod-i", "italic"],
    ["Mod-e", "code"],
  ])("WHEN 글자를 고르고 %s를 부르면 THEN %s 마크가 걸린다", (key, mark) => {
    const selected = start([paragraph("글자")]);
    const withRange = selected.apply(
      selected.tr.setSelection(TextSelection.create(selected.doc, 1, 3)),
    );
    const { ok, state } = run(markdownShortcutKeymap[key], withRange);

    expect(ok).toBe(true);
    expect(
      state.doc
        .child(0)
        .child(0)
        .marks.map((each) => each.type.name),
    ).toEqual([mark]);
  });

  const heading = { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "글" }] };

  it.each([
    ["Mod-Alt-1", "heading", 2, paragraph("글")],
    ["Mod-Alt-2", "heading", 2, paragraph("글")],
    ["Mod-Alt-3", "heading", 3, paragraph("글")],
    ["Mod-Alt-5", "bulletList", undefined, paragraph("글")],
    ["Mod-Alt-6", "orderedList", undefined, paragraph("글")],
    ["Mod-Alt-8", "codeBlock", undefined, paragraph("글")],
    ["Mod-Alt-0", "paragraph", undefined, heading],
  ])("WHEN %s를 부르면 THEN 블록이 %s(level %s)가 된다", (key, type, level, block) => {
    const { ok, state } = run(markdownShortcutKeymap[key], start([block]));

    expect(ok).toBe(true);
    expect(state.doc.child(0).type.name).toBe(type);
    if (level !== undefined) expect(state.doc.child(0).attrs.level).toBe(level);
    expect(state.doc.textContent).toBe("글");
  });

  it("WHEN 둘째 문단에서 Mod-d를 부르면 THEN 같은 문단이 바로 뒤에 하나 더 있고 커서는 복제본 안이다", () => {
    const before = start([paragraph("첫"), paragraph("둘")], 5);
    const { ok, state } = run(markdownShortcutKeymap["Mod-d"], before);

    expect(ok).toBe(true);
    expect(state.doc.childCount).toBe(3);
    expect(state.doc.child(2).eq(state.doc.child(1))).toBe(true);
    expect(state.selection.$from.index(0)).toBe(2);
  });

  it("WHEN 스티커가 12개인 문서에서 스티커 블록을 복제하면 THEN duplicateTopBlock은 false이고 Mod-d는 키를 삼키며 문서는 그대로다", () => {
    const stickers = Array.from({ length: 12 }, () => HEART);
    const before = start([paragraph("꽉", { stickers })]);
    const command = run(duplicateTopBlock, before);
    const key = run(markdownShortcutKeymap["Mod-d"], before);

    expect(command.ok).toBe(false);
    expect(key.ok).toBe(true);
    expect(key.state.doc.eq(before.doc)).toBe(true);
  });

  const codeLines = { type: "codeBlock", content: [{ type: "text", text: "첫 줄\n둘째 줄" }] };

  it("WHEN 여러 줄 코드 블록에서 Mod-Alt-0을 부르면 THEN 줄마다 문단 하나가 된다", () => {
    const { ok, state } = run(markdownShortcutKeymap["Mod-Alt-0"], start([codeLines], 2));

    expect(ok).toBe(true);
    expect(state.doc.childCount).toBe(2);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("첫 줄");
    expect(state.doc.child(1).type.name).toBe("paragraph");
    expect(state.doc.child(1).textContent).toBe("둘째 줄");
  });

  it("WHEN 여러 줄 코드 블록에서 Mod-Alt-2를 부르면 THEN false이고 문서는 그대로다", () => {
    const before = start([codeLines], 2);
    const { ok, state } = run(markdownShortcutKeymap["Mod-Alt-2"], before);

    expect(ok).toBe(false);
    expect(state.doc.eq(before.doc)).toBe(true);
  });
});
