import { naturalSizeOf, normalize, orderedListNumberAt } from "@blog-editor/content-schema";
import type { Block, Doc, InlineNode } from "@blog-editor/content-schema";
import { APP_FRAME, CALLOUT_CONTAINER_NAME, DIRECTIVE_KEYS, SIZE_SEPARATOR } from "./constants";
import { serializeInline, serializeParagraph, serializePlainLabel } from "./serialize-inline";

/**
 * doc → markdown(spec: markdown-serialize) — `get_post`가 AI에게 주는 글. 정답은 "다시 변환하면 같은
 * doc" 하나이고, 문법은 입력 스펙(markdown-format · markdown-callout · markdown-directive)을 그대로
 * 쓴다. markdown에 자리가 없는 것(스티커 · 빈 문단 · 참조 정의로 읽히는 코드 마크)은 조용히 버리지
 * 않고 losses로 돌려준다(design.md 1 · 2 · 2-b · 7번).
 */

export interface SerializeLoss {
  /** 원래 doc의 최상위 블록 번호(1부터). */
  block: number;
  kind: "stickers" | "emptyParagraph" | "codeMark";
  count: number;
}

export interface SerializeResult {
  markdown: string;
  losses: SerializeLoss[];
}

/** 최상위 블록 · 콜아웃 안 블록 사이 구분 — 빈 줄 하나. */
const BLOCK_SEPARATOR = "\n\n";
/**
 * 문단을 끊고 목록을 시작할 수 있는 번호 — 다른 번호로 시작하는 목록은 바로 위 글줄의 이어진 글자로 읽힌다
 * (CommonMark 5.2 "In order for a sequence of lines to constitute a list item … start with 1").
 */
const PARAGRAPH_INTERRUPTING_LIST_START = 1;
const MIN_FENCE_LENGTH = 3;
const BLOCKQUOTE_PREFIX = "> ";

interface ParagraphLike {
  type: "paragraph";
  content?: InlineNode[] | undefined;
}
interface ListItemLike {
  type: "listItem";
  content: [ParagraphLike, ...ListLike[]];
}
interface ListLike {
  type: "bulletList" | "orderedList";
  attrs?: { start?: number | undefined } | undefined;
  content: ListItemLike[];
}

/** 한 최상위 블록을 쓰는 동안 빠진 것을 센다 — 스티커는 블록 attrs에서 바로 센다. */
interface BlockLosses {
  emptyParagraph: number;
  codeMark: number;
}

/** 같은 블록 안 losses 순서(spec: stickers가 먼저). */
const DROPPED_KINDS = ["emptyParagraph", "codeMark"] as const;

/** 강제 줄바꿈 — 줄 끝 `\`(adr-028). 줄 끝 공백 둘은 보이지 않고 편집기가 지우기 쉬워 쓰지 않는다 */
const HARD_BREAK = "\\\n";

/**
 * 문단 → 줄들을 강제 줄바꿈으로 이은 글. 이어진 줄 앞에는 `continuation`(인용 `> ` · 목록 항목 들여쓰기)을 붙인다 —
 * 첫 줄 앞 표지는 부르는 쪽이 붙인다. 빈 문단은 undefined(losses의 emptyParagraph).
 */
function inlineOf(
  paragraph: ParagraphLike,
  dropped: BlockLosses,
  continuation = "",
): string | undefined {
  if (paragraph.content === undefined || paragraph.content.length === 0) {
    dropped.emptyParagraph += 1;
    return undefined;
  }
  const { lines, droppedCodeMarks } = serializeParagraph(paragraph.content);
  dropped.codeMark += droppedCodeMarks;
  return lines.join(`${HARD_BREAK}${continuation}`);
}

/**
 * 같은 종류 목록이 이웃하면 markdown은 하나로 합친다 — 표지를 바꿔(`-`↔`*`, `1.`↔`1)`) 따로 남긴다.
 * 이웃은 실제로 쓴 블록 기준이다: 빠진(빈) 블록은 사이를 떼어 주지 않는다.
 */
class ListMarkers {
  private previous: { type: ListLike["type"]; alternate: boolean } | undefined;

  alternateFor(type: ListLike["type"]): boolean {
    return this.previous?.type === type ? !this.previous.alternate : false;
  }

  wroteList(type: ListLike["type"], alternate: boolean): void {
    this.previous = { type, alternate };
  }

  wroteOther(): void {
    this.previous = undefined;
  }
}

/** 번호 목록 표지는 시작 번호부터 센다 — markdown은 첫 표지 번호를 시작 번호로 읽는다(CommonMark 5.2) */
function listMarker(list: ListLike, index: number, alternate: boolean): string {
  if (list.type === "bulletList") return alternate ? "*" : "-";
  return `${orderedListNumberAt(list.attrs?.start, index)}${alternate ? ")" : "."}`;
}

function isEmptyParagraph(paragraph: ParagraphLike): boolean {
  return paragraph.content === undefined || paragraph.content.length === 0;
}

