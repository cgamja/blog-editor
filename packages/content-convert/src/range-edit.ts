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
  briefsWouldDropMessage,
  stickersWouldDropMessage,
} from "./range-edit.messages";
import type {
  BriefedImage,
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
import { formatStickerDirective } from "./sticker-directive";

/**
 * 시작 · 끝 글을 나누는 표시 — AI가 말줄임표 한 글자로 써도 받는다. 점은 넷 이상 이어질 수 있다
 * (마침표로 끝나는 시작 글 바로 뒤에 `...`를 붙인 경우).
 */
const ELLIPSIS = /\.{3,}|…/;
const ELLIPSIS_DOTS = 3;
/** 여러 곳을 알릴 때 범위 앞뒤로 보여 줄 글자 수 */
const AROUND_CHARS = 12;
/** 여러 곳을 알릴 때 늘어놓을 최대 개수 — 그 이상은 어차피 더 긴 글이 필요하다 */
const MAX_PLACES = 3;
/** 인라인 글만 담는 글자 블록 — 코드 블록은 마크 없는 글이라 따로 다룬다 */
const INLINE_TEXT_BLOCKS = new Set(["paragraph", "heading"]);
/** 스티커 자리가 없는 블록 — 사진 자리(adr-033)는 공개 렌더에 나가지 않아 꾸밈 자리가 없다 */
const BLOCKS_WITHOUT_STICKERS = new Set(["photoPlaceholder"]);
/** 코드 펜스로 시작하는 새 글은 코드 블록 글자가 아니라 블록 바꾸기다 */
const CODE_FENCE = /^\s*(```|~~~)/;
/**
 * 강제 줄바꿈(adr-028)은 찾는 글에서 줄바꿈 한 글자다 — get_post markdown에서 줄 끝 `\` + 줄바꿈으로 보이는 자리라,
 * AI가 본 두 줄을 그대로 범위로 옮겨도 찾는다. 공백으로 두면 `첫 줄 둘째 줄`이 원래 공백과 구별되지 않고, 없는 글자로
 * 두면 두 줄이 붙어(`첫 줄둘째 줄`) 본 글과 달라진다.
 */
const HARD_BREAK_TEXT = "\n";
/** 범위에 get_post 모양 그대로 쓴 강제 줄바꿈(줄 끝 `\` + 줄바꿈) */
const MARKDOWN_HARD_BREAK = /\\\r?\n/g;

function fail(message: string): { ok: false; messages: [string] } {
  return { ok: false, messages: [message] };
}

/** 인라인 하나가 찾는 글에서 차지하는 글자 */
function inlineTextOf(node: JsonNode): string {
  if (node.type === "hardBreak") return HARD_BREAK_TEXT;
  return typeof node.text === "string" ? node.text : "";
}

function textOf(node: JsonNode): string {
  return (node.content ?? []).map(inlineTextOf).join("");
}

/** 글자 블록을 문서 순서대로 모은다 — 인용 · 목록 · 콜아웃 안 문단도 모양을 몰라도 content를 따라 내려간다 */
function collectTextBlocks(doc: JsonNode): TextBlockRef[] {
  const found: TextBlockRef[] = [];
  const visit = (node: JsonNode, top: number, path: number[]) => {
    // 사진 자리(adr-033)는 설명을 그 블록의 글로 찾는다 — AI가 get_post에서 본 `:::photo` 안 글 그대로
    if (node.type === "photoPlaceholder") {
      const brief = typeof node.attrs?.brief === "string" ? node.attrs.brief : "";
      found.push({ top, path, text: brief, isCode: false, isWholeBlockOnly: true });
      return;
    }
    if (node.type === "codeBlock" || INLINE_TEXT_BLOCKS.has(node.type)) {
      found.push({
        top,
        path,
        text: textOf(node),
        isCode: node.type === "codeBlock",
        isWholeBlockOnly: false,
      });
      return;
    }
    node.content?.forEach((child, index) => visit(child, top, [...path, index]));
  };
  doc.content?.forEach((block, top) => visit(block, top, [top]));
  return found;
}

/**
 * 첫 말줄임표에서 나누는 자리들을 앞에서부터 준다. 점이 넷 이상 이어지면 그 줄의 첫 `...`와 마지막
 * `...` 두 자리다 — 마지막 자리는 앞의 점을 시작 글의 마침표로 본다.
 */
function splitSelection(selection: string): { start: string; end: string }[] {
  const match = ELLIPSIS.exec(selection);
  if (match === null) return [];
  const cut = (at: number, length: number) => ({
    start: selection.slice(0, at).trim(),
    end: selection.slice(at + length).trim(),
  });
  const run = match[0].length;
  if (run <= ELLIPSIS_DOTS) return [cut(match.index, run)];
  return [cut(match.index, ELLIPSIS_DOTS), cut(match.index + run - ELLIPSIS_DOTS, ELLIPSIS_DOTS)];
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

/** 여러 곳 중 고를 수 있는 블록 전체 — 최상위 블록 하나의 보이는 글자 전체와 같은 곳 */
function isWholeTopBlock(blocks: readonly TextBlockRef[], found: Found): boolean {
  const ref = refAt(blocks, found.start.block);
  return (
    found.start.block === found.end.block &&
    ref.path.length === 1 &&
    coversWholeBlocks(blocks, found)
  );
}

/**
 * 소제목 "산책"을 집었는데 문단 "오늘 산책을 했다"에도 있으면 AI가 뜻한 것은 소제목이다. 지우기는 잘못 고르면
 * 글이 말없이 사라지고, 목록 항목 · 표 칸 · 인용 안 문단은 AI가 그 블록 하나를 뜻했다고 볼 근거가 약하다.
 * 범위형은 AI가 이미 앞뒤를 골랐다(#158 · adr-038).
 */
function pick(
  blocks: readonly TextBlockRef[],
  selection: string,
  candidates: readonly Found[],
  {
    hasEllipsis,
    isLiteral,
    isDeletion,
  }: { hasEllipsis: boolean; isLiteral: boolean; isDeletion: boolean },
): Located {
  const [only, ...rest] = candidates;
  if (only === undefined) return fail(selectionNotFoundMessage(selection, hasEllipsis));
  if (rest.length === 0) return { ok: true, found: only };
  // 지우기도 블록 전체와 같은 곳은 센다 — 고르지는 않고, 짧은 블록을 지우는 길을 알리는 데 쓴다(#178)
  const wholeBlocks = isLiteral ? candidates.filter((found) => isWholeTopBlock(blocks, found)) : [];
  const [onlyWhole, ...moreWhole] = wholeBlocks;
  if (!isDeletion && onlyWhole !== undefined && moreWhole.length === 0) {
    return { ok: true, found: onlyWhole };
  }
  const places = candidates.slice(0, MAX_PLACES).map(({ start, end }) => {
    const ref = blocks[start.block];
    const text = ref?.text ?? "";
    const until = end.block === start.block ? end.offset : text.length;
    const around = text.slice(Math.max(0, start.offset - AROUND_CHARS), until + AROUND_CHARS);
    return selectionPlace((ref?.top ?? 0) + 1, around);
  });
  const wholeBlockNumbers = wholeBlocks.map(({ start }) => refAt(blocks, start.block).top + 1);
  return fail(
    selectionAmbiguousMessage(selection, candidates.length, places, wholeBlockNumbers, isDeletion),
  );
}

/**
 * 시도 순서는 첫 `...`에서 나누기 → (점이 넷 이상이면) 마지막 `...`에서 나누기 → 글자 그대로다.
 * 한 곳으로 정해지는 첫 시도를 쓰고, 없으면 여러 곳인 첫 시도로 알리고, 그것도 없으면 못 찾았다고 알린다.
 * 글자 그대로 찾기로 돌아왔으면 `...`는 글자라 범위형이 아니다 — 블록 전체 고르기를 쓴다.
 * @param isDeletion 빈 markdown으로 바꾸기(지우기)인가 — 블록 전체 고르기를 쓰지 않고 안내만 한다
 */
function locate(blocks: readonly TextBlockRef[], selection: string, isDeletion: boolean): Located {
  if (selection === "") return fail(selectionEmptyMessage());
  const literal = candidatesOf(blocks, selection, null);
  const splits = splitSelection(selection);
  const hasEllipsis = splits.length > 0;
  const attempts = [
    ...splits.map(({ start, end }) =>
      start === "" || end === "" ? [] : candidatesOf(blocks, start, end),
    ),
    literal,
  ];
  const chosen =
    attempts.find((found) => found.length === 1) ??
    attempts.find((found) => found.length > 1) ??
    [];
  return pick(blocks, selection, chosen, {
    hasEllipsis,
    isLiteral: chosen === literal,
    isDeletion,
  });
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
    const end = position + inlineTextOf(node).length;
    position = end;
    if (end <= from) before.push(node);
    else if (start >= to) after.push(node);
    // 강제 줄바꿈은 한 글자라 범위에 걸치면 통째로 범위 안이다 — 잘라 남길 글자가 없다
    else if (node.type === "text") {
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

const canHoldStickers = (node: JsonNode) => !BLOCKS_WITHOUT_STICKERS.has(node.type);

function stickersOf(node: JsonNode | undefined): Sticker[] | undefined {
  const stickers = node?.attrs?.stickers;
  return Array.isArray(stickers) ? (stickers as Sticker[]) : undefined;
}

/**
 * 블록 하나를 블록 하나로 바꿀 때 옛 스티커를 옮긴다 — 새 markdown이 sticker=를 쓰지 않았을 때 사람이 붙인
 * 스티커를 지키려고 옮긴다(adr-032). 새 블록이 스티커를 가지면 그쪽을 따른다(sticker=는 옛 것을 대신한다).
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
 * 블록 여럿이 걸친 바꾸기에서 새 markdown이 sticker=를 하나도 쓰지 않으면 옛 스티커가 옮겨 갈 자리가 없다 —
 * 사람이 붙인 것이 말없이 사라지지 않게 그 스티커들을 돌려준다(부르는 쪽이 실패로 알린다). 하나 → 하나는
 * carryStickers가 옮기되, 새 블록에 스티커 자리가 없으면(사진 자리) 옮길 수 없어 마찬가지로 돌려준다.
 * 지우기(`added`가 빔)는 블록째 없애 달라는 뜻이라 막지 않는다.
 */
function droppedStickers(replaced: readonly JsonNode[], added: readonly JsonNode[]): Sticker[] {
  const isCarried = replaced.length === 1 && added.length === 1 && added.every(canHoldStickers);
  const hasWrittenStickers = added.some((node) => stickersOf(node) !== undefined);
  if (isCarried || added.length === 0 || hasWrittenStickers) return [];
  return replaced.flatMap((node) => stickersOf(node) ?? []);
}

/** 노드와 그 안의 그림 — 문서 순서가 중요하다. 같은 src 그림이 여럿이면 옛 것과 새 것을 앞에서부터 짝짓는다 */
function imagesIn(node: JsonNode): JsonNode[] {
  if (node.type === "image") return [node];
  return (node.content ?? []).flatMap(imagesIn);
}

/** 그림과 함께 옮기는 에디터 전용 칸 — 설명 · 사진 자리에서 온 프롬프트(adr-043). 한 묶음으로 옮긴다 */
type CarriedBrief = Pick<BriefedImage, "brief" | "prompt">;

/** 그림의 에디터 전용 칸 — 설명도 프롬프트도 없으면 null */
function carriedOf(image: JsonNode): CarriedBrief | null {
  const { brief, prompt } = image.attrs ?? {};
  const carried: CarriedBrief = {
    ...(typeof brief === "string" ? { brief } : {}),
    ...(typeof prompt === "string" ? { prompt } : {}),
  };
  return Object.keys(carried).length === 0 ? null : carried;
}

function briefedImages(replaced: readonly JsonNode[], firstTop: number): BriefedImage[] {
  return replaced.flatMap((node, index) =>
    imagesIn(node).flatMap((image) => {
      const src = image.attrs?.src;
      const carried = carriedOf(image);
      if (typeof src !== "string" || carried === null) return [];
      return [{ src, ...carried, blockNumber: firstTop + index + 1 }];
    }),
  );
}

/** 새 블록들의 같은 src 그림(에디터 전용 칸이 없는 것)에 옛 설명 · 프롬프트를 앞에서부터 준다 */
function withCarriedBriefs(
  nodes: readonly JsonNode[],
  briefs: ReadonlyMap<string, readonly CarriedBrief[]>,
): JsonNode[] {
  const used = new Map<string, number>();
  const visit = (node: JsonNode): JsonNode => {
    if (node.type !== "image") {
      return node.content === undefined ? node : { ...node, content: node.content.map(visit) };
    }
    const src = node.attrs?.src;
    if (carriedOf(node) !== null || typeof src !== "string") return node;
    const at = used.get(src) ?? 0;
    const carried = briefs.get(src)?.[at];
    if (carried === undefined) return node;
    used.set(src, at + 1);
    return { ...node, attrs: { ...node.attrs, ...carried } };
  };
  return nodes.map(visit);
}

/**
 * 여러 블록 바꾸기가 사진 설명(brief) · 이미지 프롬프트(prompt) 있는 그림을 덮을 때(#172 · adr-043) — 새 markdown에
 * 같은 src 그림이 있으면 둘을 그 그림으로 옮기고, 옮길 그림이 없는 옛 그림은 `missing`으로 돌려준다(부르는 쪽이
 * 실패로 알린다). 사람이 쓴 설명이 말없이 사라지지 않게 한다. 지우기(`added`가 빔)는 블록째 없애 달라는 뜻이라 막지 않는다(스티커와 같다).
 */
function carryBriefs(
  replaced: readonly JsonNode[],
  added: readonly JsonNode[],
  firstTop: number,
): { nodes: JsonNode[]; missing: BriefedImage[] } {
  const old = briefedImages(replaced, firstTop);
  if (old.length === 0 || added.length === 0) return { nodes: [...added], missing: [] };
  const available = new Map<string, number>();
  added.flatMap(imagesIn).forEach((image) => {
    const src = image.attrs?.src;
    if (typeof src === "string" && carriedOf(image) === null) {
      available.set(src, (available.get(src) ?? 0) + 1);
    }
  });
  const briefs = new Map<string, CarriedBrief[]>();
  const missing: BriefedImage[] = [];
  old.forEach((image) => {
    const left = available.get(image.src) ?? 0;
    if (left === 0) {
      missing.push(image);
      return;
    }
    available.set(image.src, left - 1);
    const { brief, prompt } = image;
    const carried: CarriedBrief = {
      ...(brief === undefined ? {} : { brief }),
      ...(prompt === undefined ? {} : { prompt }),
    };
    briefs.set(image.src, [...(briefs.get(image.src) ?? []), carried]);
  });
  return { nodes: withCarriedBriefs(added, briefs), missing };
}

/**
 * 범위가 걸친 최상위 블록들의 보이는 글자를 처음부터 끝까지 덮는가 — 일부만 덮은 채 블록을 통째로
 * 바꾸면 고르지 않은 글자(다른 목록 항목 · 인용 문단)가 말없이 사라진다. 앞뒤 공백은 보이지 않으므로
 * 덮지 않아도 된다.
 */
function coversWholeBlocks(blocks: readonly TextBlockRef[], { start, end }: Found): boolean {
  const startRef = refAt(blocks, start.block);
  const endRef = refAt(blocks, end.block);
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
  if (!coversWholeBlocks(range.blocks, range)) {
    const isInOneCodeBlock = range.start.block === range.end.block && range.startRef.isCode;
    return fail(selectionPartialBlockMessage(isInOneCodeBlock));
  }
  const { content, startRef, endRef } = range;
  const replaced = content.slice(startRef.top, endRef.top + 1);
  const dropped = droppedStickers(replaced, added);
  if (dropped.length > 0)
    return fail(
      stickersWouldDropMessage(dropped.map(formatStickerDirective), added.some(canHoldStickers)),
    );
  const briefs = carryBriefs(replaced, carryStickers(replaced, added), startRef.top);
  if (briefs.missing.length > 0) return fail(briefsWouldDropMessage(briefs.missing));
  return finish([
    ...content.slice(0, startRef.top),
    ...briefs.nodes,
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
 *   - 한 글자 블록 안이고 새 글이 꾸밈 없는 문단 하나(또는 빈 글)면 그 글자만 바꾼다. 사진 자리는 설명으로
 *     찾지만 글자만 바꾸는 길이 없다 — 블록째 바꾼다(adr-033).
 *   - 그 밖에는 범위가 걸친 최상위 블록들을 새 markdown 블록들로 바꾼다. 범위가 그 블록들 전체를
 *     덮지 않으면 실패한다. 새 markdown이 sticker=를 쓰지 않았을 때 사람이 붙인 스티커를 지키려고,
 *     블록 하나를 블록 하나로 바꾸면 옛 스티커를 옮기고 그 밖에는 실패로 알린다(adr-032). 덮은 그림의 사진
 *     설명(brief)은 새 markdown의 같은 src 그림으로 옮기고, 그런 그림이 없으면 실패로 알린다(adr-039).
 * - `insert_after`: 범위 끝이 든 최상위 블록 뒤에 넣는다.
 */
export function editDocRange(doc: Doc, edit: RangeEdit): RangeEditResult {
  const root = doc as unknown as JsonNode;
  const blocks = collectTextBlocks(root);
  // 글자 그대로 먼저 — 코드 블록에는 `\` + 줄바꿈이 글자로 있다. 못 찾으면 get_post의 강제 줄바꿈 표기로 읽는다
  const asHardBreaks = edit.selection.replace(MARKDOWN_HARD_BREAK, HARD_BREAK_TEXT);
  const isDeletion = edit.command === "replace" && edit.markdown.trim() === "";
  const literal = locate(blocks, edit.selection, isDeletion);
  const located =
    literal.ok || asHardBreaks === edit.selection
      ? literal
      : locate(blocks, asHardBreaks, isDeletion);
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

  if (isDeletion && coversWholeBlocks(blocks, range)) return replaceBlocks(range, []);
  const isSameBlock = start.block === end.block;
  if (isSameBlock && range.startRef.isCode && !CODE_FENCE.test(edit.markdown)) {
    return replaceCodeText(range, edit.markdown);
  }
  const converted = isDeletion ? null : convertMarkdown(edit.markdown);
  if (converted !== null && !converted.ok) return converted;
  const inline = converted === null ? [] : inlineOnly(converted.doc);
  if (
    isSameBlock &&
    !range.startRef.isCode &&
    !range.startRef.isWholeBlockOnly &&
    inline !== null
  ) {
    return replaceInline(range, inline);
  }
  const added = converted === null ? [] : (converted.doc.content as unknown as JsonNode[]);
  return replaceBlocks(range, added);
}
