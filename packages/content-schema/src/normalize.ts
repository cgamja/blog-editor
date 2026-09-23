import type { Doc, Mark } from "./doc";

/** doc 노드는 재귀적으로 같은 모양이라 여기서는 unknown 레코드로 다룬다. */
type Node = Record<string, unknown>;

const KEY_ORDER = ["type", "attrs", "content", "marks", "text"] as const;
const MARK_ORDER: Record<string, number> = { bold: 0, code: 1, italic: 2, link: 3 };

/** 값이 undefined인 키를 지우고, 정해진 순서로만 담은 새 객체를 만든다(spec 키 순서 ③). */
function orderKeys(fields: Partial<Record<(typeof KEY_ORDER)[number], unknown>>): Node {
  const ordered: Node = {};
  for (const key of KEY_ORDER) {
    if (fields[key] !== undefined) ordered[key] = fields[key];
  }
  return ordered;
}

/** 객체 키를 사전순으로 정렬한 새 객체 — undefined 값 키는 지운다. */
function sortObjectKeys(obj: Node): Node {
  const sorted: Node = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== undefined) sorted[key] = obj[key];
  }
  return sorted;
}

/** attrs 안 키를 사전순 정렬하고, stickers[] 항목도 키를 정렬한다. 빈 객체는 undefined(키 삭제). */
function normalizeAttrs(attrs: unknown): Node | undefined {
  if (typeof attrs !== "object" || attrs === null) return undefined;
  const source = attrs as Node;
  const withSortedStickers: Node = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value === undefined) continue;
    withSortedStickers[key] =
      key === "stickers" && Array.isArray(value)
        ? value.map((sticker) => sortObjectKeys(sticker as Node))
        : value;
  }
  const sorted = sortObjectKeys(withSortedStickers);
  return Object.keys(sorted).length === 0 ? undefined : sorted;
}

/** 마크 하나의 키 순서(type · attrs)를 맞춘다. */
function normalizeMark(mark: Node): Node {
  return orderKeys({ type: mark.type, attrs: normalizeAttrs(mark.attrs) });
}

/** marks를 type 사전순으로 정렬한다 — 비어 있으면 undefined(키 삭제, spec ①). */
function sortMarks(marks: unknown): Mark[] | undefined {
  if (!Array.isArray(marks) || marks.length === 0) return undefined;
  const normalized = (marks as Node[]).map(normalizeMark);
  // markSchema가 이미 네 종류로 닫혀 있어 실제로는 항상 찾는다 — noUncheckedIndexedAccess 때문에
  // 타입상으로만 기본값 0이 필요하다.
  const rank = (m: Node) => MARK_ORDER[m.type as string] ?? 0;
  normalized.sort((a, b) => rank(a) - rank(b));
  return normalized as unknown as Mark[];
}

function marksEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 같은 부모 안 인접한 text 노드 중 마크가 deep-equal이면 하나로 합친다(spec ②). */
function mergeAdjacentText(nodes: Node[]): Node[] {
  const merged: Node[] = [];
  for (const node of nodes) {
    const prev = merged.at(-1);
    if (
      prev !== undefined &&
      prev.type === "text" &&
      node.type === "text" &&
      marksEqual(prev.marks, node.marks)
    ) {
      prev.text = `${prev.text as string}${node.text as string}`;
      continue;
    }
    merged.push(node);
  }
  return merged;
}

function normalizeNode(node: Node): Node {
  const content = Array.isArray(node.content)
    ? mergeAdjacentText((node.content as Node[]).map((child) => normalizeNode(child)))
    : undefined;

  return orderKeys({
    type: node.type,
    attrs: normalizeAttrs(node.attrs),
    content,
    marks: sortMarks(node.marks),
    text: node.text,
  });
}

/**
 * 문서를 정규형으로 만든다(spec: document-normalize) — 마크 사전순 · 인접 텍스트 병합 ·
 * 키 순서 고정 · 빈 marks/attrs 삭제. 입력은 바꾸지 않고(재귀 내내 새 객체만 만든다) 항상 새
 * 객체를 돌려준다. 노드 종류 · 개수 · 텍스트 내용은 바뀌지 않는다.
 */
export function normalize(doc: Doc): Doc {
  return normalizeNode(doc as unknown as Node) as unknown as Doc;
}
