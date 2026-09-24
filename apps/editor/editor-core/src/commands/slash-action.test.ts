import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command, Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  clearSlashQuery,
  createEditorSchema,
  docToNode,
  slashActionGap,
  slashMenu,
  slashMenuKey,
} from "../index";

const schema = createEditorSchema();

const paragraph = (value = "") => ({
  type: "paragraph",
  ...(value === "" ? {} : { content: [{ type: "text", text: value }] }),
});

/** 슬래시 메뉴를 단 상태에서 첫 블록 끝에 글자를 친다(플러그인 handleTextInput을 거친다) */
function typed(content: object[], value: string): EditorState {
  const doc = docToNode(schema, { type: "doc", content });
  let state = EditorState.create({ doc, plugins: [slashMenu({})] });
  state = state.apply(
    state.tr.setSelection(TextSelection.create(doc, 1 + doc.child(0).content.size)),
  );
  for (const char of value) {
    const { from, to } = state.selection;
    const insert = () => state.tr.insertText(char, from, to);
    const plugin = slashMenuKey.get(state) as Plugin;
    const view = {
      state,
      composing: false,
      dispatch: (tr: Parameters<EditorState["apply"]>[0]) => (state = state.apply(tr)),
    };
    const handled =
      plugin.props.handleTextInput?.call(
        plugin,
        view as unknown as EditorView,
        from,
        to,
        char,
        insert,
      ) ?? false;
    if (!handled) state = state.apply(insert());
  }
  return state;
}

function run(state: EditorState, command: Command) {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

describe("editor-image-insert: 슬래시 메뉴의 동작 항목(이미지)", () => {
  it("WHEN 빈 문단에서 /이미지 THEN 동작 자리는 그 문단 앞이고, clearSlashQuery는 /이미지를 지우고 메뉴를 닫는다", () => {
    const state = typed([paragraph(), paragraph("나")], "/이미지");

    expect(slashActionGap(state)).toBe(0);
    const { ok, state: cleared } = run(state, clearSlashQuery);

    expect(ok).toBe(true);
    expect(cleared.doc.child(0).content.size).toBe(0);
    expect(slashMenuKey.getState(cleared)).toBeNull();
  });

  it("WHEN 글자 뒤 /image THEN 동작 자리는 /image를 지운 그 문단 뒤다", () => {
    const state = typed([paragraph("가 "), paragraph("나")], "/image");

    // "가 " 문단(크기 2 + 2)을 지운 뒤 끝 = 4
    expect(slashActionGap(state)).toBe(4);
    expect(run(state, clearSlashQuery).state.doc.child(0).textContent).toBe("가 ");
  });

  it("WHEN 메뉴가 닫혀 있다 THEN slashActionGap은 null, clearSlashQuery는 false다", () => {
    const state = typed([paragraph("가")], "a");

    expect(slashActionGap(state)).toBeNull();
    expect(run(state, clearSlashQuery).ok).toBe(false);
  });
});
