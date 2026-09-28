import type Token from "markdown-it/lib/token.mjs";
import { BRIEF_MAX_LENGTH, PHOTO_RATIOS, PROMPT_MAX_LENGTH } from "@blog-editor/content-schema";
import { PHOTO_CONTAINER_NAME, PHOTO_PROMPT_PREFIX } from "./constants";
import type { FoundMessage } from "./message";
import {
  photoBriefEmptyMessage,
  photoBriefLengthMessage,
  photoBriefShapeMessage,
  photoNotClosedMessage,
  photoNotTopMessage,
  photoPromptEmptyMessage,
  photoPromptJoinedMessage,
  photoPromptLengthMessage,
  photoRatioMessage,
} from "./photo.messages";
import type { BlockRecord } from "./types";

type PhotoRatio = (typeof PHOTO_RATIOS)[number];

const RATIO_PAIR = /^ratio=(\S+)$/;
/** 설명 문단 안에 올 수 있는 인라인 — 글자 · 이스케이프 글자 · 줄 이음(공백 하나가 된다). 마크 · 링크 · 코드는 자리가 없다 */
const BRIEF_CHILD_TYPES: ReadonlySet<string> = new Set(["text", "text_special", "softbreak"]);
const CLOSING_LINE = /^:{3,}[ \t]*$/;
/** 문단 하나의 토큰 수 — paragraph_open · inline · paragraph_close */
const PARAGRAPH_TOKEN_COUNT = 3;
const INLINE_OFFSET = 1;
const CLOSE_OFFSET = 2;
/** 사진 자리 안 문단은 설명 하나 · 프롬프트 하나까지다(adr-043) */
const MAX_PARAGRAPHS = 2;

/** `:::photo` 뒤 `ratio=<비율>`(생략 가능) — 그 밖의 글자는 받지 않는다 */
export function parsePhotoInfo(
  info: string,
): { ok: true; ratio: PhotoRatio | undefined } | { ok: false; received: string } {
  const rest = info.trim().slice(PHOTO_CONTAINER_NAME.length).trim();
  if (rest === "") return { ok: true, ratio: undefined };
  const value = RATIO_PAIR.exec(rest)?.[1];
  const ratio = PHOTO_RATIOS.find((candidate) => candidate === value);
  return ratio === undefined ? { ok: false, received: rest } : { ok: true, ratio };
}

/** 설명 문단의 보이는 글자 — 파서(prosemirror-markdown)도 줄 이음을 공백 하나로 읽는다. 자리 밖 인라인이면 null */
function briefOf(inline: Token | undefined): string | null {
  const children = inline?.children ?? [];
  if (children.some((child) => !BRIEF_CHILD_TYPES.has(child.type))) return null;
  const brief = children
    .map((child) => (child.type === "softbreak" ? " " : child.content))
    .join("")
    .trim();
  return /[\r\n]/.test(brief) ? null : brief;
}

interface PhotoParagraph {
  inline: Token;
  /** 원문 줄 범위(0부터, 끝은 제외) */
  lines: readonly [number, number];
}

/** 안쪽이 문단 하나(설명) 또는 둘(설명 · 프롬프트)이면 각 문단 — 그 밖의 모양이면 null */
function paragraphsOf(inner: readonly Token[], fallbackLine0: number): PhotoParagraph[] | null {
  const count = inner.length / PARAGRAPH_TOKEN_COUNT;
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARAGRAPHS) return null;
  const paragraphs: PhotoParagraph[] = [];
  for (let at = 0; at < inner.length; at += PARAGRAPH_TOKEN_COUNT) {
    const open = inner[at]!;
    if (open.type !== "paragraph_open" || inner[at + CLOSE_OFFSET]!.type !== "paragraph_close") {
      return null;
    }
    const [start0, end0] = open.map ?? [fallbackLine0, fallbackLine0 + 1];
    paragraphs.push({ inline: inner[at + INLINE_OFFSET]!, lines: [start0, end0] });
  }
  return paragraphs;
}

/**
 * 원문 줄이 `prompt:`로 시작하는가 — 원문을 보므로 `prompt\:`(이스케이프)는 글자 그대로의 설명이다. 파싱된 글자로는
 * 둘을 가를 수 없다(markdown-it이 이스케이프 글자를 글자로 합친다)
 */
const startsWithPrefix = (line: string | undefined) =>
  (line ?? "").trimStart().startsWith(PHOTO_PROMPT_PREFIX);

