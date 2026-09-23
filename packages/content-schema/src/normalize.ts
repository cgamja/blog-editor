import type { Doc, Mark } from "./doc";

/** doc 노드는 재귀적으로 같은 모양이라 여기서는 unknown 레코드로 다룬다. */
type Node = Record<string, unknown>;

const KEY_ORDER = ["type", "attrs", "content", "marks", "text"] as const;

/** 값이 undefined인 키를 지우고, 정해진 순서로만 담은 새 객체를 만든다(spec 키 순서 ③). */
function orderKeys(fields: Partial<Record<(typeof KEY_ORDER)[number], unknown>>): Node {
  const ordered: Node = {};
  for (const key of KEY_ORDER) {
    if (fields[key] !== undefined) ordered[key] = fields[key];
  }
  return ordered;
}

function sortObjectKeys(obj: Node): Node {
  const sorted: Node = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== undefined) sorted[key] = obj[key];
  }
  return sorted;
}

/** attrs: {}는 키 자체를 지운다(spec ③) — stickers[] 항목도 재귀적으로 키를 정렬한다. */
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

function normalizeMark(mark: Node): Node {
  return orderKeys({ type: mark.type, attrs: normalizeAttrs(mark.attrs) });
}

/** marks를 type 사전순으로 정렬한다 — 비어 있으면 undefined(키 삭제, spec ①). */
function sortMarks(marks: unknown): Mark[] | undefined {
  if (!Array.isArray(marks) || marks.length === 0) return undefined;
  const normalized = (marks as Node[]).map(normalizeMark);
  // 정규형의 정렬 기준은 type 문자열의 코드 포인트 순(로케일 무관) — spec ①
  normalized.sort((a, b) => {
    const left = a.type as string;
    const right = b.type as string;
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });
  return normalized as unknown as Mark[];
}

function marksEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 같은 부모 안 인접한 text 노드 중 마크가 deep-equal이면 하나로 합친다(spec ②). */
function mergeAdjacentText(nodes: Node[]): Node[] {
  const merged: Node[] = [];
  for (const node of nodes) {
    const prevIndex = merged.length - 1;
    const prev = merged[prevIndex];
    if (
      prev !== undefined &&
      prev.type === "text" &&
      node.type === "text" &&
      marksEqual(prev.marks, node.marks)
    ) {
      // prev는 이미 merged에 들어간 객체라 직접 고치지 않고 새 객체로 바꿔 끼운다(입력 불변 계약).
      merged[prevIndex] = { ...prev, text: `${prev.text as string}${node.text as string}` };
      continue;
    }
    merged.push(node);
  }
  return merged;
}

function normalizeNode(node: Node): Node {
  const mergedContent = Array.isArray(node.content)
    ? mergeAdjacentText((node.content as Node[]).map((child) => normalizeNode(child)))
    : undefined;
  // content: []는 키 자체를 지운다(spec ④) — ProseMirror toJSON과 같은 모양이 정규형이다.
  const content =
    mergedContent !== undefined && mergedContent.length > 0 ? mergedContent : undefined;

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
 * 키 순서 고정 · 빈 marks/attrs/content 삭제. 입력은 바꾸지 않고(재귀 내내 새 객체만 만든다) 항상 새
 * 객체를 돌려준다. 블록 노드의 종류 · 개수 · 순서와 이어 붙인 텍스트 내용은 보존한다(인접 병합으로
 * `text` 노드 개수는 줄 수 있다).
 */
export function normalize(doc: Doc): Doc {
  return normalizeNode(doc as unknown as Node) as unknown as Doc;
}
