import { Mark, Node, getSchema } from "@tiptap/core";
import type { Attribute } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { CAPTION_MAX_LENGTH } from "@blog-editor/content-schema";
import { headingLevelOf, hrefOrNull, languageOrNull, toneOrNull } from "./closed-values";
import { hasClass, imageAttrsOf, imgSpec, withDecoration, wrapperRule } from "./dom";
import type { ElementLike } from "./dom";

/**
 * content-schema(zod)의 닫힌 집합을 ProseMirror 스키마로 옮긴다(spec: editor-schema, design.md 2).
 * 여기는 구조(노드 · 마크 이름, content expression)와 DOM 매핑만 맡는다 — attrs 규칙의 원천은 zod 하나다.
 * 근거: https://tiptap.dev/docs/editor/core-concepts/schema ·
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node ·
 * https://prosemirror.net/docs/guide/#schema.content_expressions ·
 * https://prosemirror.net/docs/ref/#model.TagParseRule (DOM 매핑, editor-dom-paste design.md)
 */

// HTML 속성으로 내보내지 않는다 — 모양은 노드 renderHTML이 정한다.
// parseHTML을 두지 않으면 TipTap이 같은 이름의 HTML 속성을 그대로 읽는다(`<img width="800">` → 꾸밈 폭).
// 값은 노드 규칙의 getAttrs 한 곳에서만 검증해 받는다(editor-dom-paste design.md 2,
// @tiptap/core 3.31.3 injectExtensionAttributesToParseRule 소스로 확인 — 공식 문서에 없음)
const ignoreHtml = () => null;
const optional: Attribute = { default: null, rendered: false, parseHTML: ignoreHtml };
// TipTap은 isRequired면 default를 두지 않는다. ProseMirror는 attrs 객체가 아예 없으면 이것도 null로
// 채우므로(design.md 2) 누락의 최종 방어는 zod다 — 여기서는 키만 빠진 attrs를 막는다.
// 이 동작은 공식 문서에 없다 — @tiptap/core 3.31.3 buildAttributeSpec · prosemirror-model 1.25.12 computeAttrs 소스로 확인
const required: Attribute = { isRequired: true, rendered: false, parseHTML: ignoreHtml };

const decoration = { font: optional, motion: optional, stickers: optional };
const motionOnly = { motion: optional, stickers: optional };
const media = {
  naturalWidth: optional,
  naturalHeight: optional,
  motion: optional,
  width: optional,
  stickers: optional,
};

const isTag = (tag: string) => (element: ElementLike) => element.tagName === tag;

const Doc = Node.create({ name: "doc", topNode: true, content: "block+" });

const Text = Node.create({ name: "text", group: "inline" });

// block 그룹의 첫 노드가 ProseMirror의 기본 채움 블록이 된다 — 문단을 맨 앞에 둔다
const Paragraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "text*",
  addAttributes: () => decoration,
  parseHTML: () => [wrapperRule({ matches: isTag("P"), keys: ["font", "motion"] }), { tag: "p" }],
  renderHTML: ({ node }) => withDecoration(node.attrs, ["p", 0]),
});

const HEADING_TAG = /^H([1-6])$/;
const headingAttrs = (element: ElementLike) => {
  const tagLevel = HEADING_TAG.exec(element.tagName)?.[1];
  return tagLevel === undefined ? false : { level: headingLevelOf(Number(tagLevel)) };
};

const Heading = Node.create({
  name: "heading",
  group: "block",
  content: "text*",
  addAttributes: () => ({ level: required, ...decoration }),
  parseHTML: () => [
    wrapperRule({
      matches: (inner) => HEADING_TAG.test(inner.tagName),
      keys: ["font", "motion"],
      attrs: headingAttrs,
    }),
    ...["h1", "h2", "h3", "h4", "h5", "h6"].map((tag) => ({
      tag,
      getAttrs: (element: ElementLike) => headingAttrs(element),
    })),
  ],
  // 태그 이름은 닫힌 표에서만 — 검증되지 않은 level이 태그로 나가지 않게(content-render와 같은 원칙)
  renderHTML: ({ node }) => withDecoration(node.attrs, [node.attrs.level === 3 ? "h3" : "h2", 0]),
});

