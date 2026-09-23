import type { TextNode } from "@blog-editor/content-schema";
import { createMarkdownIt } from "./tokens";

/**
 * 인라인(텍스트 + 마크) → markdown 한 줄(spec: markdown-serialize). 정답은 "다시 읽으면 같은 인라인"
 * 하나라서, 강조가 성립하는지는 파서와 같은 판정(markdown-it `scanDelims`의 flanking 규칙)으로
 * 확인하고, 성립하지 않는 경계 글자는 숫자 문자 참조로 바꿔 구두점으로 만든다(design.md 3번).
 *
 * 순서: 링크 묶음(같은 href가 이어진 노드) → 묶음 안 강조 스택(굵게 · 기울임) → 코드 스팬.
 * 강조는 링크 묶음 경계에서 전부 닫고 다시 연다 — 다시 읽으면 같은 마크라 doc는 같다.
 */

const { isWhiteSpace, isMdAsciiPunct, isPunctCharCode } = createMarkdownIt().utils;

type Emphasis = "bold" | "italic";
type DelimChar = "*" | "_";

type Piece =
  | { kind: "char"; cp: string; mode: "plain" | "escape" | "entity" }
  /** 코드 스팬 · 링크 괄호 — 양 끝 글자가 늘 구두점(`` ` `` · `[` · `]` · `)`)이다. */
  | { kind: "raw"; text: string; code?: TextNode }
  | { kind: "delim"; ch: DelimChar; mark: Emphasis; role: "open" | "close" };

/** 줄 어디서든 문법이 되는 글자 — 늘 백슬래시. */
const ALWAYS_ESCAPE = new Set(["\\", "*", "_", "`", "[", "]", "<", "&", "~"]);
/** 줄 첫 글자일 때만 블록 문법이 되는 글자(제목 · 인용 · 목록 · 지시어 · 컨테이너 …). */
const LINE_START_ESCAPE = new Set(["#", ">", "-", "+", "=", "{", ":"]);
/** 블록 글자의 앞뒤라면 markdown-it이 잘라 버리는 공백류(JS trim과 같은 판정). */
const EDGE_TRIMMED = /^\s$/u;
/** 백슬래시로도 못 나르는 글자 — 줄을 끊는다. */
const LINE_BREAKS = new Set(["\n", "\r"]);
/** 순서 목록 표지로 읽히는 줄 첫 숫자의 최대 길이(CommonMark). */
const MAX_LIST_NUMBER_DIGITS = 9;

const MARK_DELIM: Record<Emphasis, number> = { bold: 2, italic: 1 };

type CharClass = "space" | "punct" | "word";

function classifyCodePoint(cp: string): CharClass {
  const code = cp.codePointAt(0) ?? 0x20;
  if (isWhiteSpace(code)) return "space";
  if (isMdAsciiPunct(code) || isPunctCharCode(code)) return "punct";
  return "word";
}

/** 구분자 묶음 바로 옆 조각의 글자 부류 — 없으면(줄 끝) 공백으로 친다(markdown-it과 같다). */
function sideClass(piece: Piece | undefined): CharClass {
  if (piece === undefined) return "space";
  if (piece.kind === "char") return piece.mode === "plain" ? classifyCodePoint(piece.cp) : "punct";
  return "punct";
}

function charPieces(text: string, mode: "plain" | "escape" = "plain"): Piece[] {
  return Array.from(text, (cp) => ({
    kind: "char" as const,
    cp,
    mode: LINE_BREAKS.has(cp) ? ("entity" as const) : ALWAYS_ESCAPE.has(cp) ? "escape" : mode,
  }));
}

