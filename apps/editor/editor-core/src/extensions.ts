import { Extension, Mark, Node, getSchema } from "@tiptap/core";
import type { Attribute } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { CAPTION_MAX_LENGTH } from "@blog-editor/content-schema";
import { splitBlockKeepingStickers } from "./commands/split-block";
import { pasteNormalizer } from "./plugins/paste-normalizer";
import {
  headingLevelOf,
  hrefOrNull,
  languageOrNull,
  orderedListStartOrNull,
  toneOrNull,
} from "./closed-values";
import {
  TEXT_STYLE_TAG,
  hasClass,
  imageAttrsOf,
  imgSpec,
  readTextStyle,
  textStyleSpec,
  withDecoration,
  wrapperRule,
} from "./dom";
import type { ElementLike } from "./dom";
import { STICKER_SPLIT_PRIORITY } from "./keymap-priority.constants";

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
// 나눈 블록에 스티커가 복제되면 문서 상한을 넘어 blockGuard가 Enter를 거부한다 — 앞 블록에만 남긴다.
// TipTap splitBlock이 끝에서 나눌 때만 효력이 있다(스티커 있는 블록의 Enter는 StickerSafeSplit). https://tiptap.dev/docs/editor/extensions/custom-extensions/extend-existing#attributes
const stickers: Attribute = { ...optional, keepOnSplit: false };

const decoration = { font: optional, motion: optional, stickers };
// 정렬은 문단 · 제목 · 이미지 · 스크린샷만(ADR-020) — 목록 · 인용 · 콜아웃은 정렬하지 않는다
const alignedText = { ...decoration, align: optional };
const motionOnly = { motion: optional, stickers };
const media = {
  naturalWidth: optional,
  naturalHeight: optional,
  motion: optional,
  width: optional,
  align: optional,
  stickers,
};

const isTag = (tag: string) => (element: ElementLike) => element.tagName === tag;

const Doc = Node.create({ name: "doc", topNode: true, content: "block+" });

const Text = Node.create({ name: "text", group: "inline" });

// block 그룹의 첫 노드가 ProseMirror의 기본 채움 블록이 된다 — 문단을 맨 앞에 둔다
const Paragraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "text*",
  addAttributes: () => alignedText,
  parseHTML: () => [
    wrapperRule({ matches: isTag("P"), keys: ["font", "motion", "align"] }),
    { tag: "p" },
  ],
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
  addAttributes: () => ({ level: required, ...alignedText }),
  parseHTML: () => [
    wrapperRule({
      matches: (inner) => HEADING_TAG.test(inner.tagName),
      keys: ["font", "motion", "align"],
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

const BulletList = Node.create({
  name: "bulletList",
  group: "block",
  content: "listItem+",
  addAttributes: () => decoration,
  parseHTML: () => [wrapperRule({ matches: isTag("UL"), keys: ["font", "motion"] }), { tag: "ul" }],
  renderHTML: ({ node }) => withDecoration(node.attrs, ["ul", 0]),
});

// 시작 번호는 `<ol start>`로 오간다(ordered-list-start) — 공개 HTML(content-render)과 같은 어휘
const olStartAttrs = (element: ElementLike) => ({
  start: orderedListStartOrNull(element.getAttribute("start")),
});

const OrderedList = Node.create({
  name: "orderedList",
  group: "block",
  content: "listItem+",
  addAttributes: () => ({ ...decoration, start: optional }),
  parseHTML: () => [
    wrapperRule({ matches: isTag("OL"), keys: ["font", "motion"], attrs: olStartAttrs }),
    { tag: "ol", getAttrs: (element: ElementLike) => olStartAttrs(element) },
  ],
  renderHTML: ({ node }) =>
    withDecoration(
      node.attrs,
      node.attrs.start == null ? ["ol", 0] : ["ol", { start: String(node.attrs.start) }, 0],
    ),
});

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
      keys: ["motion", "width", "align"],
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
      keys: ["motion", "width", "align"],
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

const Strike = Mark.create({
  name: "strike",
  parseHTML: () => [{ tag: "s" }, { tag: "del" }, { tag: "strike" }],
  renderHTML: () => ["s", 0],
});

// 우리 어휘(span.post-ts)만 읽는다 — 남의 사이트 인라인 색 · 크기는 닫힌 집합 밖이라 마크가 되지 않는다
const TextStyle = Mark.create({
  name: "textStyle",
  addAttributes: () => ({
    font: optional,
    weight: optional,
    size: optional,
    color: optional,
    highlight: optional,
  }),
  parseHTML: () => [{ tag: TEXT_STYLE_TAG, getAttrs: readTextStyle }],
  renderHTML: ({ mark }) => textStyleSpec(mark.attrs),
});

const Underline = Mark.create({
  name: "underline",
  parseHTML: () => [{ tag: "u" }],
  renderHTML: () => ["u", 0],
});

/**
 * 스티커가 있는 블록의 Enter를 splitBlockKeepingStickers에 넘긴다 — 등록만(design.md 6, .claude/rules/editor.md).
 * TipTap chain은 중간 커맨드가 실패해도 dispatch하므로 체인으로 잇지 않는다.
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#keyboard-shortcuts
 */
const StickerSafeSplit = Extension.create({
  name: "stickerSafeSplit",
  priority: STICKER_SPLIT_PRIORITY,
  addKeyboardShortcuts: () => ({
    Enter: ({ editor }) =>
      editor.commands.command(({ state, dispatch }) => splitBlockKeepingStickers(state, dispatch)),
  }),
});

/** 붙여넣기 정규화를 에디터 기본으로 켠다(spec: editor-paste). */
const PasteNormalizer = Extension.create({
  name: "pasteNormalizer",
  addProseMirrorPlugins: () => [pasteNormalizer()],
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
  // 마크 등록 순서 = ProseMirror rank = DOM에서 바깥부터 감싸는 순서. 공개 HTML과 같게
  // a > span.post-ts > u > s > strong > em > code (content-render MARK_INNER_TO_OUTER의 역순).
  // 저장 형식의 마크 순서(type 사전순)는 docFromNode의 normalize가 따로 맞춘다
  Link,
  TextStyle,
  Underline,
  Strike,
  Bold,
  Italic,
  Code,
  StickerSafeSplit,
  PasteNormalizer,
];

export function createEditorSchema(): Schema {
  return getSchema(editorExtensions);
}
