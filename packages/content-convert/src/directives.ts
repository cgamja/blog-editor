import {
  ALIGNS,
  CAPTION_MAX_LENGTH,
  FONTS,
  MOTIONS,
  NATURAL_SIZE_RANGE,
  WIDTH_RANGE,
} from "@blog-editor/content-schema";
import { APP_FRAME, KNOWN_KEYS, SIZE_SEPARATOR } from "./constants";
import { computeFenceMask } from "./fence";
import {
  blockMessage,
  DIRECTIVE_ALIGN_VALUE_FIX,
  directiveAlignValueRule,
  DIRECTIVE_CAPTION_LENGTH_FIX,
  DIRECTIVE_DUPLICATE_KEY_FIX,
  DIRECTIVE_DUPLICATE_KEY_RULE,
  DIRECTIVE_FRAME_REQUIRES_IMAGE_FIX,
  DIRECTIVE_FRAME_REQUIRES_IMAGE_RULE,
  DIRECTIVE_FRAME_VALUE_FIX,
  DIRECTIVE_FRAME_VALUE_RULE,
  DIRECTIVE_KEY_NOT_ALLOWED_FIX,
  DIRECTIVE_MOTION_VALUE_FIX,
  DIRECTIVE_UNKNOWN_KEY_FIX,
  DIRECTIVE_WIDTH_VALUE_FIX,
  DIRECTIVE_SIZE_VALUE_FIX,
  DIRECTIVE_FONT_VALUE_FIX,
  directiveCaptionLengthRule,
  directiveFontValueRule,
  directiveInContainerMessage,
  directiveKeyNotAllowedRule,
  directiveMotionValueRule,
  directiveNestedMessage,
  directiveNoBlockMessage,
  directiveRepeatedMessage,
  directiveUnknownKeyRule,
  directiveWidthValueRule,
  directiveSizeValueRule,
  footnoteDefinitionMessage,
  type FoundMessage,
} from "./message";
import type { BlockRecord, ResolvedDirective, SemanticType } from "./types";

/** 지시어 줄 한 개(check 전) — directives.ts만 쓴다(사용 범위가 이 파일뿐이라 여기 둔다). */
export interface DirectiveCandidate {
  /** 0-based, 지시어 줄 자신의 원문 줄 번호. */
  lineIndex0: number;
  /** 메시지의 "받음"에 쓰는 원문(트림). */
  raw: string;
  /** 앞에 공백(목록 들여쓰기)·`>`(인용)가 붙어 있었다 — 최상위가 아니라 그 자체로 거부. */
  nested: boolean;
  /** `{` `}` 안쪽 글자, 예: "font=jua motion=fade-up". */
  pairsText: string;
}

/** 블록 의미별로 허용하는 지시어 키(frame은 image에서 따로 검사한다) — directives.ts만 쓴다. */
const KEY_ALLOW: Record<SemanticType, ReadonlySet<string>> = {
  paragraph: new Set(["font", "motion", "align"]),
  heading: new Set(["font", "motion", "align"]),
  bulletList: new Set(["font", "motion"]),
  orderedList: new Set(["font", "motion"]),
  blockquote: new Set(["font", "motion"]),
  callout: new Set(["font", "motion"]),
  codeBlock: new Set(["motion"]),
  horizontalRule: new Set(["motion"]),
  image: new Set(["motion", "width", "size", "frame", "align"]),
};

const CLEAN_LINE = /^\{([^{}]+)\}[ \t]*$/;
// CLEAN_LINE을 먼저 보므로 여기 걸리는 줄은 늘 접두사가 있다. `>` 앞 공백 · 뒤 여러 칸도 CommonMark 인용이다.
const PREFIXED_LINE = /^(?:[ \t]*>)*[ \t]*\{([^{}]+)\}[ \t]*$/;
const PAIR = /^[^\s{}=]+=[^\s{}]+$/;
// 범위는 NATURAL_SIZE_RANGE 한 곳에서 본다 — 정규식에 상한을 박으면 상수와 어긋난다
const SIZE_VALUE = new RegExp(`^([1-9]\\d*)${SIZE_SEPARATOR}([1-9]\\d*)$`);
const FOOTNOTE_DEFINITION_LINE = /^ {0,3}\[\^([^\]]+)\]:/;

function isNaturalSize(n: number): boolean {
  return n >= NATURAL_SIZE_RANGE.min && n <= NATURAL_SIZE_RANGE.max;
}

/**
 * 알려진 키의 `키=`(빈 값)도 지시어로 받는다 — 문단으로 흘려보내면 값 오류 메시지 없이 `{width=}`가
 * 본문 글자로 남는다(MCP에서 AI가 고칠 단서가 없다). 모르는 키의 빈 값은 우연한 글자일 수 있어 그대로 둔다.
 */
function isDirectiveToken(token: string): boolean {
  if (PAIR.test(token)) return true;
  return token.endsWith("=") && KNOWN_KEYS.has(token.slice(0, -1));
}

