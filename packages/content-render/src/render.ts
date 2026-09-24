import {
  HEX_COLOR_PATTERN,
  HIGHLIGHT_COLORS,
  naturalSizeOf,
  TEXT_COLORS,
} from "@blog-editor/content-schema";
import type {
  Block,
  HEADING_LEVELS,
  Mark,
  NaturalSizeAttrs,
  PostFile,
  Sticker,
  TextNode,
  TextStyleAttrs,
} from "@blog-editor/content-schema";
import {
  CUSTOM_COLOR,
  HEADING_TAGS,
  MARK_INNER_TO_OUTER,
  TEXT_STYLE_COLOR_VARS,
} from "./constants";
import { escapeHtml } from "./escape";
import { STICKER_SIZES } from "./stickers";
import type {
  CalloutChild,
  Decoration,
  InnerList,
  InnerListItem,
  InnerParagraph,
  RenderContext,
  RenderOptions,
} from "./types";

// ── 진입점 ────────────────────────────────────────────────────────────

/**
 * doc를 결정적인 HTML 문자열로 바꾼다(spec: html-render). 순수 함수 — 입력을 바꾸지 않고,
 * 공백 · 줄바꿈 없이 이어 붙인다.
 */
export function renderHtml(file: Pick<PostFile, "doc">, options: RenderOptions): string {
  // 설정값이라 신뢰 입력이지만 속성에 들어가는 값은 예외 없이 이스케이프한다(spec: render-safety)
  const ctx: RenderContext = {
    imageBaseUrl: escapeHtml(stripOneTrailingSlash(options.imageBaseUrl)),
  };
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
        tag(headingTag(block.attrs.level), "", renderInline(block.content)),
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
          ` class="post-callout" data-tone="${escapeHtml(block.attrs.tone)}"`,
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

function renderImageFigure(
  attrs: { src: string; alt: string } & NaturalSizeAttrs,
  ctx: RenderContext,
): string {
  return tag("figure", ' class="post-image"', renderImg(attrs.src, attrs.alt, attrs, ctx));
}

function renderScreenshotFigure(
  attrs: { src: string; caption: string } & NaturalSizeAttrs,
  ctx: RenderContext,
): string {
  const img = renderImg(attrs.src, "", attrs, ctx);
  const figcaption = tag("figcaption", "", escapeHtml(attrs.caption));
  return tag("figure", ' class="post-screenshot"', `${img}${figcaption}`);
}

/**
 * 크기가 있으면 width · height를 낸다 — 본문용 CSS가 `width: 100%; height: auto`로 그리므로
 * 크기를 고정하지 않고 이미지가 오기 전에 비율 자리만 잡는다(레이아웃 밀림 방지, html-render).
 */
function renderImg(src: string, alt: string, attrs: NaturalSizeAttrs, ctx: RenderContext): string {
  const size = naturalSizeOf(attrs);
  const sizeAttrs = size === null ? "" : ` width="${size.width}" height="${size.height}"`;
  return `<img src="${ctx.imageBaseUrl}${escapeHtml(src)}" alt="${escapeHtml(alt)}"${sizeAttrs} loading="lazy" decoding="async">`;
}

// ── 인라인(텍스트 + 마크) ────────────────────────────────────────────────

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
    case "strike":
      return tag("s", "", inner);
    case "underline":
      return tag("u", "", inner);
    case "textStyle":
      return tag("span", textStyleAttrsHtml(mark.attrs), inner);
    default:
      return assertNever(mark);
  }
}

/** 속성 순서 고정: class → data-font → data-weight → data-size → data-color → data-highlight → style. */
function textStyleAttrsHtml(style: TextStyleAttrs): string {
  const color = colorAttr(style.color, TEXT_COLORS, TEXT_STYLE_COLOR_VARS.color);
  const highlight = colorAttr(style.highlight, HIGHLIGHT_COLORS, TEXT_STYLE_COLOR_VARS.highlight);
  const data = (name: string, value: string | undefined) =>
    value === undefined ? "" : ` data-${name}="${escapeHtml(value)}"`;
  const cssVars = [color.cssVar, highlight.cssVar].filter((value) => value !== undefined);
  return (
    ` class="post-ts"` +
    data("font", style.font) +
    data("weight", style.weight) +
    data("size", style.size) +
    data("color", color.data) +
    data("highlight", highlight.data) +
    (cssVars.length > 0 ? ` style="${cssVars.join(";")}"` : "")
  );
}

