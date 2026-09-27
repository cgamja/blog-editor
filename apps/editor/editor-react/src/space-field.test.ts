import type { Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Selection } from "@tiptap/pm/state";
import { SPACES } from "@blog-editor/content-schema";
import { createEditorSchema, docToNode } from "@blog-editor/editor-core";
import { SPACE_OPTIONS } from "./decoration-constants";
import { decorationPanelStateOf } from "./decoration-state";

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [{ type: "text", text: value }],
});

function stateOf(blocks: Json[], place: (doc: Node) => Selection): EditorState {
  const doc = docToNode(schema, { type: "doc", content: blocks });
  return EditorState.create({ doc, selection: place(doc) });
}

describe("decoration-panel: 간격", () => {
  it("WHEN space: lg 문단 · 간격 없는 문단 · lg와 sm 두 문단을 고르면 THEN 값은 lg · null(보통) · 첫 블록의 lg이고 모두 쓸 수 있다", () => {
    const spaced = decorationPanelStateOf(
      stateOf([paragraph("가", { space: "lg" })], (doc) => TextSelection.create(doc, 1)),
    );
    const plain = decorationPanelStateOf(
      stateOf([paragraph("가")], (doc) => TextSelection.create(doc, 1)),
    );
    const mixed = decorationPanelStateOf(
      stateOf([paragraph("가", { space: "lg" }), paragraph("나", { space: "sm" })], (doc) =>
        TextSelection.create(doc, 1, doc.content.size - 1),
      ),
    );

    expect(spaced.space).toEqual({ value: "lg", availability: { enabled: true } });
    expect(plain.space).toEqual({ value: null, availability: { enabled: true } });
    expect(mixed.space).toEqual({ value: "lg", availability: { enabled: true } });
  });

  it("WHEN 간격 선택지를 스키마 상수와 비교하면 THEN 보통(null) + SPACES 순서와 같다", () => {
    expect(SPACE_OPTIONS.map((option) => option.value)).toEqual([null, ...SPACES]);
    expect(SPACE_OPTIONS.map((option) => option.label)).toEqual([
      "보통",
      "좁게",
      "넓게",
      "아주 넓게",
    ]);
  });
});
