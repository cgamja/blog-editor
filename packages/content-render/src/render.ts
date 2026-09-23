import type {
  Block,
  DecorationAttrs,
  Mark,
  PostFile,
  Sticker,
  TextNode,
} from "@blog-editor/content-schema";
import { escapeHtml } from "./escape";
import { STICKER_SIZES } from "./stickers";

/** 이미지 · 스티커 경로 앞에 붙는 도메인(plan 3-8). 문서에는 경로만 있다. */
export interface RenderOptions {
  imageBaseUrl: string;
}

interface RenderContext {
  imageBaseUrl: string;
}

// ── 안쪽 노드(blockquote · callout · listItem 안) — attrs 자리가 없다(spec: html-render) ──
// content-schema는 이 모양을 내부 타입으로만 쓰고 export하지 않는다. 여기서는 구조적으로
// 같은 모양을 다시 선언해 쓴다 — z.infer 결과가 구조적으로 일치하므로 그대로 대입된다.

interface InnerParagraph {
  type: "paragraph";
  content?: TextNode[] | undefined;
}
interface InnerListItem {
  type: "listItem";
  content: [InnerParagraph, ...InnerList[]];
}
interface InnerBulletList {
  type: "bulletList";
  content: InnerListItem[];
}
interface InnerOrderedList {
  type: "orderedList";
  content: InnerListItem[];
}
type InnerList = InnerBulletList | InnerOrderedList;
type CalloutChild = InnerParagraph | InnerList;

/**
 * 최상위 블록 attrs 중 꾸미기 필드만 뽑은 모양 — DecorationAttrs(Partial)를 그대로 쓰지 않는다.
 * exactOptionalPropertyTypes 아래에서 zod가 만드는 실제 attrs 타입은 `font?: F | undefined`처럼
 * optional 필드에 명시적 undefined가 섞여 있어 Partial<{ font: F }>(= `font?: F`, undefined
 * 불가)에 그대로 대입되지 않는다 — 여기서만 명시적으로 `| undefined`를 더해 받아들인다.
 */
interface Decoration {
  font?: DecorationAttrs["font"] | undefined;
  motion?: DecorationAttrs["motion"] | undefined;
  width?: DecorationAttrs["width"] | undefined;
  stickers?: DecorationAttrs["stickers"] | undefined;
}

// ── 진입점 ────────────────────────────────────────────────────────────

/**
 * doc를 결정적인 HTML 문자열로 바꾼다(spec: html-render). 순수 함수 — 입력을 바꾸지 않고,
 * 공백 · 줄바꿈 없이 이어 붙인다.
 */
export function renderHtml(file: Pick<PostFile, "doc">, options: RenderOptions): string {
  const ctx: RenderContext = { imageBaseUrl: stripOneTrailingSlash(options.imageBaseUrl) };
  const blocksHtml = file.doc.content.map((block) => renderTopLevelBlock(block, ctx)).join("");
  return `<div class="post-body">${blocksHtml}</div>`;
}

function stripOneTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

// ── 최상위 블록 — 타입별 분기는 여기 switch 한 곳(exhaustive) ────────────────

function renderTopLevelBlock(block: Block, ctx: RenderContext): string {
  switch (block.type) {
    case "paragraph":
      return finishBlock(tag("p", "", renderInline(block.content)), block.attrs ?? {}, ctx);
    case "heading":
      return finishBlock(
        tag(`h${block.attrs.level}`, "", renderInline(block.content)),
        block.attrs,
        ctx,
      );
    case "bulletList":
      return finishBlock(
        tag("ul", "", block.content.map(renderListItem).join("")),
        block.attrs ?? {},
        ctx,
      );
    case "orderedList":
      return finishBlock(
        tag("ol", "", block.content.map(renderListItem).join("")),
        block.attrs ?? {},
        ctx,
      );
    case "blockquote":
      return finishBlock(
        tag("blockquote", "", block.content.map(renderInnerParagraph).join("")),
        block.attrs ?? {},
        ctx,
      );
    case "codeBlock":
      return finishBlock(renderCodeBlock(block.attrs, block.content), block.attrs ?? {}, ctx);
    case "horizontalRule":
      return finishBlock("<hr>", block.attrs ?? {}, ctx);
    case "image":
      return finishBlock(renderImageFigure(block.attrs, ctx), block.attrs, ctx);
    case "appScreenshot":
      return finishBlock(renderScreenshotFigure(block.attrs, ctx), block.attrs, ctx);
    case "callout":
      return finishBlock(
        tag(
          "aside",
          ` class="post-callout" data-tone="${block.attrs.tone}"`,
          block.content.map(renderCalloutChild).join(""),
        ),
        block.attrs,
        ctx,
      );
    default:
      return assertNever(block);
  }
}

// ── 블록별 요소 렌더러 ────────────────────────────────────────────────────

function renderCodeBlock(
  attrs: { language?: string | undefined } | undefined,
  content: readonly { text: string }[] | undefined,
): string {
  const languageAttr =
    attrs?.language !== undefined ? ` data-language="${escapeHtml(attrs.language)}"` : "";
  const text = (content ?? []).map((node) => escapeHtml(node.text)).join("");
  return `<pre>${tag("code", languageAttr, text)}</pre>`;
}