const listNode = (name: string, tag: "ul" | "ol") =>
  Node.create({
    name,
    group: "block",
    content: "listItem+",
    addAttributes: () => decoration,
    parseHTML: () => [
      wrapperRule({ matches: isTag(tag.toUpperCase()), keys: ["font", "motion"] }),
      { tag },
    ],
    renderHTML: ({ node }) => withDecoration(node.attrs, [tag, 0]),
  });

const BulletList = listNode("bulletList", "ul");
const OrderedList = listNode("orderedList", "ol");

// content-schema의 z.tuple([innerParagraph], innerList)와 같다 — 첫 자식은 문단, 뒤는 안쪽 목록만
const ListItem = Node.create({
  name: "listItem",
  content: "paragraph (bulletList | orderedList)*",
  parseHTML: () => [{ tag: "li" }],
  renderHTML: () => ["li", 0],
});

const Blockquote = Node.create({
  name: "blockquote",
  group: "block",
  content: "paragraph+",
  addAttributes: () => decoration,
  parseHTML: () => [
    wrapperRule({ matches: isTag("BLOCKQUOTE"), keys: ["font", "motion"] }),
    { tag: "blockquote" },
  ],
  renderHTML: ({ node }) => withDecoration(node.attrs, ["blockquote", 0]),
});

const codeAttrs = (pre: ElementLike) => ({
  language: languageOrNull(pre.querySelector("code")?.getAttribute("data-language")),
});

const CodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  addAttributes: () => ({ language: optional, ...motionOnly }),
  parseHTML: () => [
    wrapperRule({
      matches: isTag("PRE"),
      keys: ["motion"],
      attrs: codeAttrs,
      preserveWhitespace: "full",
    }),
    { tag: "pre", preserveWhitespace: "full" as const, getAttrs: codeAttrs },
  ],
  renderHTML: ({ node }) =>
    withDecoration(node.attrs, [
      "pre",
      [
        "code",
        node.attrs.language == null ? {} : { "data-language": String(node.attrs.language) },
        0,
      ],
    ]),
});

const HorizontalRule = Node.create({
  name: "horizontalRule",
  group: "block",
  atom: true,
  addAttributes: () => motionOnly,
  parseHTML: () => [
    wrapperRule({ matches: isTag("HR"), keys: ["motion"], hasContent: false }),
    { tag: "hr" },
  ],
  renderHTML: ({ node }) => withDecoration(node.attrs, ["hr"]),
});

const isTagWithClass = (tag: string, className: string) => (element: ElementLike) =>
  element.tagName === tag && hasClass(element, className);

const imageFromFigure = (figure: ElementLike) => {
  const img = figure.querySelector("img");
  return imageAttrsOf(img, img?.getAttribute("alt") ?? "");
};

const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes: () => ({ src: required, alt: required, ...media }),
  parseHTML: () => [
    wrapperRule({
      matches: isTagWithClass("FIGURE", "post-image"),
      keys: ["motion", "width"],
      attrs: imageFromFigure,
      hasContent: false,
    }),
    { tag: "figure.post-image", getAttrs: imageFromFigure },
    // 붙여넣은 맨 img — 경로 규칙 밖(절대 URL · data:)은 imageAttrsOf가 거부한다
    {
      tag: "img[src]",
      getAttrs: (img: ElementLike) => imageAttrsOf(img, img.getAttribute("alt") ?? ""),
    },
  ],
  renderHTML: ({ node }) =>
    withDecoration(node.attrs, [
      "figure",
      { class: "post-image" },
      imgSpec(node.attrs, String(node.attrs.alt)),
    ]),
});