function isDirectiveBody(body: string): boolean {
  const tokens = body.trim().split(/\s+/);
  return tokens.length > 0 && tokens.every(isDirectiveToken);
}

export interface StripResult {
  strippedText: string;
  /** 지시어 · 각주 정의 줄이 빈 줄로 바뀐(줄 번호는 그대로인) 줄 배열 — 토큰화와 이후 메시지 조회가 이걸 쓴다. */
  lines: string[];
  candidates: DirectiveCandidate[];
  /** 걷어낸 각주 정의(`[^label]: …`) 줄 — 각주는 정의 밖이라 여기서 바로 거부 메시지가 된다. */
  footnoteMessages: FoundMessage[];
}

/**
 * 지시어 줄과 각주 정의 줄을 markdown 파싱보다 앞서 줄 단위로 걷어낸다(spec: markdown-directive ·
 * markdown-format). 코드 펜스 안(``` · ~~~, fence.ts 공유)과 들여쓴 코드 블록(빈 줄 뒤 4칸 이상 ·
 * 그 코드가 이어지는 줄) 안의 `{…}` · `[^…]:` 모양 줄은 그냥 코드 글자로 남겨야 하므로 둘 다
 * 추적한다. 각주 정의를 여기서 지우는 이유는 하나 — markdown-it이 그걸 링크 참조 정의로 흡수해
 * `[^1]`이 진짜 링크가 되면(스파이크에서 확인) 더는 각주로 못 잡는다.
 */
export function stripDirectiveLines(markdown: string): StripResult {
  const lines = markdown.split("\n");
  const candidates: DirectiveCandidate[] = [];
  const footnoteMessages: FoundMessage[] = [];
  const fenceMask = computeFenceMask(lines);
  let prevBlank = true;
  let prevIndentedCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isBlank = line.trim() === "";
    const isIndentedCode: boolean =
      !isBlank && !fenceMask[i] && /^ {4,}/.test(line) && (prevBlank || prevIndentedCode);
    prevBlank = isBlank;
    prevIndentedCode = isIndentedCode;

    if (fenceMask[i]) continue;
    if (isIndentedCode) continue;

    const footnote = FOOTNOTE_DEFINITION_LINE.exec(line);
    if (footnote) {
      footnoteMessages.push(footnoteDefinitionMessage(i + 1, line.trim()));
      lines[i] = "";
      continue;
    }

    const clean = CLEAN_LINE.exec(line);
    if (clean && isDirectiveBody(clean[1]!)) {
      candidates.push({ lineIndex0: i, raw: line.trim(), nested: false, pairsText: clean[1]! });
      lines[i] = "";
      continue;
    }
    const prefixed = PREFIXED_LINE.exec(line);
    if (prefixed && isDirectiveBody(prefixed[1]!)) {
      candidates.push({ lineIndex0: i, raw: line.trim(), nested: true, pairsText: prefixed[1]! });
      lines[i] = "";
    }
  }

  return { strippedText: lines.join("\n"), lines, candidates, footnoteMessages };
}

interface DirectiveIssue {
  rule: string;
  received: string;
  fix: string;
}

