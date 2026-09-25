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
 * 강제 줄바꿈에 붙은 마크를 지운다 — 에디터에서만 생기는 모양이라 저장 형식에는 자리가 없다(adr-028). 선택이 강제
 * 줄바꿈에 걸치면 마크 붙이기가 원자 인라인 노드에도 마크를 싣는다: prosemirror-transform 1.12.1 mark.ts `addMark`와
 * mark_step.ts `AddMarkStep.apply`는 노드 자신이 아니라 부모의 `allowsMarkType`만 본다. NodeSpec `marks`는 그 노드의
 * **안쪽**에 허용할 마크라 잎 노드에 `marks: ""`를 두어도 막히지 않는다(https://prosemirror.net/docs/ref/#model.NodeSpec.marks).
 * 그대로 두면 blockGuard가 마크 붙이기 트랜잭션을 통째로 거부한다.
 * https://github.com/ProseMirror/prosemirror-transform/blob/1.12.1/src/mark_step.ts#L33-L35
 */
function withoutHardBreakMarks(json: JsonNode): JsonNode {
  if (json.type === "hardBreak") return { type: json.type };
  if (!Array.isArray(json.content)) return json;
  return {
    ...json,
    content: json.content.map((child) => withoutHardBreakMarks(child as JsonNode)),
  };
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
  const json = withoutHardBreakMarks(withoutNullAttrs(node.toJSON() as JsonNode));
  const doc = normalize(json as Doc);
  docSchema.parse(doc);
  return doc;
}