function codeSpan(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  // markdown-it은 코드 스팬 안이 `^ (.+) $`이면 앞뒤 공백 하나씩을 벗긴다(rules_inline/backticks.mjs,
  // CommonMark와 달리 공백뿐인 글자도) — 그런 글자와 백틱으로 시작 · 끝나는 글자는 공백으로 한 겹 싼다.
  const needsPad = text.startsWith("`") || text.endsWith("`") || /^ (.+) $/.test(text);
  const pad = needsPad ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function escapeHref(href: string): string {
  return href.replace(/[()<>]/g, (ch) => `\\${ch}`);
}

function emphasisOf(node: TextNode): Set<Emphasis> {
  const set = new Set<Emphasis>();
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold" || mark.type === "italic") set.add(mark.type);
  }
  return set;
}

function hasCode(node: TextNode): boolean {
  return (node.marks ?? []).some((mark) => mark.type === "code");
}

function linkOf(node: TextNode): string | undefined {
  const link = (node.marks ?? []).find((mark) => mark.type === "link");
  return link?.type === "link" ? link.attrs.href : undefined;
}

/** 노드 i에서 mark가 몇 번째 노드까지 이어지나 — 더 멀리 가는 마크를 바깥에 연다. */
function spanEnd(nodes: readonly TextNode[], start: number, mark: Emphasis): number {
  let end = start;
  while (end < nodes.length && emphasisOf(nodes[end]!).has(mark)) end += 1;
  return end;
}

interface OpenSpan {
  mark: Emphasis;
  ch: DelimChar;
}

function delim(span: OpenSpan, role: "open" | "close"): Piece {
  return { kind: "delim", ch: span.ch, mark: span.mark, role };
}

/**
 * 링크 없는(또는 한 링크 안의) 노드들을 강조 스택으로 푼다. 새로 여는 구분자 글자는 아직 열린
 * 구분자 · 같은 경계에서 방금 닫은 구분자와 다르게 고른다(`*` 아니면 `_`) — 같은 글자면 여는
 * 묶음이 열린 강조를 닫아 버리거나(양쪽 flanking), 닫는 묶음과 붙어 한 묶음(`***`)이 되어 짝이
 * 어긋난다(design.md 3번). 구분자는 글자가 같을 때만 짝이 되므로 글자를 나누면 모호함이 없다.
 */
function emphasisPieces(nodes: readonly TextNode[], plainCode: ReadonlySet<TextNode>): Piece[] {
  const pieces: Piece[] = [];
  const stack: OpenSpan[] = [];

  nodes.forEach((node, index) => {
    const wanted = emphasisOf(node);
    let lastClosed: DelimChar | undefined;
    while (stack.some((span) => !wanted.has(span.mark))) {
      const span = stack.pop()!;
      pieces.push(delim(span, "close"));
      lastClosed = span.ch;
    }
    const toOpen = [...wanted]
      .filter((mark) => !stack.some((span) => span.mark === mark))
      .sort((a, b) => spanEnd(nodes, index, b) - spanEnd(nodes, index, a) || (a < b ? -1 : 1));
    const taken = new Set([lastClosed, ...stack.map((span) => span.ch)]);
    const openCh: DelimChar = taken.has("*") ? "_" : "*";
    for (const mark of toOpen) {
      const span = { mark, ch: openCh };
      stack.push(span);
      pieces.push(delim(span, "open"));
    }
    if (hasCode(node) && !plainCode.has(node)) {
      pieces.push({ kind: "raw", text: codeSpan(node.text), code: node });
    } else {
      pieces.push(...charPieces(node.text));
    }
  });

  while (stack.length > 0) pieces.push(delim(stack.pop()!, "close"));
  return pieces;
}

function toPieces(nodes: readonly TextNode[], plainCode: ReadonlySet<TextNode>): Piece[] {
  const pieces: Piece[] = [];
  let start = 0;
  while (start < nodes.length) {
    const href = linkOf(nodes[start]!);
    let end = start + 1;
    while (end < nodes.length && linkOf(nodes[end]!) === href) end += 1;
    const group = nodes.slice(start, end);
    if (href === undefined) {
      pieces.push(...emphasisPieces(group, plainCode));
    } else {
      pieces.push({ kind: "raw", text: "[" });
      pieces.push(...emphasisPieces(group, plainCode));
      pieces.push({ kind: "raw", text: `](${escapeHref(href)})` });
    }
    start = end;
  }
  return pieces;
}

