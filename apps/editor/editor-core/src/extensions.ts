import { Mark, Node, getSchema } from "@tiptap/core";
import type { Attribute } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";

/**
 * content-schema(zod)의 닫힌 집합을 ProseMirror 스키마로 옮긴다(spec: editor-schema, design.md 2).
 * 여기는 구조(노드 · 마크 이름, content expression)만 맡는다 — attrs 규칙의 원천은 zod 하나다.
 * 근거: https://tiptap.dev/docs/editor/core-concepts/schema ·
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node ·
 * https://prosemirror.net/docs/guide/#schema.content_expressions
 */

// HTML 속성으로 내보내지 않는다 — 모양은 렌더러(content-render)와 에디터 화면(editor-react)이 정한다
const optional: Attribute = { default: null, rendered: false };
// TipTap은 isRequired면 default를 두지 않는다. ProseMirror는 attrs 객체가 아예 없으면 이것도 null로
// 채우므로(design.md 2) 누락의 최종 방어는 zod다 — 여기서는 키만 빠진 attrs를 막는다.
// 이 동작은 공식 문서에 없다 — @tiptap/core 3.31.3 buildAttributeSpec · prosemirror-model 1.25.12 computeAttrs 소스로 확인
const required: Attribute = { isRequired: true, rendered: false };

const decoration = { font: optional, motion: optional, stickers: optional };
const motionOnly = { motion: optional, stickers: optional };
const media = {
  naturalWidth: optional,
  naturalHeight: optional,
  motion: optional,
  width: optional,
  stickers: optional,
};

const Doc = Node.create({ name: "doc", topNode: true, content: "block+" });

const Text = Node.create({ name: "text", group: "inline" });

// block 그룹의 첫 노드가 ProseMirror의 기본 채움 블록이 된다 — 문단을 맨 앞에 둔다
const Paragraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "text*",
  addAttributes: () => decoration,
});

const Heading = Node.create({
  name: "heading",
  group: "block",
  content: "text*",
  addAttributes: () => ({ level: required, ...decoration }),
});

const BulletList = Node.create({
  name: "bulletList",
  group: "block",
  content: "listItem+",
  addAttributes: () => decoration,
});

const OrderedList = Node.create({
  name: "orderedList",
  group: "block",
  content: "listItem+",
  addAttributes: () => decoration,
});

// content-schema의 z.tuple([innerParagraph], innerList)와 같다 — 첫 자식은 문단, 뒤는 안쪽 목록만
const ListItem = Node.create({
  name: "listItem",
  content: "paragraph (bulletList | orderedList)*",
});

const Blockquote = Node.create({
  name: "blockquote",
  group: "block",
  content: "paragraph+",
  addAttributes: () => decoration,
});

const CodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  addAttributes: () => ({ language: optional, ...motionOnly }),
});

const HorizontalRule = Node.create({
  name: "horizontalRule",
  group: "block",
  atom: true,
  addAttributes: () => motionOnly,
});

const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes: () => ({ src: required, alt: required, ...media }),
});

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "(paragraph | bulletList | orderedList)+",
  addAttributes: () => ({ tone: required, ...decoration }),
});

const AppScreenshot = Node.create({
  name: "appScreenshot",
  group: "block",
  atom: true,
  addAttributes: () => ({ src: required, caption: required, ...media }),
});

// 정의 순서 = ProseMirror 마크 정렬 순서(rank). 정규형(type 사전순)과 같게 둔다
const Bold = Mark.create({ name: "bold" });
const Code = Mark.create({ name: "code" });
const Italic = Mark.create({ name: "italic" });
const Link = Mark.create({ name: "link", addAttributes: () => ({ href: required }) });

export const editorExtensions = [
  Doc,
  Text,
  Paragraph,
  Heading,
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  CodeBlock,
  HorizontalRule,
  Image,
  Callout,
  AppScreenshot,
  Bold,
  Code,
  Italic,
  Link,
];

export function createEditorSchema(): Schema {
  return getSchema(editorExtensions);
}