function renderImageFigure(attrs: { src: string; alt: string }, ctx: RenderContext): string {
  return tag("figure", ' class="post-image"', renderImg(attrs.src, attrs.alt, ctx));
}

function renderScreenshotFigure(
  attrs: { src: string; caption: string },
  ctx: RenderContext,
): string {
  const img = renderImg(attrs.src, "", ctx);
  const figcaption = tag("figcaption", "", escapeHtml(attrs.caption));
  return tag("figure", ' class="post-screenshot"', `${img}${figcaption}`);
}

function renderImg(src: string, alt: string, ctx: RenderContext): string {
  return `<img src="${ctx.imageBaseUrl}${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

// ── 인라인(텍스트 + 마크) ────────────────────────────────────────────────

/** 바깥부터 a > strong > em > code 고정(입력 마크 순서 무관, spec: html-render) — 안에서 바깥으로 감싼다. */
const MARK_INNER_TO_OUTER: readonly Mark["type"][] = ["code", "italic", "bold", "link"];

function renderInline(content: readonly TextNode[] | undefined): string {
  return (content ?? []).map(renderText).join("");
}

function renderText(node: TextNode): string {
  return wrapMarks(escapeHtml(node.text), node.marks);
}

function wrapMarks(escapedText: string, marks: readonly Mark[] | undefined): string {
  if (!marks || marks.length === 0) return escapedText;
  const byType = new Map(marks.map((mark) => [mark.type, mark] as const));
  let html = escapedText;
  for (const type of MARK_INNER_TO_OUTER) {
    const mark = byType.get(type);
    if (mark) html = wrapMark(mark, html);
  }
  return html;
}

function wrapMark(mark: Mark, inner: string): string {
  switch (mark.type) {
    case "bold":
      return tag("strong", "", inner);
    case "italic":
      return tag("em", "", inner);
    case "code":
      return tag("code", "", inner);
    case "link":
      return tag("a", ` href="${escapeHtml(mark.attrs.href)}"`, inner);
    default:
      return assertNever(mark);
  }
}

// ── 안쪽 노드(blockquote · callout · listItem 안, attrs 없음) ────────────────

function renderInnerParagraph(node: InnerParagraph): string {
  return tag("p", "", renderInline(node.content));
}

function renderListItem(item: InnerListItem): string {
  const [paragraph, ...lists] = item.content;
  return tag("li", "", renderInnerParagraph(paragraph) + lists.map(renderInnerList).join(""));
}

function renderInnerList(list: InnerList): string {
  const itemsHtml = list.content.map(renderListItem).join("");
  return list.type === "bulletList" ? tag("ul", "", itemsHtml) : tag("ol", "", itemsHtml);
}

function renderCalloutChild(node: CalloutChild): string {
  return node.type === "paragraph" ? renderInnerParagraph(node) : renderInnerList(node);
}

// ── 꾸미기 래퍼 + 스티커(spec: render-decoration) ────────────────────────────

/** 최상위 블록 attrs에 font/motion/width/stickers 중 하나라도 실제로 있을 때만 감싼다. */
function hasDecoration(attrs: Decoration): boolean {
  return (
    attrs.font !== undefined ||
    attrs.motion !== undefined ||
    attrs.width !== undefined ||
    (attrs.stickers?.length ?? 0) > 0
  );
}

function finishBlock(elementHtml: string, decoration: Decoration, ctx: RenderContext): string {
  return hasDecoration(decoration) ? wrapDecoration(elementHtml, decoration, ctx) : elementHtml;
}

/** 속성 순서 고정: class → data-font → data-motion → style(spec: render-decoration). */
function wrapDecoration(elementHtml: string, attrs: Decoration, ctx: RenderContext): string {
  const fontAttr = attrs.font !== undefined ? ` data-font="${attrs.font}"` : "";
  const motionAttr = attrs.motion !== undefined ? ` data-motion="${attrs.motion}"` : "";
  const styleAttr = attrs.width !== undefined ? ` style="--w:${attrs.width}"` : "";
  const stickersHtml = (attrs.stickers ?? [])
    .map((sticker) => renderSticker(sticker, ctx))
    .join("");
  return tag(
    "div",
    ` class="post-block"${fontAttr}${motionAttr}${styleAttr}`,
    elementHtml + stickersHtml,
  );
}

function renderSticker(sticker: Sticker, ctx: RenderContext): string {
  const { width, height } = STICKER_SIZES[sticker.id];
  const style = `--x:${sticker.x};--y:${sticker.y};--s:${sticker.size};--r:${sticker.rotate}`;
  return (
    `<img class="post-sticker" src="${ctx.imageBaseUrl}/stickers/${sticker.id}.png" alt="" ` +
    `width="${width}" height="${height}" loading="lazy" decoding="async" style="${style}">`
  );
}

// ── 작은 조립 헬퍼 ────────────────────────────────────────────────────────

function tag(name: string, attrsHtml: string, inner: string): string {
  return `<${name}${attrsHtml}>${inner}</${name}>`;
}

function assertNever(value: never): never {
  throw new Error(`renderHtml: 처리하지 않은 값 — ${JSON.stringify(value)}`);
}