/**
 * 프리셋은 data 값 그대로, hex는 `custom` + CSS 변수. 스키마를 건너뛴 doc도 올 수 있어 hex 모양을
 * 여기서 다시 본다 — 이스케이프는 `;`로 다른 선언을 잇는 것을 막지 못한다(spec: render-decoration).
 */
function colorAttr(
  value: unknown,
  presets: readonly string[],
  cssVar: string,
): { data?: string | undefined; cssVar?: string | undefined } {
  // 문자열이 아니면 검사와 출력이 서로 다른 글자를 볼 수 있다(toString) — 문자열만 받는다
  if (typeof value !== "string") return {};
  if (HEX_COLOR_PATTERN.test(value)) return { data: CUSTOM_COLOR, cssVar: `${cssVar}:${value}` };
  return presets.includes(value) ? { data: value } : {};
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

/**
 * 빈 `stickers: []`는 "없음"으로 본다 — 정규형은 빈 배열을 지우지만 정규화 전 문서가 올 수 있고,
 * 스티커 없는 래퍼는 사이트 sanitizer가 허용해야 할 마크업만 늘린다.
 */
function hasDecoration(attrs: Decoration): boolean {
  return (
    attrs.font !== undefined ||
    attrs.motion !== undefined ||
    attrs.width !== undefined ||
    attrs.align !== undefined ||
    (attrs.stickers?.length ?? 0) > 0
  );
}

function finishBlock(elementHtml: string, decoration: Decoration, ctx: RenderContext): string {
  return hasDecoration(decoration) ? wrapDecoration(elementHtml, decoration, ctx) : elementHtml;
}

/** 속성 순서 고정: class → data-font → data-motion → data-align → style(spec: render-decoration). */
function wrapDecoration(elementHtml: string, attrs: Decoration, ctx: RenderContext): string {
  // enum · 정수라 타입상 닫혀 있지만, 검증을 건너뛴 doc가 와도 속성 경계는 지킨다(spec: render-safety)
  const fontAttr = attrs.font !== undefined ? ` data-font="${escapeHtml(attrs.font)}"` : "";
  const motionAttr = attrs.motion !== undefined ? ` data-motion="${escapeHtml(attrs.motion)}"` : "";
  const alignAttr = attrs.align !== undefined ? ` data-align="${escapeHtml(attrs.align)}"` : "";
  const styleAttr =
    attrs.width !== undefined ? ` style="--w:${escapeHtml(String(attrs.width))}"` : "";
  const stickersHtml = (attrs.stickers ?? [])
    .map((sticker) => renderSticker(sticker, ctx))
    .join("");
  return tag(
    "div",
    ` class="post-block"${fontAttr}${motionAttr}${alignAttr}${styleAttr}`,
    elementHtml + stickersHtml,
  );
}

function renderSticker(sticker: Sticker, ctx: RenderContext): string {
  const size = Object.hasOwn(STICKER_SIZES, sticker.id) ? STICKER_SIZES[sticker.id] : undefined;
  if (size === undefined)
    throw new RangeError(`renderHtml: 알 수 없는 스티커 id — ${String(sticker.id)}`);
  const { width, height } = size;
  const e = (value: number) => escapeHtml(String(value));
  const style = `--x:${e(sticker.x)};--y:${e(sticker.y)};--s:${e(sticker.size)};--r:${e(sticker.rotate)}`;
  const id = escapeHtml(sticker.id);
  return (
    `<img class="post-sticker" src="${ctx.imageBaseUrl}/stickers/${id}.png" alt="" ` +
    `width="${width}" height="${height}" loading="lazy" decoding="async" style="${style}">`
  );
}

// ── 작은 조립 헬퍼 ────────────────────────────────────────────────────────

function headingTag(level: (typeof HEADING_LEVELS)[number]): string {
  // 일반 객체는 "toString" 같은 프로토타입 키도 값을 돌려준다 — 자기 키만 표로 본다
  const name = Object.hasOwn(HEADING_TAGS, level) ? HEADING_TAGS[level] : undefined;
  if (name === undefined)
    throw new RangeError(`renderHtml: 허용되지 않는 heading level — ${String(level)}`);
  return name;
}

function tag(name: string, attrsHtml: string, inner: string): string {
  return `<${name}${attrsHtml}>${inner}</${name}>`;
}

function assertNever(value: never): never {
  throw new Error(`renderHtml: 처리하지 않은 값 — ${JSON.stringify(value)}`);
}
