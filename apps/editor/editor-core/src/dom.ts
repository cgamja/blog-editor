import type { Attrs, DOMOutputSpec, TagParseRule } from "@tiptap/pm/model";
import { ALT_MAX_LENGTH } from "@blog-editor/content-schema";
import {
  fontOrNull,
  imagePathOrNull,
  motionOrNull,
  naturalSizeOrNull,
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

export type DecorationKey = "font" | "motion" | "width";

// content-render의 꾸밈 래퍼와 같은 어휘(spec: render-decoration) — 에디터 DOM도 같은 구조로 낸다
const WRAPPER_CLASS = "post-block";
const WRAPPER_TAG = `div.${WRAPPER_CLASS}`;
const WIDTH_STYLE = /(?:^|;)\s*--w\s*:\s*([^;]*)/;

export function hasClass(element: ElementLike, className: string): boolean {
  return (element.getAttribute("class") ?? "").split(/\s+/).includes(className);
}

function decorationDomAttrs(attrs: Attrs): Record<string, string> | null {
  const dom: Record<string, string> = {};
  if (attrs.font != null) dom["data-font"] = String(attrs.font);
  if (attrs.motion != null) dom["data-motion"] = String(attrs.motion);
  if (attrs.width != null) dom.style = `--w:${String(attrs.width)}`;
  return Object.keys(dom).length === 0 ? null : { class: WRAPPER_CLASS, ...dom };
}

/**
 * 꾸밈이 있으면 공개 HTML처럼 `div.post-block`으로 감싼다. 스티커는 내지 않는다 — 구멍(0)은
 * 부모의 유일한 자식이어야 해서 스티커 요소를 형제로 둘 수 없고, 표시는 NodeView 몫이다(design.md 1).
 */
export function withDecoration(attrs: Attrs, element: DOMOutputSpec): DOMOutputSpec {
  const wrapper = decorationDomAttrs(attrs);
  return wrapper === null ? element : ["div", wrapper, element];
}

function readDecoration(wrapper: ElementLike, keys: readonly DecorationKey[]): Attrs {
  const read: Record<DecorationKey, unknown> = {
    font: fontOrNull(wrapper.getAttribute("data-font")),
    motion: motionOrNull(wrapper.getAttribute("data-motion")),
    width: widthOrNull(WIDTH_STYLE.exec(wrapper.getAttribute("style") ?? "")?.[1]),
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
  return {
    tag: WRAPPER_TAG,
    ...(preserveWhitespace === undefined ? {} : { preserveWhitespace }),
    getAttrs: (element: ElementLike) => {
      const inner = element.firstElementChild;
      if (inner === null || !matches(inner)) return false;
      const own = attrs ? attrs(inner) : {};
      return own === false ? false : { ...own, ...readDecoration(element, keys) };
    },
    ...(hasContent ? { contentElement: (element: ElementLike) => element.firstElementChild } : {}),
  } as TagParseRule;
}

/** `img` 한 개에서 이미지 attrs — 경로 규칙 밖이면 false(노드가 되지 않는다). */
export function imageAttrsOf(img: ElementLike | null, alt: string | null): Attrs | false {
  const src = imagePathOrNull(img?.getAttribute("src"));
  if (img === null || src === null) return false;
  const size = naturalSizeOrNull(img.getAttribute("width"), img.getAttribute("height"));
  return { src, ...(alt === null ? {} : { alt: alt.slice(0, ALT_MAX_LENGTH) }), ...(size ?? {}) };
}

/** 이미지 · 스크린샷 `img` 스펙 — 원본 크기는 짝일 때만 width · height로(content-render와 같다). */
export function imgSpec(attrs: Attrs, alt: string): DOMOutputSpec {
  const size = naturalSizeOrNull(attrs.naturalWidth, attrs.naturalHeight);
  return [
    "img",
    {
      src: String(attrs.src),
      alt,
      ...(size === null
        ? {}
        : { width: String(size.naturalWidth), height: String(size.naturalHeight) }),
    },
  ];
}