/** 설명 문단 — 꾸밈 없는 글 · 비지 않음 · 길이 · 어느 줄도 `prompt:`로 시작하지 않음(빈 줄을 빠뜨리면 설명에 붙는다) */
function checkBrief(
  paragraph: PhotoParagraph,
  record: BlockRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
  const [start0, end0] = paragraph.lines;
  const line = start0 + 1;
  const brief = briefOf(paragraph.inline);
  const joinedLine0 = sourceLines
    .slice(start0, end0)
    .findIndex((sourceLine) => startsWithPrefix(sourceLine));
  if (brief === null) {
    messages.push(photoBriefShapeMessage(record.topLevel, line, sourceLines[start0] ?? ""));
  } else if (joinedLine0 !== -1) {
    const at = start0 + joinedLine0;
    messages.push(photoPromptJoinedMessage(record.topLevel, at + 1, sourceLines[at] ?? ""));
  } else if (brief === "") {
    const opening0 = record.mapStart0;
    messages.push(
      photoBriefEmptyMessage(record.topLevel, opening0 + 1, sourceLines[opening0] ?? ""),
    );
  } else if (brief.length > BRIEF_MAX_LENGTH) {
    messages.push(photoBriefLengthMessage(record.topLevel, line, brief));
  }
}

/** 둘째 문단은 `prompt:` 한 문단(adr-043) — 꾸밈 없는 글 · 비지 않음 · 길이 */
function checkPrompt(
  paragraph: PhotoParagraph,
  record: BlockRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
  const start0 = paragraph.lines[0];
  const line = start0 + 1;
  const received = sourceLines[start0] ?? "";
  const text = briefOf(paragraph.inline);
  if (text === null || !startsWithPrefix(received)) {
    messages.push(photoBriefShapeMessage(record.topLevel, line, received));
    return;
  }
  const prompt = text.slice(PHOTO_PROMPT_PREFIX.length).trim();
  if (prompt === "") {
    messages.push(photoPromptEmptyMessage(record.topLevel, line, received));
  } else if (prompt.length > PROMPT_MAX_LENGTH) {
    messages.push(photoPromptLengthMessage(record.topLevel, line, prompt));
  }
}

/** 짝이 없으면 마지막 토큰 */
function closeIndexOf(tokens: readonly Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const type = tokens[i]!.type;
    if (type === "container_photo_open") depth += 1;
    if (type === "container_photo_close") depth -= 1;
    if (depth === 0) return i;
  }
  return tokens.length - 1;
}

/**
 * `:::photo` 한 개를 검사한다(adr-033 · adr-043) — 자리(최상위만) · 비율 · 설명 한 문단(꾸밈 없는 글) · 길이 ·
 * 있으면 `prompt:` 문단. 안쪽 토큰은 레지스트리에 넣지 않는다(사진 자리는 최상위 블록 하나다). 돌려주는 순번은
 * 짝인 닫는 토큰이다 — 부르는 쪽이 그 다음부터 훑는다.
 */
export function checkPhotoContainer(
  tokens: readonly Token[],
  open: number,
  record: BlockRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): number {
  const tok = tokens[open]!;
  const close = closeIndexOf(tokens, open);
  const line = record.mapStart0 + 1;
  const raw = sourceLines[record.mapStart0] ?? "";

  if (record.container !== "top") {
    messages.push(photoNotTopMessage(record.topLevel, line, raw));
    return close;
  }
  const closingLine = (sourceLines[record.mapEnd0] ?? "").trim();
  if (!CLOSING_LINE.test(closingLine)) messages.push(photoNotClosedMessage(line, raw));

  const info = parsePhotoInfo(tok.info);
  if (!info.ok) messages.push(photoRatioMessage(record.topLevel, line, info.received));

  const inner = tokens.slice(open + 1, close);
  if (inner.length === 0) {
    messages.push(photoBriefEmptyMessage(record.topLevel, line, raw));
    return close;
  }
  const paragraphs = paragraphsOf(inner, record.mapStart0 + 1);
  if (paragraphs === null) {
    const line0 = inner[0]!.map?.[0] ?? record.mapStart0;
    messages.push(photoBriefShapeMessage(record.topLevel, line0 + 1, sourceLines[line0] ?? ""));
    return close;
  }
  const [briefParagraph, promptParagraph] = paragraphs;
  checkBrief(briefParagraph!, record, sourceLines, messages);
  if (promptParagraph !== undefined) checkPrompt(promptParagraph, record, sourceLines, messages);
  return close;
}