const screenshotFromFigure = (figure: ElementLike) => {
  const attrs = imageAttrsOf(figure.querySelector("img"), null);
  if (attrs === false) return false;
  const caption = (figure.querySelector("figcaption")?.textContent ?? "").slice(
    0,
    CAPTION_MAX_LENGTH,
  );
  return { ...attrs, caption };
};

const AppScreenshot = Node.create({
  name: "appScreenshot",
  group: "block",
  atom: true,
  addAttributes: () => ({ src: required, caption: required, ...media }),
  parseHTML: () => [
    wrapperRule({
      matches: isTagWithClass("FIGURE", "post-screenshot"),
      keys: ["motion", "width"],
      attrs: screenshotFromFigure,
      hasContent: false,
    }),
    { tag: "figure.post-screenshot", getAttrs: screenshotFromFigure },
  ],
  renderHTML: ({ node }) =>
    withDecoration(node.attrs, [
      "figure",
      { class: "post-screenshot" },
      imgSpec(node.attrs, ""),
      ["figcaption", String(node.attrs.caption)],
    ]),
});

// 톤이 닫힌 집합 밖이면 콜아웃이 아니다 — 규칙이 거부하면 안의 문단은 일반 블록으로 읽힌다
const calloutAttrs = (aside: ElementLike) => {
  const tone = toneOrNull(aside.getAttribute("data-tone"));
  return tone === null ? false : { tone };
};

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "(paragraph | bulletList | orderedList)+",
  addAttributes: () => ({ tone: required, ...decoration }),
  parseHTML: () => [
    wrapperRule({
      matches: isTagWithClass("ASIDE", "post-callout"),
      keys: ["font", "motion"],
      attrs: calloutAttrs,
    }),
    { tag: "aside.post-callout", getAttrs: calloutAttrs },
  ],
  renderHTML: ({ node }) =>
    withDecoration(node.attrs, [
      "aside",
      { class: "post-callout", "data-tone": String(node.attrs.tone) },
      0,
    ]),
});

// 구글 독스는 붙여넣기 전체를 `<b style="font-weight:normal" id="docs-internal-guid-…">`로 감싼다
const NOT_BOLD_STYLE = /font-weight\s*:\s*normal/i;
const BOLD_WEIGHT = /^(?:bold|bolder|[7-9]\d\d)$/;

// 정의 순서 = ProseMirror 마크 정렬 순서(rank). 정규형(type 사전순)과 같게 둔다
const Bold = Mark.create({
  name: "bold",
  parseHTML: () => [
    { tag: "strong" },
    {
      tag: "b",
      getAttrs: (element: ElementLike) =>
        NOT_BOLD_STYLE.test(element.getAttribute("style") ?? "") ? false : null,
    },
    {
      style: "font-weight",
      getAttrs: (value: string) => (BOLD_WEIGHT.test(value.trim()) ? null : false),
    },
  ],
  renderHTML: () => ["strong", 0],
});

const Code = Mark.create({
  name: "code",
  parseHTML: () => [{ tag: "code" }],
  renderHTML: () => ["code", 0],
});

const Italic = Mark.create({
  name: "italic",
  parseHTML: () => [{ tag: "em" }, { tag: "i" }, { style: "font-style=italic" }],
  renderHTML: () => ["em", 0],
});

// 허용 목록 밖 href(javascript: 등)는 마크가 되지 않는다 — 글자는 남는다
const Link = Mark.create({
  name: "link",
  addAttributes: () => ({ href: required }),
  parseHTML: () => [
    {
      tag: "a[href]",
      getAttrs: (element: ElementLike) => {
        const href = hrefOrNull(element.getAttribute("href"));
        return href === null ? false : { href };
      },
    },
  ],
  renderHTML: ({ mark }) => ["a", { href: String(mark.attrs.href) }, 0],
});

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
