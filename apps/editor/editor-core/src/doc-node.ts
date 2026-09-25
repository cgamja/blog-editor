import { Node } from "@tiptap/pm/model";
import type { Schema } from "@tiptap/pm/model";
import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";

type JsonNode = Record<string, unknown>;

/**
 * 에디터 스키마에만 있는 attrs의 기본값 — prosemirror-tables가 칸 크기를 읽는 자리(extensions.ts TableCell).
 * 기본값이면 저장 형식에 자리가 없고, 기본값이 아니면(병합) 남겨 zod가 거부한다(adr-028).
 */
const EDITOR_ONLY_DEFAULTS: Readonly<Record<string, unknown>> = { colspan: 1, rowspan: 1 };

const isEditorOnlyDefault = (key: string, value: unknown) =>
  Object.hasOwn(EDITOR_ONLY_DEFAULTS, key) && EDITOR_ONLY_DEFAULTS[key] === value;

/** ProseMirror는 값 없는 attrs를 null로 채워 내보낸다 — 저장 형식에는 그 자리가 없다. */
function withoutNullAttrs(json: JsonNode): JsonNode {
  const { attrs, content, marks, ...rest } = json;
  const out: JsonNode = { ...rest };
  if (attrs !== undefined) {
    out.attrs = Object.fromEntries(
      Object.entries(attrs as JsonNode).filter(
        ([key, value]) => value !== null && !isEditorOnlyDefault(key, value),
      ),
    );
  }
  if (Array.isArray(content))
    out.content = content.map((child) => withoutNullAttrs(child as JsonNode));
  if (Array.isArray(marks)) out.marks = marks.map((mark) => withoutNullAttrs(mark as JsonNode));
  return out;
}

/**
 * 저장 문서 → 에디터 노드. zod를 먼저 지나는 이유: ProseMirror는 모르는 attrs를 조용히 버리고
 * 값을 검사하지 않는다(design.md 3).
 * @throws ZodError(값 · attrs · 꾸미기 자리) 또는 RangeError(구조)
 */
export function docToNode(schema: Schema, raw: unknown): Node {
  const node = Node.fromJSON(schema, docSchema.parse(raw));
  node.check();
  return node;
}

/**
 * 에디터 노드 → 정규형 저장 문서. 안쪽 노드에 꾸미기가 값으로 들어간 문서처럼 저장할 수 없는 것은
 * 조용히 고치지 않고 던진다(design.md 4).
 * @throws ZodError
 */
export function docFromNode(node: Node): Doc {
  // zod 파싱 결과는 스키마 순서로 키를 다시 쓰므로, 검사만 하고 정규형 객체를 그대로 돌려준다
  const doc = normalize(withoutNullAttrs(node.toJSON() as JsonNode) as Doc);
  docSchema.parse(doc);
  return doc;
}