function toEntity(piece: Piece | undefined): boolean {
  if (piece?.kind !== "char" || piece.mode !== "plain") return false;
  piece.mode = "entity";
  return true;
}

/**
 * 구분자 묶음(같은 글자가 이어진 delim)마다 여는 쪽은 열 수 있고 닫는 쪽은 닫을 수 있게, 바로
 * 옆 글자를 문자 참조로 바꾼다(markdown-it `scanDelims`: `*`는 단어 속에서도 되고 `_`는 안 된다).
 * 한 글자를 바꾸면 이웃 묶음의 판정도 바뀌므로 더 바뀌지 않을 때까지 돈다 — 바꾸기는 plain →
 * entity 한 방향뿐이라 끝난다.
 */
function fixFlanking(pieces: Piece[]): void {
  let changed = true;
  while (changed) {
    changed = false;
    let index = 0;
    while (index < pieces.length) {
      const first = pieces[index]!;
      if (first.kind !== "delim") {
        index += 1;
        continue;
      }
      let end = index;
      let hasOpen = false;
      let hasClose = false;
      while (end < pieces.length) {
        const piece = pieces[end]!;
        if (piece.kind !== "delim" || piece.ch !== first.ch) break;
        if (piece.role === "open") hasOpen = true;
        else hasClose = true;
        end += 1;
      }
      changed = fixRun(pieces[index - 1], pieces[end], first.ch, hasOpen, hasClose) || changed;
      index = end;
    }
  }
}

function fixRun(
  prev: Piece | undefined,
  next: Piece | undefined,
  ch: DelimChar,
  hasOpen: boolean,
  hasClose: boolean,
): boolean {
  const before = sideClass(prev);
  const after = sideClass(next);
  if (hasClose && before === "space") return toEntity(prev);
  if (hasOpen && after === "space") return toEntity(next);
  if (ch === "*") {
    if (hasOpen && after === "punct" && before === "word") return toEntity(prev);
    if (hasClose && before === "punct" && after === "word") return toEntity(next);
    return false;
  }
  if (hasOpen && before === "word") return toEntity(prev);
  if (hasClose && after === "word") return toEntity(next);
  return false;
}

function escapeLineStart(pieces: Piece[]): void {
  const first = pieces[0];
  if (first?.kind === "char" && first.mode === "plain" && LINE_START_ESCAPE.has(first.cp)) {
    first.mode = "escape";
  }
  let digits = 0;
  while (digits < pieces.length) {
    const piece = pieces[digits]!;
    if (piece.kind !== "char" || piece.mode !== "plain" || !/^[0-9]$/.test(piece.cp)) break;
    digits += 1;
  }
  const after = pieces[digits];
  if (
    digits > 0 &&
    digits <= MAX_LIST_NUMBER_DIGITS &&
    after?.kind === "char" &&
    after.mode === "plain" &&
    (after.cp === "." || after.cp === ")")
  ) {
    after.mode = "escape";
  }
}

function encodeEdgeWhitespace(pieces: Piece[]): void {
  for (const piece of [pieces[0], pieces[pieces.length - 1]]) {
    if (piece?.kind === "char" && piece.mode === "plain" && EDGE_TRIMMED.test(piece.cp)) {
      piece.mode = "entity";
    }
  }
}

/** 링크 바로 앞 `!`는 이미지 문법(`![`)이 된다. */
function escapeBangBeforeLink(pieces: Piece[]): void {
  pieces.forEach((piece, index) => {
    const next = pieces[index + 1];
    if (
      piece.kind === "char" &&
      piece.mode === "plain" &&
      piece.cp === "!" &&
      next?.kind === "raw" &&
      next.text.startsWith("[")
    ) {
      piece.mode = "escape";
    }
  });
}