/**
 * 첫 문단이 빈 항목은 빼되 그 안쪽 목록은 버리지 않고 한 단계 위로 올린다(design.md 2-b) — 목록을
 * 그 자리에서 나누고 올라간 목록을 사이에 둔다. 결과 목록들의 모든 항목은 첫 문단이 비지 않는다.
 * 나뉜 번호 목록 조각은 원래 번호를 잇는다(ordered-list-start).
 */
function liftEmptyItems(list: ListLike, dropped: BlockLosses): ListLike[] {
  const lists: ListLike[] = [];
  let items: ListItemLike[] = [];
  let firstIndex = 0;
  const flush = (nextIndex: number): void => {
    if (items.length > 0) {
      const start = orderedListNumberAt(list.attrs?.start, firstIndex);
      lists.push(
        list.type === "orderedList"
          ? { type: list.type, attrs: { start }, content: items }
          : { type: list.type, content: items },
      );
    }
    items = [];
    firstIndex = nextIndex;
  };
  list.content.forEach((item, index) => {
    const [paragraph, ...nested] = item.content;
    const liftedNested = nested.flatMap((child) => liftEmptyItems(child, dropped));
    if (isEmptyParagraph(paragraph)) {
      dropped.emptyParagraph += 1;
      flush(index + 1);
      lists.push(...liftedNested);
    } else {
      items.push({ type: "listItem", content: [paragraph, ...liftedNested] });
    }
  });
  flush(list.content.length);
  return lists;
}

/** 이웃한 목록들 — 바로 앞에 쓴 것이 같은 종류 목록이면 표지를 바꾼다. 쓸 목록이 없으면 undefined. */
function renderLists(
  lists: readonly ListLike[],
  dropped: BlockLosses,
  markers: ListMarkers,
  separator: string,
): string | undefined {
  const texts = lists.map((list, index) => {
    const alternate = markers.alternateFor(list.type);
    markers.wroteList(list.type, alternate);
    const text = renderList(list, dropped, alternate);
    // 블록 사이(빈 줄)가 아니라 줄바꿈으로 잇는 안쪽 목록만 빈 줄이 더 필요하다
    const needsBlankLine =
      separator !== BLOCK_SEPARATOR && index > 0 && cannotInterruptParagraph(list);
    return needsBlankLine ? `\n${text}` : text;
  });
  return texts.length > 0 ? texts.join(separator) : undefined;
}

/** 안쪽 목록처럼 빈 줄 없이 잇는 자리에서 이 목록은 앞에 빈 줄이 있어야 한다 */
function cannotInterruptParagraph(list: ListLike): boolean {
  return (
    list.type === "orderedList" &&
    orderedListNumberAt(list.attrs?.start, 0) !== PARAGRAPH_INTERRUPTING_LIST_START
  );
}

/** liftEmptyItems를 거친 목록 하나 — 안쪽 목록은 항목 들여쓰기 아래 빈 줄 없이 잇는다. */
function renderList(list: ListLike, dropped: BlockLosses, alternate: boolean): string {
  return list.content
    .map((item, index) => {
      const [paragraph, ...nested] = item.content;
      const marker = listMarker(list, index, alternate);
      const indent = " ".repeat(marker.length + 1);
      // liftEmptyItems가 첫 문단이 빈 항목을 이미 뺐으므로 inlineOf는 늘 글자를 돌려준다.
      const lines = [`${marker} ${inlineOf(paragraph, dropped, indent) ?? ""}`];
      const nestedText = renderLists(nested, dropped, new ListMarkers(), "\n");
      if (nestedText !== undefined) {
        if (nested[0] !== undefined && cannotInterruptParagraph(nested[0])) lines.push("");
        lines.push(
          ...nestedText.split("\n").map((line) => (line === "" ? "" : `${indent}${line}`)),
        );
      }
      return lines.join("\n");
    })
    .join("\n");
}

/** 최상위 · 콜아웃처럼 블록이 빈 줄로 이어지는 자리의 목록. 올라간 목록도 이웃 블록으로 쓴다. */
function serializeListAmong(
  list: ListLike,
  dropped: BlockLosses,
  markers: ListMarkers,
): string | undefined {
  return renderLists(liftEmptyItems(list, dropped), dropped, markers, BLOCK_SEPARATOR);
}

function directiveValue(block: Block, key: (typeof DIRECTIVE_KEYS)[number]): unknown {
  if (key === "frame") return block.type === "appScreenshot" ? APP_FRAME : undefined;
  const attrs = block.attrs as Record<string, unknown> | undefined;
  if (key === "size") {
    const size = naturalSizeOf(attrs ?? {});
    return size === null
      ? undefined
      : `${String(size.width)}${SIZE_SEPARATOR}${String(size.height)}`;
  }
  return attrs?.[key];
}

function directiveLine(block: Block): string | undefined {
  const parts = DIRECTIVE_KEYS.flatMap((key) => {
    const value = directiveValue(block, key);
    return value === undefined ? [] : [`${key}=${String(value)}`];
  });
  return parts.length > 0 ? `{${parts.join(" ")}}` : undefined;
}

function codeFence(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(MIN_FENCE_LENGTH, longestRun + 1));
}

