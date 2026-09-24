import type { Attrs, DOMOutputSpec, Schema, TagParseRule } from "@tiptap/pm/model";
import type { ElementLike } from "./dom";

/**
 * DOM 없이(vitest node) 파싱 규칙과 toDOM 스펙을 검증하는 가짜 요소(design.md 5).
 * 파싱 코드가 쓰는 최소 인터페이스(dom.ts ElementLike)만 흉내 낸다.
 */
export interface FakeElement extends ElementLike {
  readonly textContent: string;
  readonly firstElementChild: FakeElement | null;
  querySelector(selector: string): FakeElement | null;
}

/** 규칙의 getAttrs는 HTMLElement로 타입이 잡혀 있지만, 스키마의 규칙은 모두 ElementLike만 쓴다(dom.ts). */
type ElementLikeGetAttrs = (element: ElementLike) => Attrs | false | null;

type FakeSpec = {
  tag: string;
  attrs?: Record<string, string>;
  children?: Array<FakeElement | string>;
};

/** `tag`, `tag.class`, `tag[attr]` 셀렉터 하나만 이해한다 — 스키마 규칙이 쓰는 모양이 이것뿐이다. */
function matchesSelector(el: FakeElement, selector: string): boolean {
  const match = /^([a-z0-9]+)(?:\.([a-z0-9-]+))?(?:\[([a-z-]+)\])?$/.exec(selector);
  if (match === null) throw new Error(`dom.test.helpers: 모르는 셀렉터 — ${selector}`);
  const [, tag, className, attr] = match;
  if (el.tagName !== tag!.toUpperCase()) return false;
  if (className !== undefined && !(el.getAttribute("class") ?? "").split(/\s+/).includes(className))
    return false;
  if (attr !== undefined && el.getAttribute(attr) === null) return false;
  return true;
}

export function el({ tag, attrs = {}, children = [] }: FakeSpec): FakeElement {
  const elements = children.filter((child): child is FakeElement => typeof child !== "string");
  const self: FakeElement = {
    tagName: tag.toUpperCase(),
    get textContent() {
      return children
        .map((child) => (typeof child === "string" ? child : child.textContent))
        .join("");
    },
    firstElementChild: elements[0] ?? null,
    getAttribute: (name) => (Object.hasOwn(attrs, name) ? attrs[name]! : null),
    querySelector(selector) {
      for (const child of elements) {
        if (matchesSelector(child, selector)) return child;
        const found = child.querySelector(selector);
        if (found !== null) return found;
      }
      return null;
    },
  };
  return self;
}

/**
 * toDOM이 돌려준 DOMOutputSpec(배열)을 가짜 요소로 — 구멍(0)은 글자 하나로, 문자열 자식은 텍스트로.
 * https://prosemirror.net/docs/ref/#model.DOMOutputSpec
 */
