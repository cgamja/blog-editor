import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc, Sticker } from "@blog-editor/content-schema";
import { convertMarkdown } from "./convert";
import {
  documentWouldBeEmptyMessage,
  insertEmptyMessage,
  selectionAmbiguousMessage,
  selectionEmptyMessage,
  selectionNotFoundMessage,
  selectionPartialBlockMessage,
  selectionPlace,
} from "./range-edit.messages";
import type {
  EditRange,
  Found,
  InlineText,
  JsonNode,
  Located,
  RangeEdit,
  RangeEditResult,
  TextBlockRef,
  TextPoint,
} from "./range-edit.types";

/** 시작 · 끝 글을 나누는 표시 — AI가 말줄임표 한 글자로 써도 받는다 */
const ELLIPSIS = /\.\.\.|…/;
/** 여러 곳을 알릴 때 범위 앞뒤로 보여 줄 글자 수 */
const AROUND_CHARS = 12;
/** 여러 곳을 알릴 때 늘어놓을 최대 개수 — 그 이상은 어차피 더 긴 글이 필요하다 */
const MAX_PLACES = 3;
/** 인라인 글만 담는 글자 블록 — 코드 블록은 마크 없는 글이라 따로 다룬다 */
const INLINE_TEXT_BLOCKS = new Set(["paragraph", "heading"]);
/** 코드 펜스로 시작하는 새 글은 코드 블록 글자가 아니라 블록 바꾸기다 */
const CODE_FENCE = /^\s*(```|~~~)/;

function fail(message: string): { ok: false; messages: [string] } {
  return { ok: false, messages: [message] };
}

function textOf(node: JsonNode): string {
  return (node.content ?? [])
    .map((child) => (typeof child.text === "string" ? child.text : ""))
    .join("");
}

/** 글자 블록을 문서 순서대로 모은다 — 인용 · 목록 · 콜아웃 안 문단도 모양을 몰라도 content를 따라 내려간다 */
function collectTextBlocks(doc: JsonNode): TextBlockRef[] {
  const found: TextBlockRef[] = [];
  const visit = (node: JsonNode, top: number, path: number[]) => {
    if (node.type === "codeBlock" || INLINE_TEXT_BLOCKS.has(node.type)) {
      found.push({ top, path, text: textOf(node), isCode: node.type === "codeBlock" });
      return;
    }
    node.content?.forEach((child, index) => visit(child, top, [...path, index]));
  };
  doc.content?.forEach((block, top) => visit(block, top, [top]));
  return found;
}

function splitSelection(selection: string): { start: string; end: string } | null {
  const match = ELLIPSIS.exec(selection);
  if (match === null) return null;
  return {
    start: selection.slice(0, match.index).trim(),
    end: selection.slice(match.index + match[0].length).trim(),
  };
}

function indexesOf(text: string, needle: string): number[] {
  const indexes: number[] = [];
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    indexes.push(at);
  }
  return indexes;
}

/** 시작 글 뒤에 처음 나오는 끝 글 — 같은 블록의 뒤쪽부터, 없으면 다음 블록들에서 */
function endAfter(blocks: readonly TextBlockRef[], from: TextPoint, end: string): TextPoint | null {
  for (let block = from.block; block < blocks.length; block += 1) {
    const text = blocks[block]?.text ?? "";
    const at = text.indexOf(end, block === from.block ? from.offset : 0);
    if (at !== -1) return { block, offset: at + end.length };
  }
  return null;
}

/** `end`가 null이면 시작 글 자체가 범위다 */
function candidatesOf(blocks: readonly TextBlockRef[], start: string, end: string | null): Found[] {
  const candidates: Found[] = [];
  for (let block = 0; block < blocks.length; block += 1) {
    for (const offset of indexesOf(blocks[block]?.text ?? "", start)) {
      const afterStart = { block, offset: offset + start.length };
      const endAt = end === null ? afterStart : endAfter(blocks, afterStart, end);
      // 이 시작 뒤에 끝 글이 없으면 더 뒤의 시작 뒤에도 없다
      if (endAt === null) return candidates;
      candidates.push({ start: { block, offset }, end: endAt });
    }
  }
  return candidates;
}

function pick(
  blocks: readonly TextBlockRef[],
  selection: string,
  candidates: readonly Found[],
  hasEllipsis: boolean,
): Located {
  const [only, ...rest] = candidates;
  if (only === undefined) return fail(selectionNotFoundMessage(selection, hasEllipsis));
  if (rest.length === 0) return { ok: true, found: only };
  const places = candidates.slice(0, MAX_PLACES).map(({ start, end }) => {
    const ref = blocks[start.block];
    const text = ref?.text ?? "";
    const until = end.block === start.block ? end.offset : text.length;
    const around = text.slice(Math.max(0, start.offset - AROUND_CHARS), until + AROUND_CHARS);
    return selectionPlace((ref?.top ?? 0) + 1, around);
  });
  return fail(selectionAmbiguousMessage(selection, candidates.length, places));
}

/**
 * "시작...끝"으로 먼저 찾고, 한쪽이 비었거나 찾지 못하면 `...`까지 글자 그대로 다시 찾는다
 * (글에 말줄임표가 들어 있는 경우).
 */
function locate(blocks: readonly TextBlockRef[], selection: string): Located {
  if (selection === "") return fail(selectionEmptyMessage());
  const split = splitSelection(selection);
  if (split === null) return pick(blocks, selection, candidatesOf(blocks, selection, null), false);
  const ranged =
    split.start === "" || split.end === "" ? [] : candidatesOf(blocks, split.start, split.end);
  if (ranged.length === 1) return pick(blocks, selection, ranged, true);
  // 나눠서 없거나 여러 곳이면, 글자 그대로 한 곳이 더 정확한 뜻이다
  const literal = candidatesOf(blocks, selection, null);
  const candidates = ranged.length === 0 || literal.length === 1 ? literal : ranged;
  return pick(blocks, selection, candidates, true);
}

/** 꾸밈 없는 문단 하나면 그 인라인 글 — 한 블록 안 글자 바꾸기로 쓸 수 있다 */
function inlineOnly(converted: Doc): InlineText[] | null {
  const [first, ...rest] = converted.content as unknown as JsonNode[];
  if (first === undefined || rest.length > 0) return null;
  if (first.type !== "paragraph" || first.attrs !== undefined) return null;
  return (first.content ?? []) as InlineText[];
}

function spliceInline(
  nodes: readonly InlineText[],
  from: number,
  to: number,
  insert: readonly InlineText[],
): InlineText[] {
  const before: InlineText[] = [];
  const after: InlineText[] = [];
  let position = 0;
  for (const node of nodes) {
    const start = position;
    const end = position + node.text.length;
    position = end;
    if (end <= from) before.push(node);
    else if (start >= to) after.push(node);
    else {
      if (start < from) before.push({ ...node, text: node.text.slice(0, from - start) });
      if (end > to) after.push({ ...node, text: node.text.slice(to - start) });
    }
  }
  return [...before, ...insert, ...after];
}

/** 경로의 노드 하나만 새로 만들고 나머지는 입력 노드를 그대로 쓴다 — 입력 문서를 고치지 않는다 */
function updateAt(
  nodes: readonly JsonNode[],
  path: readonly number[],
  update: (node: JsonNode) => JsonNode,
): JsonNode[] {
  const [index, ...rest] = path;
  return nodes.map((node, at) => {
    if (at !== index) return node;
    return rest.length === 0
      ? update(node)
      : { ...node, content: updateAt(node.content ?? [], rest, update) };
  });
}

function stickersOf(node: JsonNode | undefined): Sticker[] | undefined {
  const stickers = node?.attrs?.stickers;
  return Array.isArray(stickers) ? (stickers as Sticker[]) : undefined;
}

/**
 * 블록 하나를 블록 하나로 바꿀 때 옛 스티커를 옮긴다 — 마크다운에는 아직 스티커 문법이 없어서(#134)
 * AI가 다시 쓴 블록에는 늘 스티커가 없다. 새 블록이 스티커를 가지면 그쪽을 따른다.
 */
function carryStickers(replaced: readonly JsonNode[], added: readonly JsonNode[]): JsonNode[] {
  const [old, ...moreOld] = replaced;
  const [fresh, ...moreFresh] = added;
  const stickers = stickersOf(old);
  if (moreOld.length > 0 || moreFresh.length > 0 || fresh === undefined || stickers === undefined) {
    return [...added];
  }
  if (stickersOf(fresh) !== undefined) return [fresh];
  return [{ ...fresh, attrs: { ...fresh.attrs, stickers } }];
}

/**
 * 범위가 걸친 최상위 블록들의 보이는 글자를 처음부터 끝까지 덮는가 — 일부만 덮은 채 블록을 통째로
 * 바꾸면 고르지 않은 글자(다른 목록 항목 · 인용 문단)가 말없이 사라진다. 앞뒤 공백은 보이지 않으므로
 * 덮지 않아도 된다.
 */
function coversWholeBlocks({ blocks, start, end, startRef, endRef }: EditRange): boolean {
  const isBlank = (ref: TextBlockRef) => ref.text.trim() === "";
  const leadingSpaces = startRef.text.length - startRef.text.trimStart().length;
  const beforeStart = blocks.slice(0, start.block).filter(({ top }) => top === startRef.top);
  const afterEnd = blocks.slice(end.block + 1).filter(({ top }) => top === endRef.top);
  return (
    start.offset <= leadingSpaces &&
    end.offset >= endRef.text.trimEnd().length &&
    beforeStart.every(isBlank) &&
    afterEnd.every(isBlank)
  );
}

function finish(content: JsonNode[]): RangeEditResult {
  if (content.length === 0) return fail(documentWouldBeEmptyMessage());
  const parsed = docSchema.safeParse({ type: "doc", content });
  if (parsed.success) return { ok: true, doc: normalize(parsed.data), messages: [] };
  const [first, ...rest] = parsed.error.issues.map(
    ({ path, message }) => `${path.map(String).join(".")}: ${message}`,
  );
  if (first === undefined) throw new Error("range-edit: 검증 실패에 이슈가 없다");
  return { ok: false, messages: [first, ...rest] };
}

function insertAfterRange({ content, endRef }: EditRange, markdown: string): RangeEditResult {
  if (markdown.trim() === "") return fail(insertEmptyMessage());
  const converted = convertMarkdown(markdown);
  if (!converted.ok) return converted;
  const added = converted.doc.content as unknown as JsonNode[];
  return finish([...content.slice(0, endRef.top + 1), ...added, ...content.slice(endRef.top + 1)]);
}

/** 전제: 범위가 한 코드 블록 안이다. 언어 · 다른 줄 · 꾸밈이 그대로다 */
function replaceCodeText(
  { content, startRef, start, end }: EditRange,
  text: string,
): RangeEditResult {
  const next = startRef.text.slice(0, start.offset) + text + startRef.text.slice(end.offset);
  return finish(
    updateAt(content, startRef.path, (node) => {
      const rest = Object.fromEntries(Object.entries(node).filter(([key]) => key !== "content"));
      return (
        next === "" ? rest : { ...rest, content: [{ type: "text", text: next }] }
      ) as JsonNode;
    }),
  );
}

/** 전제: 범위가 한 글자 블록 안이다. 블록 꾸밈 · 스티커 · 범위 밖 글자와 마크가 그대로다 */
function replaceInline(
  { content, startRef, start, end }: EditRange,
  inline: readonly InlineText[],
): RangeEditResult {
  return finish(
    updateAt(content, startRef.path, (node) => ({
      ...node,
      content: spliceInline(
        (node.content ?? []) as InlineText[],
        start.offset,
        end.offset,
        inline,
      ) as JsonNode[],
    })),
  );
}

/** 범위가 걸친 최상위 블록 전체를 덮지 않으면 실패한다. `added`가 비면 그 블록들을 지운다 */
function replaceBlocks(range: EditRange, added: readonly JsonNode[]): RangeEditResult {
  if (!coversWholeBlocks(range)) {
    const isInOneCodeBlock = range.start.block === range.end.block && range.startRef.isCode;
    return fail(selectionPartialBlockMessage(isInOneCodeBlock));
  }
  const { content, startRef, endRef } = range;
  const replaced = content.slice(startRef.top, endRef.top + 1);
  return finish([
    ...content.slice(0, startRef.top),
    ...carryStickers(replaced, added),
    ...content.slice(endRef.top + 1),
  ]);
}

function refAt(blocks: readonly TextBlockRef[], index: number): TextBlockRef {
  const ref = blocks[index];
  if (ref === undefined) throw new Error(`range-edit: 찾은 블록이 없다 — ${index}`);
  return ref;
}

/**
 * 범위를 집어 문서의 일부만 고친다(adr-031). 범위는 노션 MCP `selection_with_ellipsis`처럼
 * "시작 글...끝 글"이고, 범위 밖 최상위 블록은 다시 직렬화하지 않으므로 꾸밈 · 스티커까지 그대로다.
 * - `replace`
 *   - 빈 글이고 범위가 걸친 최상위 블록 전체를 덮으면 그 블록들을 지운다.
 *   - 한 코드 블록 안이고 새 글이 코드 펜스가 아니면 그 글자만 새 글 그대로 바꾼다.
 *   - 한 글자 블록 안이고 새 글이 꾸밈 없는 문단 하나(또는 빈 글)면 그 글자만 바꾼다.
 *   - 그 밖에는 범위가 걸친 최상위 블록들을 새 markdown 블록들로 바꾼다. 범위가 그 블록들 전체를
 *     덮지 않으면 실패한다. 블록 하나를 블록 하나로 바꾸면 옛 스티커를 새 블록으로 옮긴다
 *     (마크다운에 스티커 문법이 생기기 전까지 — #134).
 * - `insert_after`: 범위 끝이 든 최상위 블록 뒤에 넣는다.
 */
export function editDocRange(doc: Doc, edit: RangeEdit): RangeEditResult {
  const root = doc as unknown as JsonNode;
  const blocks = collectTextBlocks(root);
  const located = locate(blocks, edit.selection);
  if (!located.ok) return located;
  const { start, end } = located.found;
  const range: EditRange = {
    content: root.content ?? [],
    blocks,
    start,
    end,
    startRef: refAt(blocks, start.block),
    endRef: refAt(blocks, end.block),
  };
  if (edit.command === "insert_after") return insertAfterRange(range, edit.markdown);

  const isEmpty = edit.markdown.trim() === "";
  if (isEmpty && coversWholeBlocks(range)) return replaceBlocks(range, []);
  const isSameBlock = start.block === end.block;
  if (isSameBlock && range.startRef.isCode && !CODE_FENCE.test(edit.markdown)) {
    return replaceCodeText(range, edit.markdown);
  }
  const converted = isEmpty ? null : convertMarkdown(edit.markdown);
  if (converted !== null && !converted.ok) return converted;
  const inline = converted === null ? [] : inlineOnly(converted.doc);
  if (isSameBlock && !range.startRef.isCode && inline !== null) {
    return replaceInline(range, inline);
  }
  const added = converted === null ? [] : (converted.doc.content as unknown as JsonNode[]);
  return replaceBlocks(range, added);
}