function validateDirective(
  pairsText: string,
  target: SemanticType,
): { resolved: ResolvedDirective; issues: DirectiveIssue[] } {
  const pairs = pairsText
    .trim()
    .split(/\s+/)
    .map((token) => {
      const eq = token.indexOf("=");
      return { key: token.slice(0, eq), value: token.slice(eq + 1) };
    });

  const issues: DirectiveIssue[] = [];
  const seenKeys = new Set<string>();
  const resolved: ResolvedDirective = {};

  for (const { key, value } of pairs) {
    if (seenKeys.has(key)) {
      issues.push({
        rule: DIRECTIVE_DUPLICATE_KEY_RULE,
        received: pairsText,
        fix: DIRECTIVE_DUPLICATE_KEY_FIX,
      });
      continue;
    }
    seenKeys.add(key);

    if (!KNOWN_KEYS.has(key)) {
      issues.push({
        rule: directiveUnknownKeyRule(),
        received: key,
        fix: DIRECTIVE_UNKNOWN_KEY_FIX,
      });
      continue;
    }
    if (key !== "frame" && !KEY_ALLOW[target].has(key)) {
      issues.push({
        rule: directiveKeyNotAllowedRule(key),
        received: key,
        fix: DIRECTIVE_KEY_NOT_ALLOWED_FIX,
      });
      continue;
    }
    if (key === "frame" && target !== "image") {
      issues.push({
        rule: DIRECTIVE_FRAME_REQUIRES_IMAGE_RULE,
        received: value,
        fix: DIRECTIVE_FRAME_REQUIRES_IMAGE_FIX,
      });
      continue;
    }

    switch (key) {
      case "font":
        if (!(FONTS as readonly string[]).includes(value)) {
          issues.push({
            rule: directiveFontValueRule(),
            received: value,
            fix: DIRECTIVE_FONT_VALUE_FIX,
          });
        } else {
          resolved.font = value as (typeof FONTS)[number];
        }
        break;
      case "motion":
        if (!(MOTIONS as readonly string[]).includes(value)) {
          issues.push({
            rule: directiveMotionValueRule(),
            received: value,
            fix: DIRECTIVE_MOTION_VALUE_FIX,
          });
        } else {
          resolved.motion = value as (typeof MOTIONS)[number];
        }
        break;
      case "width": {
        const isPlainInt = /^\d+$/.test(value);
        const n = isPlainInt ? Number(value) : NaN;
        if (!isPlainInt || n < WIDTH_RANGE.min || n > WIDTH_RANGE.max) {
          issues.push({
            rule: directiveWidthValueRule(),
            received: value,
            fix: DIRECTIVE_WIDTH_VALUE_FIX,
          });
        } else {
          resolved.width = n;
        }
        break;
      }
      case "size": {
        const match = SIZE_VALUE.exec(value);
        const w = Number(match?.[1]);
        const h = Number(match?.[2]);
        const isValidSize = match !== null && isNaturalSize(w) && isNaturalSize(h);
        if (!isValidSize) {
          issues.push({
            rule: directiveSizeValueRule(),
            received: value,
            fix: DIRECTIVE_SIZE_VALUE_FIX,
          });
        } else {
          resolved.naturalWidth = w;
          resolved.naturalHeight = h;
        }
        break;
      }
      case "align":
        if (!(ALIGNS as readonly string[]).includes(value)) {
          issues.push({
            rule: directiveAlignValueRule(),
            received: value,
            fix: DIRECTIVE_ALIGN_VALUE_FIX,
          });
        } else {
          resolved.align = value as (typeof ALIGNS)[number];
        }
        break;
      case "frame":
        if (value !== APP_FRAME) {
          issues.push({
            rule: DIRECTIVE_FRAME_VALUE_RULE,
            received: value,
            fix: DIRECTIVE_FRAME_VALUE_FIX,
          });
        } else {
          resolved.isAppScreenshot = true;
        }
        break;
      default:
        break;
    }
  }

  return { resolved, issues };
}

function checkAppScreenshotCaption(
  resolved: ResolvedDirective,
  target: BlockRecord,
  issues: DirectiveIssue[],
): void {
  if (!resolved.isAppScreenshot || target.imageAlt === undefined) return;
  if (target.imageAlt.length <= CAPTION_MAX_LENGTH) return;
  issues.push({
    rule: directiveCaptionLengthRule(),
    received: target.imageAlt,
    fix: DIRECTIVE_CAPTION_LENGTH_FIX,
  });
}

export interface ResolveOutcome {
  resolvedByMapStart: Map<number, ResolvedDirective>;
  messages: FoundMessage[];
}

/**
 * 각 지시어 후보를 "바로 다음 줄에서 시작하는 블록"에 귀속한다(spec: markdown-directive). 자리 밖 ·
 * 떨어짐 · 연속 · 값 오류를 여기서 전부 걸러 resolved에는 유효한 지시어만 남긴다.
 */
export function resolveDirectives(
  candidates: readonly DirectiveCandidate[],
  sourceLines: readonly string[],
  registry: readonly BlockRecord[],
): ResolveOutcome {
  const resolvedByMapStart = new Map<number, ResolvedDirective>();
  const messages: FoundMessage[] = [];
  const candidateLines = new Set(candidates.map((c) => c.lineIndex0));

  for (const candidate of candidates) {
    const line = candidate.lineIndex0 + 1;

    if (candidate.nested) {
      messages.push(directiveNestedMessage(line, candidate.raw));
      continue;
    }

    const nextLineIndex0 = candidate.lineIndex0 + 1;
    const nextLine = sourceLines[nextLineIndex0];
    if (nextLine === undefined || nextLine.trim() === "") {
      messages.push(directiveNoBlockMessage(line, candidate.raw));
      continue;
    }
    if (candidateLines.has(nextLineIndex0)) {
      messages.push(directiveRepeatedMessage(line, candidate.raw));
      continue;
    }

    const target = registry.find((r) => r.mapStart0 === nextLineIndex0);
    if (!target) {
      messages.push(directiveNoBlockMessage(line, candidate.raw));
      continue;
    }
    if (target.container !== "top") {
      messages.push(directiveInContainerMessage(target.topLevel, line, candidate.raw));
      continue;
    }

    const { resolved, issues } = validateDirective(candidate.pairsText, target.semantic);
    checkAppScreenshotCaption(resolved, target, issues);
    if (issues.length > 0) {
      for (const issue of issues) {
        messages.push(blockMessageFromIssue(target.topLevel, line, issue));
      }
      continue;
    }
    resolvedByMapStart.set(target.mapStart0, resolved);
  }

  return { resolvedByMapStart, messages };
}

/** validateDirective가 모은 issue(rule/received/fix)를 최종 FoundMessage로 조립한다. */
function blockMessageFromIssue(
  topLevel: number,
  line: number,
  issue: DirectiveIssue,
): FoundMessage {
  return blockMessage(topLevel, line, issue.rule, issue.received, issue.fix);
}
