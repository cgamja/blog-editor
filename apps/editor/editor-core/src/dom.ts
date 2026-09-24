import type { Attrs, DOMOutputSpec, TagParseRule } from "@tiptap/pm/model";
import { ALT_MAX_LENGTH, textStyleAttrsSchema } from "@blog-editor/content-schema";
import {
  alignOrNull,
  fontOrNull,
  hexColorOrNull,
  highlightPresetOrNull,
  imagePathOrNull,
  motionOrNull,
  naturalSizeFrom,
  textColorPresetOrNull,
  textSizeOrNull,
  textWeightOrNull,
  widthOrNull,
} from "./closed-values";

/**
 * 파싱이 쓰는 요소의 최소 모양. tsconfig lib에 DOM이 없어(ES2022) `HTMLElement` 대신 이것을 쓴다 —
 * 브라우저의 실제 요소도 이 모양을 만족한다(design.md 5).
 */
export interface ElementLike {
  readonly tagName: string;
  readonly textContent: string | null;
  readonly firstElementChild: ElementLike | null;
  getAttribute(name: string): string | null;
  querySelector(selector: string): ElementLike | null;
}

export type DecorationKey = "font" | "motion" | "width" | "align";

// content-render의 꾸밈 래퍼와 같은 어휘(spec: render-decoration) — 에디터 DOM도 같은 구조로 낸다
const WRAPPER_CLASS = "post-block";
const WRAPPER_TAG = `div.${WRAPPER_CLASS}`;
const STICKER_CLASS = "post-sticker";
// 에디터 출처 기준 경로 — 배포(M4)에서는 같은 CloudFront 배포가 `/stickers/*`를 자산 버킷으로 라우팅한다
const STICKER_PATH = "/stickers/";
const WIDTH_STYLE = /(?:^|;)\s*--w\s*:\s*([^;]*)/;

export function hasClass(element: ElementLike, className: string): boolean {
  return (element.getAttribute("class") ?? "").split(/\s+/).includes(className);
}

function decorationDomAttrs(attrs: Attrs): Record<string, string> {
  const dom: Record<string, string> = {};
  if (attrs.font != null) dom["data-font"] = String(attrs.font);
  if (attrs.motion != null) dom["data-motion"] = String(attrs.motion);
  if (attrs.align != null) dom["data-align"] = String(attrs.align);
  if (attrs.width != null) dom.style = `--w:${String(attrs.width)}`;
  return dom;
}

// 값은 스키마 attrs(blockGuard가 zod로 지킨 닫힌 집합)라 여기서 다시 검증하지 않는다
type StickerAttrs = { id: unknown; x: unknown; y: unknown; size: unknown; rotate: unknown };

/**
 * 공개 HTML의 `img.post-sticker`와 같은 어휘. 편집용으로 편집 불가 · 브라우저 기본 이미지 끌기 끔을 더하고,
 * 크기 속성(content-render STICKER_SIZES)은 내지 않는다 — absolute라 레이아웃 이동이 없다(decoration-visible design.md 2).
 */
function stickerSpec(sticker: StickerAttrs): DOMOutputSpec {
  const { id, x, y, size, rotate } = sticker;
  return [
    "img",
    {
      class: STICKER_CLASS,
      src: `${STICKER_PATH}${String(id)}.png`,
      alt: "",
      contenteditable: "false",
      draggable: "false",
      style: `--x:${String(x)};--y:${String(y)};--s:${String(size)};--r:${String(rotate)}`,
    },
  ];
}

/**
 * 꾸밈이나 스티커가 있으면 공개 HTML처럼 `div.post-block`으로 감싸고, 스티커는 블록 요소 뒤(같은 래퍼 안)에 둔다.
 * 구멍(0)은 부모(블록 요소)의 유일한 자식이기만 하면 되고 래퍼는 형제를 가질 수 있다 —
 * https://prosemirror.net/docs/ref/#model.DOMOutputSpec (decoration-visible design.md 1: NodeView 대신 toDOM)
 */
export function withDecoration(attrs: Attrs, element: DOMOutputSpec): DOMOutputSpec {
  const dom = decorationDomAttrs(attrs);
  const stickers = (attrs.stickers ?? []) as readonly StickerAttrs[];
  if (Object.keys(dom).length === 0 && stickers.length === 0) return element;
  return ["div", { class: WRAPPER_CLASS, ...dom }, element, ...stickers.map(stickerSpec)];
}

function readDecoration(wrapper: ElementLike, keys: readonly DecorationKey[]): Attrs {
  const read: Record<DecorationKey, unknown> = {
    font: fontOrNull(wrapper.getAttribute("data-font")),
    motion: motionOrNull(wrapper.getAttribute("data-motion")),
    width: widthOrNull(WIDTH_STYLE.exec(wrapper.getAttribute("style") ?? "")?.[1]),
    align: alignOrNull(wrapper.getAttribute("data-align")),
  };
  return Object.fromEntries(
    keys.map((key) => [key, read[key]]).filter(([, value]) => value !== null),
  );
}

/**
 * 꾸밈 래퍼 규칙 — 첫 자식이 이 노드의 요소일 때만 받는다. 여러 노드가 같은 래퍼 태그를 쓰므로
 * 맞지 않으면 false로 다음 규칙에 넘긴다. 내용은 `contentElement`로 안쪽 요소에서 읽는다.
 */