function serializeCallout(
  block: Extract<Block, { type: "callout" }>,
  dropped: BlockLosses,
): string | undefined {
  const markers = new ListMarkers();
  const children: string[] = [];
  for (const child of block.content) {
    const text =
      child.type === "paragraph"
        ? inlineOf(child, dropped)
        : serializeListAmong(child as ListLike, dropped, markers);
    if (text === undefined) continue;
    if (child.type === "paragraph") markers.wroteOther();
    children.push(text);
  }
  if (children.length === 0) return undefined;
  return [
    `:::${CALLOUT_CONTAINER_NAME} tone=${block.attrs.tone}`,
    children.join(BLOCK_SEPARATOR),
    ":::",
  ].join("\n");
}

/** GFM 구분 줄의 열 표지 — 정렬 없음(정규형이 left를 지운다)은 `---` */
const COLUMN_DELIMITER: Record<string, string> = { center: ":-:", right: "--:" };
const PLAIN_COLUMN_DELIMITER = "---";

function tableLine(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

type TableCell = Extract<Block, { type: "table" }>["content"][number]["content"][number];

function cellText(cell: TableCell, dropped: BlockLosses): string {
  const { text, droppedCodeMarks } = serializeInline(cell.content[0].content ?? [], "cell");
  dropped.codeMark += droppedCodeMarks;
  return text;
}

/** 첫 행이 머리 줄, 열 정렬은 머리 행 칸에 있다(adr-028). 빈 칸은 GFM에서도 빈 칸이라 빠진 것이 아니다 */
function serializeTable(block: Extract<Block, { type: "table" }>, dropped: BlockLosses): string {
  const lines = block.content.map((row) =>
    tableLine(row.content.map((cell) => cellText(cell, dropped))),
  );
  const head = block.content[0]?.content ?? [];
  const delimiters = head.map(
    (cell) => COLUMN_DELIMITER[cell.attrs?.align ?? ""] ?? PLAIN_COLUMN_DELIMITER,
  );
  return [lines[0], tableLine(delimiters), ...lines.slice(1)].join("\n");
}

function serializeBlockBody(
  block: Block,
  dropped: BlockLosses,
  markers: ListMarkers,
): string | undefined {
  switch (block.type) {
    case "paragraph":
      return inlineOf(block, dropped);
    case "heading": {
      const hashes = "#".repeat(block.attrs.level);
      const content = block.content ?? [];
      if (content.length === 0) return hashes;
      const { text, droppedCodeMarks } = serializeInline(content, "heading");
      dropped.codeMark += droppedCodeMarks;
      return `${hashes} ${text}`;
    }
    case "blockquote": {
      const lines = block.content
        .map((paragraph) => inlineOf(paragraph, dropped, BLOCKQUOTE_PREFIX))
        .filter((line): line is string => line !== undefined)
        .map((line) => `${BLOCKQUOTE_PREFIX}${line}`);
      return lines.length > 0 ? lines.join("\n>\n") : undefined;
    }
    case "codeBlock": {
      const text = (block.content ?? []).map((node) => node.text).join("");
      const fence = codeFence(text);
      const opening = `${fence}${block.attrs?.language ?? ""}`;
      return text === "" ? `${opening}\n${fence}` : `${opening}\n${text}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    case "image":
      return `![${serializePlainLabel(block.attrs.alt)}](${block.attrs.src})`;
    case "appScreenshot":
      return `![${serializePlainLabel(block.attrs.caption)}](${block.attrs.src})`;
    case "callout":
      return serializeCallout(block, dropped);
    case "bulletList":
    case "orderedList":
      return serializeListAmong(block as ListLike, dropped, markers);
    case "table":
      return serializeTable(block, dropped);
  }
}

/** 문서를 입력 문법 markdown으로 쓴다. 순수 함수 — 입력을 바꾸지 않는다(normalize가 새 객체를 준다). */
export function serializeMarkdown(doc: Doc): SerializeResult {
  const blocks: string[] = [];
  const losses: SerializeLoss[] = [];
  const markers = new ListMarkers();

  normalize(doc).content.forEach((block, index) => {
    const blockNumber = index + 1;
    const stickers = (block.attrs as { stickers?: unknown[] } | undefined)?.stickers ?? [];
    if (stickers.length > 0) {
      losses.push({ block: blockNumber, kind: "stickers", count: stickers.length });
    }

    const dropped: BlockLosses = { emptyParagraph: 0, codeMark: 0 };
    const body = serializeBlockBody(block, dropped, markers);
    for (const kind of DROPPED_KINDS) {
      if (dropped[kind] > 0) losses.push({ block: blockNumber, kind, count: dropped[kind] });
    }
    if (body === undefined) return;
    if (block.type !== "bulletList" && block.type !== "orderedList") markers.wroteOther();
    const directive = directiveLine(block);
    blocks.push(directive === undefined ? body : `${directive}\n${body}`);
  });

  return { markdown: blocks.length > 0 ? `${blocks.join(BLOCK_SEPARATOR)}\n` : "", losses };
}
