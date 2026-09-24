import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { fixtures, normalize } from "@blog-editor/content-schema";
import { createEditorSchema, editorExtensions } from "@blog-editor/editor-core";
import { blogEditorExtensions } from "./extensions";
import { readDoc, toEditorContent } from "./content";

const sortedNames = (names: Iterable<string>) => [...names].sort();

describe("에디터 확장 조립", () => {
  it("WHEN blogEditorExtensions()의 이름을 보면 THEN editorExtensions 전부와 blockGuard · moveBlock · customBlockKeys가 있다", () => {
    const names = blogEditorExtensions().map((extension) => extension.name);

    expect(names).toEqual(
      expect.arrayContaining([
        ...editorExtensions.map((extension) => extension.name),
        "blockGuard",
        "moveBlock",
        "customBlockKeys",
      ]),
    );
  });

  it("WHEN blogEditorExtensions()의 이름을 보면 THEN 되돌리기(history)가 있다", () => {
    const names = blogEditorExtensions().map((extension) => extension.name);

    expect(names).toContain("history");
  });

  it("WHEN blogEditorExtensions()로 스키마를 만들면 THEN 노드 · 마크 이름이 createEditorSchema()와 같다", () => {
    const assembled = getSchema(blogEditorExtensions());
    const core = createEditorSchema();

    expect(sortedNames(Object.keys(assembled.nodes))).toEqual(sortedNames(Object.keys(core.nodes)));
    expect(sortedNames(Object.keys(assembled.marks))).toEqual(sortedNames(Object.keys(core.marks)));
  });
});

describe("초기 문서 · 저장 문서 경계", () => {
  it.each(Object.entries(fixtures))(
    "WHEN 픽스처 %s를 toEditorContent → 노드 → readDoc으로 돌리면 THEN 원래 doc과 같다",
    (_name, postFile) => {
      const schema = getSchema(blogEditorExtensions());
      const node = Node.fromJSON(schema, toEditorContent(postFile.doc));

      expect(readDoc(node)).toEqual(normalize(postFile.doc));
    },
  );

  it("WHEN 인용 안 문단에 font가 붙은 문서로 toEditorContent를 부르면 THEN 던진다", () => {
    const invalid = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", attrs: { font: "jua" }, content: [{ type: "text", text: "가" }] },
          ],
        },
      ],
    };

    expect(() => toEditorContent(invalid)).toThrow();
  });
});
