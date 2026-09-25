import { naturalSizeOf } from "@blog-editor/content-schema";
import { MarkdownParser } from "prosemirror-markdown";
import type Token from "markdown-it/lib/token.mjs";
import { parseCalloutTone } from "./check";
import { DEFAULT_CALLOUT_TONE } from "./constants";
import { pmSchema } from "./pm-schema";
import { createMarkdownIt, imageAltText } from "./tokens";
import type { BlockRecord, ResolvedDirective } from "./types";

/** markdown-it이 구분 줄(`:-:` · `--:` · `:--`)을 칸의 `style="text-align:…"`로 싣는다 */
const CELL_ALIGN_STYLE = /^text-align:(left|center|right)$/;

function cellAlignOf(tok: Token): string | undefined {
  return CELL_ALIGN_STYLE.exec(tok.attrGet("style") ?? "")?.[1];
}

/**
 * markdown-it 토큰 → doc 노드 대응표(adr-013 ②). check.ts가 stage 1에서 정의 밖 토큰을 전부
 * 거부한 뒤에만 이 파서를 부르므로, 여기 없는 토큰 타입은 나타나지 않는다는 전제로 짠다 — 혹시
 * 전제가 깨지면 MarkdownParser가 "Token type not supported" 예외를 던지고, convert.ts의
 * try/catch가 그걸 내부 오류 메시지로 바꾼다(계약: 절대 던지지 않는다).
 *
 * font · motion · width(꾸미기 attrs)는 여기 없다 — 지시어 줄은 파싱 전에 걷어냈으므로 markdown
 * 토큰에 아예 나타나지 않는다. buildDoc이 stage 1에서 모은 지시어 값을 doc JSON에 직접 얹는다.
 */
const markdownParser = new MarkdownParser(pmSchema, createMarkdownIt(), {
  paragraph: { block: "paragraph" },
  heading: { block: "heading", getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) }) },
  blockquote: { block: "blockquote" },
  bullet_list: { block: "bulletList" },
  // markdown-it은 첫 표지 번호가 1이 아닐 때만 start 속성을 싣는다 — 1은 정규형에서 지우므로 두지 않는다
  ordered_list: {
    block: "orderedList",
    getAttrs: (tok) => {
      const start = tok.attrGet("start");
      return start === null ? {} : { start: Number(start) };
    },
  },
  list_item: { block: "listItem" },
  code_block: { block: "codeBlock", noCloseToken: true },
  fence: {
    block: "codeBlock",
    noCloseToken: true,
    getAttrs: (tok) => (tok.info.trim() !== "" ? { language: tok.info.trim() } : {}),
  },
  hr: { node: "horizontalRule" },
  // GFM 표(adr-028) — 머리 행은 자리(첫 행)라 thead · tbody 틀은 노드가 아니다. 열 정렬은 머리 칸에만 둔다
  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "tableRow" },
  th: { block: "tableCell", getAttrs: (tok) => ({ align: cellAlignOf(tok) }) },
  td: { block: "tableCell" },
  image: {
    node: "image",
    getAttrs: (tok) => ({ src: tok.attrGet("src") ?? "", alt: imageAltText(tok) }),
  },
  container_callout: {
    block: "callout",
    getAttrs: (tok) => {
      const tone = parseCalloutTone(tok.info);
      return { tone: tone.ok ? tone.tone : DEFAULT_CALLOUT_TONE };
    },
  },
  em: { mark: "italic" },
  strong: { mark: "bold" },
  code_inline: { mark: "code", noCloseToken: true },
  link: { mark: "link", getAttrs: (tok) => ({ href: tok.attrGet("href") ?? "" }) },
  s: { mark: "strike" },
  underline: { mark: "underline" },
  // 값은 span.ts가 검사해 meta에 둔 것 — check.ts가 문제를 전부 거부한 뒤라 유효한 값만 온다
  textstyle: { mark: "textStyle", getAttrs: (tok) => (tok.meta as { attrs: object }).attrs },
  // span_open/close는 검사용 틀이라 마크를 만들지 않는다
  span: { ignore: true },
});

interface RawNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RawNode[];
  marks?: unknown[];
  text?: string;
}