export function elementFromSpec(spec: DOMOutputSpec): FakeElement {
  if (!Array.isArray(spec)) throw new Error("dom.test.helpers: 최상위는 배열 스펙만 다룬다");
  const [tag, ...rest] = spec as [string, ...unknown[]];
  const first = rest[0];
  const hasAttrs = first !== null && typeof first === "object" && !Array.isArray(first);
  const attrs = hasAttrs ? (first as Record<string, unknown>) : {};
  const childSpecs = hasAttrs ? rest.slice(1) : rest;
  const children = childSpecs.map((child) => {
    if (child === 0) return "글";
    if (typeof child === "string") return child;
    return elementFromSpec(child as DOMOutputSpec);
  });
  const stringAttrs = Object.fromEntries(
    Object.entries(attrs)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return el({ tag, attrs: stringAttrs, children });
}

function tagRules(schema: Schema, kind: "nodes" | "marks", name: string): readonly TagParseRule[] {
  const type = kind === "nodes" ? schema.nodes[name] : schema.marks[name];
  if (type === undefined) throw new Error(`dom.test.helpers: 모르는 타입 — ${name}`);
  return ((type.spec.parseDOM ?? []) as TagParseRule[]).filter((rule) => rule.tag !== undefined);
}

/**
 * DOMParser처럼 셀렉터가 맞는 규칙을 차례로 보고, getAttrs가 false가 아닌 첫 결과를 돌려준다.
 * 맞는 규칙이 없거나 모두 거부하면 false.
 */
export function readWith(
  schema: Schema,
  kind: "nodes" | "marks",
  name: string,
  element: FakeElement,
): Record<string, unknown> | false {
  for (const rule of tagRules(schema, kind, name)) {
    if (!matchesSelector(element, rule.tag!)) continue;
    const getAttrs = rule.getAttrs as ElementLikeGetAttrs | undefined;
    const attrs = getAttrs ? getAttrs(element) : (rule.attrs ?? {});
    if (attrs !== false) return { ...(attrs ?? {}) };
  }
  return false;
}

/**
 * ProseMirror DOMParser가 파싱하며 읽는 만큼만 흉내 낸 노드 — 텍스트(nodeType 3)와 요소(1).
 * 읽는 표면은 prosemirror-model 1.25.12 ParseContext 소스로 확인했다(addAll · addDOM · addElement ·
 * readStyles · matchTag): nodeType · nodeName · tagName · childNodes · firstChild · next/previousSibling ·
 * parentNode · nodeValue · style(length) · matches · namespaceURI · getAttribute · firstElementChild.
 */
export interface MiniNode {
  readonly nodeType: 1 | 3;
  readonly nodeName: string;
  readonly nodeValue: string | null;
  parentNode: MiniNode | null;
  nextSibling: MiniNode | null;
  previousSibling: MiniNode | null;
  readonly childNodes: MiniNode[];
  readonly firstChild: MiniNode | null;
}

function miniText(text: string): MiniNode {
  return {
    nodeType: 3,
    nodeName: "#text",
    nodeValue: text,
    parentNode: null,
    nextSibling: null,
    previousSibling: null,
    childNodes: [],
    firstChild: null,
  };
}

function miniElement(tag: string, attrs: Record<string, string>, children: MiniNode[]): MiniNode {
  const elements = () => children.filter((child) => child.nodeType === 1);
  const self = {
    nodeType: 1 as const,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    nodeValue: null,
    namespaceURI: "http://www.w3.org/1999/xhtml",
    parentNode: null as MiniNode | null,
    nextSibling: null as MiniNode | null,
    previousSibling: null as MiniNode | null,
    childNodes: children,
    firstChild: children[0] ?? null,
    style: { length: 0, getPropertyValue: () => "" },
    get firstElementChild() {
      return elements()[0] ?? null;
    },
    get textContent() {
      return "";
    },
    getAttribute: (name: string) => (Object.hasOwn(attrs, name) ? attrs[name]! : null),
    querySelector: () => null,
    matches(selector: string) {
      return matchesSelector(self as unknown as FakeElement, selector);
    },
  };
  children.forEach((child, index) => {
    child.parentNode = self;
    child.previousSibling = children[index - 1] ?? null;
    child.nextSibling = children[index + 1] ?? null;
  });
  return self;
}

/**
 * toDOM 스펙 여러 개를 한 부모(div) 아래의 가짜 DOM으로 — `DOMParser.parseSlice`에 그대로 넘긴다.
 * 구멍(0)은 글자 "글"로 채운다. https://prosemirror.net/docs/ref/#model.DOMParser.parseSlice
 */
export function miniDomFromSpecs(specs: readonly DOMOutputSpec[]): MiniNode {
  const build = (spec: DOMOutputSpec): MiniNode => {
    if (!Array.isArray(spec)) throw new Error("dom.test.helpers: 배열 스펙만 다룬다");
    const [tag, ...rest] = spec as [string, ...unknown[]];
    const first = rest[0];
    const hasAttrs = first !== null && typeof first === "object" && !Array.isArray(first);
    const attrs = hasAttrs ? (first as Record<string, string>) : {};
    const children = (hasAttrs ? rest.slice(1) : rest).map((child) =>
      child === 0
        ? miniText("글")
        : typeof child === "string"
          ? miniText(child)
          : build(child as DOMOutputSpec),
    );
    return miniElement(tag, attrs, children);
  };
  return miniElement("div", {}, specs.map(build));
}

/** 스키마 전체에서 이 태그 이름을 받는 규칙이 있는가. */
export function hasRuleForTag(schema: Schema, tag: string): boolean {
  const specs = [
    ...Object.values(schema.nodes).map((type) => type.spec.parseDOM ?? []),
    ...Object.values(schema.marks).map((type) => type.spec.parseDOM ?? []),
  ];
  return specs
    .flat()
    .some((rule) => "tag" in rule && rule.tag !== undefined && rule.tag.split(/[.[]/)[0] === tag);
}

/** 스타일 규칙(`style: "font-weight"` 등)으로 이 값을 읽으면 그 마크가 되는가. */
export function markFromStyle(
  schema: Schema,
  name: string,
  property: string,
  value: string,
): boolean {
  const type = schema.marks[name];
  if (type === undefined) throw new Error(`dom.test.helpers: 모르는 마크 — ${name}`);
  return (type.spec.parseDOM ?? []).some((rule) => {
    if (!("style" in rule) || rule.style === undefined) return false;
    const [ruleProperty, fixed] = rule.style.split("=");
    if (ruleProperty !== property) return false;
    if (fixed !== undefined) return fixed === value;
    return (rule.getAttrs ? rule.getAttrs(value) : null) !== false;
  });
}
