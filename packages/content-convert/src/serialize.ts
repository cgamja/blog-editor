import { normalize } from "@blog-editor/content-schema";
import type { Block, Doc, TextNode } from "@blog-editor/content-schema";
import { CALLOUT_CONTAINER_NAME } from "./tokens";
import { serializeInline, serializePlainLabel } from "./serialize-inline";

/**
 * doc → markdown(spec: markdown-serialize) — `get_post`가 AI에게 주는 글. 정답은 "다시 변환하면 같은
 * doc" 하나이고, 문법은 입력 스펙(markdown-format · markdown-callout · markdown-directive)을 그대로
 * 쓴다. markdown에 자리가 없는 것(스티커 · 빈 문단 · 참조 정의로 읽히는 코드 마크)은 조용히 버리지
 * 않고 losses로 돌려준다(design.md 1 · 2 · 7번).
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
const MIN_FENCE_LENGTH = 3;

interface ParagraphLike {
  type: "paragraph";
  content?: TextNode[] | undefined;
}
interface ListItemLike {
  type: "listItem";
  content: [ParagraphLike, ...ListLike[]];
}
interface ListLike {
  type: "bulletList" | "orderedList";
  content: ListItemLike[];
}

/** 한 최상위 블록을 쓰는 동안 빠진 것을 센다 — 스티커는 블록 attrs에서 바로 센다. */
interface BlockLosses {
  emptyParagraph: number;
  codeMark: number;
}

/** 같은 블록 안 losses 순서(spec: stickers가 먼저). */
const DROPPED_KINDS = ["emptyParagraph", "codeMark"] as const;

function inlineOf(paragraph: ParagraphLike, dropped: BlockLosses): string | undefined {
  if (paragraph.content === undefined || paragraph.content.length === 0) {
    dropped.emptyParagraph += 1;
    return undefined;
  }
  const { text, droppedCodeMarks } = serializeInline(paragraph.content, "paragraph");
  dropped.codeMark += droppedCodeMarks;
  return text;
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

function listMarker(type: ListLike["type"], index: number, alternate: boolean): string {
  if (type === "bulletList") return alternate ? "*" : "-";
  return `${index + 1}${alternate ? ")" : "."}`;
}

/** 빈 문단으로 시작하는 항목은 안쪽 목록째 빠진다(design.md 2번). 남는 항목이 없으면 undefined. */
function serializeList(
  list: ListLike,
  dropped: BlockLosses,
  alternate: boolean,
): string | undefined {
  const items: string[] = [];
  for (const item of list.content) {
    const [paragraph, ...nested] = item.content;
    const inline = inlineOf(paragraph, dropped);
    if (inline === undefined) continue;
    const marker = listMarker(list.type, items.length, alternate);
    const indent = " ".repeat(marker.length + 1);
    const lines = [`${marker} ${inline}`];
    const markers = new ListMarkers();
    for (const child of nested) {
      const text = serializeListAmong(child, dropped, markers);
      if (text !== undefined) lines.push(...text.split("\n").map((line) => `${indent}${line}`));
    }
    items.push(lines.join("\n"));
  }
  return items.length > 0 ? items.join("\n") : undefined;
}

/** 다른 블록 · 목록과 이웃한 자리의 목록 — 바로 앞에 쓴 것이 같은 종류 목록이면 표지를 바꾼다. */
function serializeListAmong(
  list: ListLike,
  dropped: BlockLosses,
  markers: ListMarkers,
): string | undefined {
  const alternate = markers.alternateFor(list.type);
  const text = serializeList(list, dropped, alternate);
  if (text !== undefined) markers.wroteList(list.type, alternate);
  return text;
}

function directiveLine(block: Block): string | undefined {
  const attrs = (block.attrs ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (block.type === "appScreenshot") parts.push("frame=app");
  for (const key of ["font", "motion", "width"] as const) {
    if (attrs[key] !== undefined) parts.push(`${key}=${String(attrs[key])}`);
  }
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
      return content.length > 0 ? `${hashes} ${serializeInline(content, "heading").text}` : hashes;
    }
    case "blockquote": {
      const lines = block.content
        .map((paragraph) => inlineOf(paragraph, dropped))
        .filter((line): line is string => line !== undefined)
        .map((line) => `> ${line}`);
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
