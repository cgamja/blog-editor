import { MarkdownParser } from "prosemirror-markdown";
import { parseCalloutTone } from "./check";
import { DEFAULT_CALLOUT_TONE } from "./constants";
import { pmSchema } from "./pm-schema";
import { createMarkdownIt, imageAltText } from "./tokens";
import type { BlockRecord, ResolvedDirective } from "./types";

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
  ordered_list: { block: "orderedList" },
  list_item: { block: "listItem" },
  code_block: { block: "codeBlock", noCloseToken: true },
  fence: {
    block: "codeBlock",
    noCloseToken: true,
    getAttrs: (tok) => (tok.info.trim() !== "" ? { language: tok.info.trim() } : {}),
  },
  hr: { node: "horizontalRule" },
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
        ...naturalSizeOf(directive),
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
      ...naturalSizeOf(directive),
    },
  };
}

/** size 지시어는 두 값을 함께 채운다(directives.ts) — 한쪽만 옮기는 경로는 없다. */
function naturalSizeOf(directive: ResolvedDirective | undefined): Record<string, number> {
  if (directive?.naturalWidth === undefined || directive.naturalHeight === undefined) return {};
  return { naturalWidth: directive.naturalWidth, naturalHeight: directive.naturalHeight };
}

function withDecoration(block: RawNode, directive: ResolvedDirective | undefined): RawNode {
  if (!directive) return block;
  const attrs: Record<string, unknown> = { ...(block.attrs ?? {}) };
  if (directive.font !== undefined) attrs.font = directive.font;
  if (directive.motion !== undefined) attrs.motion = directive.motion;
  return { ...block, attrs };
}

function applyTopLevelBlock(block: RawNode, directive: ResolvedDirective | undefined): RawNode {
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
