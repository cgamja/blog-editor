import type Token from "markdown-it/lib/token.mjs";
import { BRIEF_MAX_LENGTH, PHOTO_RATIOS } from "@blog-editor/content-schema";
import { PHOTO_CONTAINER_NAME } from "./constants";
import type { FoundMessage } from "./message";
import {
  photoBriefEmptyMessage,
  photoBriefLengthMessage,
  photoBriefShapeMessage,
  photoNotClosedMessage,
  photoNotTopMessage,
  photoRatioMessage,
} from "./photo.messages";
import type { BlockRecord } from "./types";

type PhotoRatio = (typeof PHOTO_RATIOS)[number];

const RATIO_PAIR = /^ratio=(\S+)$/;
/** 설명 문단 안에 올 수 있는 인라인 — 글자 · 이스케이프 글자 · 줄 이음(공백 하나가 된다). 마크 · 링크 · 코드는 자리가 없다 */
const BRIEF_CHILD_TYPES: ReadonlySet<string> = new Set(["text", "text_special", "softbreak"]);
const CLOSING_LINE = /^:{3,}[ \t]*$/;

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
 * `:::photo` 한 개를 검사한다(adr-033) — 자리(최상위만) · 비율 · 설명 한 문단(꾸밈 없는 글) · 길이. 안쪽 토큰은
 * 레지스트리에 넣지 않는다(사진 자리는 최상위 블록 하나다). 돌려주는 순번은 짝인 닫는 토큰이다 — 부르는 쪽이
 * 그 다음부터 훑는다.
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
  const isOneParagraph =
    inner.length === 3 &&
    inner[0]!.type === "paragraph_open" &&
    inner[2]!.type === "paragraph_close";
  const brief = isOneParagraph ? briefOf(inner[1]) : null;
  const briefLine = (inner[0]!.map?.[0] ?? record.mapStart0) + 1;
  if (brief === null) {
    messages.push(
      photoBriefShapeMessage(record.topLevel, briefLine, sourceLines[briefLine - 1] ?? ""),
    );
  } else if (brief === "") {
    messages.push(photoBriefEmptyMessage(record.topLevel, line, raw));
  } else if (brief.length > BRIEF_MAX_LENGTH) {
    messages.push(photoBriefLengthMessage(record.topLevel, briefLine, brief));
  }
  return close;
}