/**
 * 이미지는 markdown 문법상 문단의 인라인 자식으로 파싱되지만(prosemirror-markdown 기본 규칙),
 * check.ts가 "글자와 섞이지 않고 최상위에 홀로 있는 이미지"만 통과시켰으므로 그 문단을 최상위
 * image(또는 frame=app이면 appScreenshot) 블록으로 푼다.
 */
function toImageBlock(image: RawNode, directive: ResolvedDirective | undefined): RawNode {
  const src = (image.attrs?.src as string | undefined) ?? "";
  const alt = (image.attrs?.alt as string | undefined) ?? "";

  if (directive?.isAppScreenshot) {
    return {
      type: "appScreenshot",
      attrs: {
        src,
        caption: alt,
        ...(directive.motion !== undefined ? { motion: directive.motion } : {}),
        ...(directive.width !== undefined ? { width: directive.width } : {}),
        ...(directive.align !== undefined ? { align: directive.align } : {}),
        ...naturalSizeAttrs(directive),
      },
    };
  }
  return {
    type: "image",
    attrs: {
      src,
      alt,
      ...(directive?.motion !== undefined ? { motion: directive.motion } : {}),
      ...(directive?.width !== undefined ? { width: directive.width } : {}),
      ...(directive?.align !== undefined ? { align: directive.align } : {}),
      ...naturalSizeAttrs(directive),
    },
  };
}

function naturalSizeAttrs(directive: ResolvedDirective | undefined): Record<string, number> {
  const size = naturalSizeOf(directive ?? {});
  return size === null ? {} : { naturalWidth: size.width, naturalHeight: size.height };
}

function withDecoration(block: RawNode, directive: ResolvedDirective | undefined): RawNode {
  if (!directive) return block;
  const attrs: Record<string, unknown> = { ...(block.attrs ?? {}) };
  if (directive.font !== undefined) attrs.font = directive.font;
  if (directive.motion !== undefined) attrs.motion = directive.motion;
  if (directive.align !== undefined) attrs.align = directive.align;
  return { ...block, attrs };
}

/** 칸의 인라인을 문서 모양(칸 안 문단 하나)으로 감싼다 — 정렬 없는 칸은 attrs를 두지 않는다 */
function toTableBlock(table: RawNode): RawNode {
  const rows = (table.content ?? []).map((row) => ({
    ...row,
    content: (row.content ?? []).map((cell) => {
      const paragraph: RawNode =
        cell.content === undefined
          ? { type: "paragraph" }
          : { type: "paragraph", content: cell.content };
      const align = cell.attrs?.align;
      return align === undefined
        ? { type: "tableCell", content: [paragraph] }
        : { type: "tableCell", attrs: { align }, content: [paragraph] };
    }),
  }));
  return { type: "table", content: rows };
}

function applyTopLevelBlock(block: RawNode, directive: ResolvedDirective | undefined): RawNode {
  if (block.type === "table") return withDecoration(toTableBlock(block), directive);
  const solelyImage =
    block.type === "paragraph" && block.content?.length === 1 && block.content[0]?.type === "image";
  if (solelyImage) return toImageBlock(block.content![0]!, directive);
  return withDecoration(block, directive);
}

/**
 * stage 1이 오류 없이 끝났을 때만 부른다(adr-013). `topLevelRecords`는 check.ts의 레지스트리 중
 * container === "top"인 것만, PM이 만드는 doc.content와 같은 순서 · 같은 개수라는 전제로 index로
 * 짝짓는다(둘 다 같은 strippedText를 같은 markdown-it 설정으로 토큰화한 결과라 보장된다).
 */
export function buildDoc(
  strippedText: string,
  topLevelRecords: readonly BlockRecord[],
  resolvedByMapStart: ReadonlyMap<number, ResolvedDirective>,
): unknown {
  const parsed = markdownParser.parse(strippedText);
  const raw = parsed.toJSON() as RawNode;
  const content = (raw.content ?? []).map((block, i) => {
    const record = topLevelRecords[i];
    const directive = record ? resolvedByMapStart.get(record.mapStart0) : undefined;
    return applyTopLevelBlock(block, directive);
  });
  return { type: "doc", content };
}