function render(pieces: readonly Piece[]): string {
  return pieces
    .map((piece) => {
      switch (piece.kind) {
        case "raw":
          return piece.text;
        case "delim":
          return piece.ch.repeat(MARK_DELIM[piece.mark]);
        case "char":
          if (piece.mode === "escape") return `\\${piece.cp}`;
          if (piece.mode === "entity") return `&#${piece.cp.codePointAt(0) ?? 0};`;
          return piece.cp;
      }
    })
    .join("");
}

/**
 * 줄이 링크(`[`)로 시작하고 첫 `]`가 코드 스팬 안에 있으며 바로 뒤가 `:`이면, markdown-it은 그 줄을
 * 참조 정의(`[라벨]: 주소`)로 읽는다 — 블록 단계라 코드 스팬을 모른다(rules_block/reference.mjs의
 * 라벨 훑기와 같은 규칙: `\`는 다음 글자를 건너뛰고, `[`가 먼저 나오면 정의가 아니다). 그 코드
 * 스팬의 노드를 돌려준다.
 */
function referenceHazard(pieces: readonly Piece[]): TextNode | undefined {
  const first = pieces[0];
  if (first?.kind !== "raw" || first.text !== "[") return undefined;
  const owners: (Piece | undefined)[] = [];
  const line = pieces
    .map((piece) => {
      const text = render([piece]);
      for (let i = 0; i < text.length; i += 1) owners.push(piece);
      return text;
    })
    .join("");
  for (let pos = 1; pos < line.length; pos += 1) {
    const ch = line[pos];
    if (ch === "[") return undefined;
    if (ch === "\\") {
      pos += 1;
      continue;
    }
    if (ch === "]") {
      const owner = owners[pos];
      return line[pos + 1] === ":" && owner?.kind === "raw" ? owner.code : undefined;
    }
  }
  return undefined;
}

export type InlinePlace = "paragraph" | "heading";

export interface SerializedInline {
  text: string;
  /** 참조 정의로 읽히지 않게 코드 마크를 뺀 텍스트 노드 수(design.md 7번). */
  droppedCodeMarks: number;
}

function buildPieces(
  nodes: readonly TextNode[],
  place: InlinePlace,
  plainCode: ReadonlySet<TextNode>,
): Piece[] {
  const pieces = toPieces(nodes, plainCode);
  encodeEdgeWhitespace(pieces);
  if (place === "paragraph") escapeLineStart(pieces);
  if (place === "heading") {
    const last = pieces[pieces.length - 1];
    if (last?.kind === "char" && last.mode === "plain" && last.cp === "#") last.mode = "escape";
  }
  escapeBangBeforeLink(pieces);
  fixFlanking(pieces);
  return pieces;
}

/**
 * 문단 · 제목 한 줄의 인라인. 문단은 줄 첫 글자 규칙(목록 · 인용 · 지시어 …)과 참조 정의 모양을,
 * 제목은 끝의 `#`(닫는 표지로 읽힌다)을 피한다.
 */
export function serializeInline(nodes: readonly TextNode[], place: InlinePlace): SerializedInline {
  const plainCode = new Set<TextNode>();
  let pieces = buildPieces(nodes, place, plainCode);
  let hazard = place === "paragraph" ? referenceHazard(pieces) : undefined;
  while (hazard !== undefined) {
    plainCode.add(hazard);
    pieces = buildPieces(nodes, place, plainCode);
    hazard = referenceHazard(pieces);
  }
  return { text: render(pieces), droppedCodeMarks: plainCode.size };
}

/** 이미지 alt · 앱 스크린샷 caption — 마크 없는 글자. 줄바꿈만 문자 참조로. */
export function serializePlainLabel(text: string): string {
  return render(charPieces(text));
}