export function wrapperRule(options: {
  matches: (inner: ElementLike) => boolean;
  keys: readonly DecorationKey[];
  attrs?: (inner: ElementLike) => Attrs | false;
  hasContent?: boolean;
  preserveWhitespace?: TagParseRule["preserveWhitespace"];
}): TagParseRule {
  const { matches, keys, attrs, hasContent = true, preserveWhitespace } = options;
  const getAttrs = (element: ElementLike): Attrs | false => {
    const inner = element.firstElementChild;
    if (inner === null || !matches(inner)) return false;
    const own = attrs ? attrs(inner) : {};
    return own === false ? false : { ...own, ...readDecoration(element, keys) };
  };
  // ElementLike는 HTMLElement의 부분 모양이라 두 콜백만 단언한다 — DOM lib이 있는 소비자(editor-react)에서는
  // ElementLike 매개변수를 HTMLElement 자리에 그대로 둘 수 없다(TS2352). 나머지 키는 satisfies로 검사한다
  const contentElement = (element: ElementLike) => element.firstElementChild;
  return {
    tag: WRAPPER_TAG,
    ...(preserveWhitespace === undefined ? {} : { preserveWhitespace }),
    getAttrs: getAttrs as unknown as NonNullable<TagParseRule["getAttrs"]>,
    ...(hasContent
      ? { contentElement: contentElement as unknown as NonNullable<TagParseRule["contentElement"]> }
      : {}),
  } satisfies TagParseRule;
}

/** `img` 한 개에서 이미지 attrs — 경로 규칙 밖이면 false(노드가 되지 않는다). */
export function imageAttrsOf(img: ElementLike | null, alt: string | null): Attrs | false {
  const src = imagePathOrNull(img?.getAttribute("src"));
  if (img === null || src === null) return false;
  const size = naturalSizeFrom(img.getAttribute("width"), img.getAttribute("height"));
  return {
    src,
    ...(alt === null ? {} : { alt: alt.slice(0, ALT_MAX_LENGTH) }),
    ...(size === null ? {} : { naturalWidth: size.width, naturalHeight: size.height }),
  };
}

// content-render의 글자 스타일 어휘와 같다(spec: render-decoration, ADR-020)
const TEXT_STYLE_CLASS = "post-ts";
const CUSTOM_COLOR = "custom";
const COLOR_VARS = { color: "--ts-color", highlight: "--ts-highlight" } as const;
type ColorKey = keyof typeof COLOR_VARS;

/** 프리셋은 data 값, hex는 `custom` + CSS 변수 — 공개 HTML과 같은 모양. */
function colorDom(key: ColorKey, value: unknown): { data?: string; cssVar?: string } {
  if (value == null) return {};
  const hex = hexColorOrNull(value);
  return hex === null
    ? { data: String(value) }
    : { data: CUSTOM_COLOR, cssVar: `${COLOR_VARS[key]}:${hex}` };
}

/** textStyle 마크 → `span.post-ts` — 속성 순서는 렌더와 같다(data-font → weight → size → color → highlight → style). */
export function textStyleSpec(attrs: Attrs): DOMOutputSpec {
  const color = colorDom("color", attrs.color);
  const highlight = colorDom("highlight", attrs.highlight);
  const dom: Record<string, string> = { class: TEXT_STYLE_CLASS };
  if (attrs.font != null) dom["data-font"] = String(attrs.font);
  if (attrs.weight != null) dom["data-weight"] = String(attrs.weight);
  if (attrs.size != null) dom["data-size"] = String(attrs.size);
  if (color.data !== undefined) dom["data-color"] = color.data;
  if (highlight.data !== undefined) dom["data-highlight"] = highlight.data;
  const cssVars = [color.cssVar, highlight.cssVar].filter((value) => value !== undefined);
  if (cssVars.length > 0) dom.style = cssVars.join(";");
  return ["span", dom, 0];
}

function cssVarOf(style: string, name: string): string | undefined {
  return new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]*)`).exec(style)?.[1]?.trim();
}

function readColor(
  element: ElementLike,
  key: ColorKey,
  presetOrNull: (value: unknown) => string | null,
): string | null {
  const data = element.getAttribute(`data-${key}`);
  if (data === CUSTOM_COLOR) {
    return hexColorOrNull(cssVarOf(element.getAttribute("style") ?? "", COLOR_VARS[key]));
  }
  return presetOrNull(data);
}

/**
 * `span.post-ts` → textStyle attrs. 값은 하나씩 닫힌 집합으로 거르고, 글꼴에 없는 두께는 뺀다.
 * 남는 것이 없으면 false(마크가 되지 않는다) — 남의 사이트 `style="color:…"`는 이 규칙에 닿지 않는다.
 */
export function readTextStyle(element: ElementLike): Attrs | false {
  const read: Record<string, string | null> = {
    font: fontOrNull(element.getAttribute("data-font")),
    weight: textWeightOrNull(element.getAttribute("data-weight")),
    size: textSizeOrNull(element.getAttribute("data-size")),
    color: readColor(element, "color", textColorPresetOrNull),
    highlight: readColor(element, "highlight", highlightPresetOrNull),
  };
  const style = Object.fromEntries(Object.entries(read).filter(([, value]) => value !== null));
  if (!textStyleAttrsSchema.safeParse(style).success) delete style.weight;
  return Object.keys(style).length > 0 ? style : false;
}

export const TEXT_STYLE_TAG = `span.${TEXT_STYLE_CLASS}`;

/** 이미지 · 스크린샷 `img` 스펙 — 원본 크기는 짝일 때만 width · height로(content-render와 같다). */
export function imgSpec(attrs: Attrs, alt: string): DOMOutputSpec {
  const size = naturalSizeFrom(attrs.naturalWidth, attrs.naturalHeight);
  return [
    "img",
    {
      src: String(attrs.src),
      alt,
      ...(size === null ? {} : { width: String(size.width), height: String(size.height) }),
    },
  ];
}
