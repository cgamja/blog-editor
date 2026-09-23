import { CAPTION_MAX_LENGTH, FONTS, MOTIONS, WIDTH_RANGE } from "@blog-editor/content-schema";
import { KEY_ALLOW, KNOWN_KEYS } from "./constants";
import {
  blockMessage,
  directiveNoBlockMessage,
  docMessage,
  footnoteDefinitionMessage,
  type FoundMessage,
} from "./message";
import type { BlockRecord, DirectiveCandidate, ResolvedDirective, SemanticType } from "./types";

const CLEAN_LINE = /^\{([^{}]+)\}[ \t]*$/;
const PREFIXED_LINE = /^(?:[ \t]+|(?:>[ \t]?)+)\{([^{}]+)\}[ \t]*$/;
const PAIR = /^[^\s{}=]+=[^\s{}]+$/;
const FOOTNOTE_DEFINITION_LINE = /^ {0,3}\[\^([^\]]+)\]:/;

function isDirectiveBody(body: string): boolean {
  const tokens = body.trim().split(/\s+/);
  return tokens.length > 0 && tokens.every((t) => PAIR.test(t));
}

/**
 * 여는 펜스인가 — CommonMark 규칙: 백틱 펜스는 정보 문자열에 백틱이 있으면 펜스를 열지 않는다
 * (물결표 펜스는 백틱을 가져도 된다).
 */
function parseFenceOpen(line: string): { char: string; len: number } | null {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return null;
  const marker = match[1]!;
  const info = match[2]!;
  const char = marker[0]!;
  if (char === "`" && info.includes("`")) return null;
  return { char, len: marker.length };
}

/** 닫는 펜스인가 — 같은 글자, 길이가 여는 펜스 이상, 뒤에 정보 문자열이 없다(공백만 허용). */
function isFenceClose(line: string, fence: { char: string; len: number }): boolean {
  const closeRe = fence.char === "`" ? /^ {0,3}(`{3,})[ \t]*$/ : /^ {0,3}(~{3,})[ \t]*$/;
  const match = closeRe.exec(line);
  return match !== null && match[1]!.length >= fence.len;
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
 * markdown-format). 코드 펜스 안(``` · ~~~)의 `{…}` · `[^…]:` 모양 줄은 그냥 코드 글자로 남겨야
 * 하므로 펜스 상태를 같이 추적한다. 각주 정의를 여기서 지우는 이유는 하나 — markdown-it이 그걸
 * 링크 참조 정의로 흡수해 `[^1]`이 진짜 링크가 되면(스파이크에서 확인) 더는 각주로 못 잡는다.
 */
export function stripDirectiveLines(markdown: string): StripResult {
  const lines = markdown.split("\n");
  const candidates: DirectiveCandidate[] = [];
  const footnoteMessages: FoundMessage[] = [];
  let fence: { char: string; len: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (fence) {
      if (isFenceClose(line, fence)) fence = null;
      continue;
    }
    const opened = parseFenceOpen(line);
    if (opened) {
      fence = opened;
      continue;
    }

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
        rule: "같은 키를 두 번 쓸 수 없다",
        received: pairsText,
        fix: "키마다 한 번만 쓴다",
      });
      continue;
    }
    seenKeys.add(key);

    if (!KNOWN_KEYS.has(key)) {
      issues.push({
        rule: "지시어 키는 font · motion · width(앱 스크린샷은 frame)만 쓴다",
        received: key,
        fix: "font=jua motion=fade-up width=60 중에서 쓴다",
      });
      continue;
    }
    if (key !== "frame" && !KEY_ALLOW[target].has(key)) {
      issues.push({
        rule: `이 블록에는 "${key}"를 쓸 수 없다`,
        received: key,
        fix: "이 블록에 맞는 키만 쓴다",
      });
      continue;
    }
    if (key === "frame" && target !== "image") {
      issues.push({
        rule: "frame=app 뒤에는 이미지가 와야 한다",
        received: value,
        fix: "바로 다음 줄에 이미지를 쓴다",
      });
      continue;
    }

    switch (key) {
      case "font":
        if (!(FONTS as readonly string[]).includes(value)) {
          issues.push({
            rule: `font는 ${FONTS.join(" · ")}만 쓴다`,
            received: value,
            fix: FONTS[0],
          });
        } else {
          resolved.font = value as (typeof FONTS)[number];
        }
        break;
      case "motion":
        if (!(MOTIONS as readonly string[]).includes(value)) {
          issues.push({
            rule: `motion은 ${MOTIONS.join(" · ")}만 쓴다`,
            received: value,
            fix: MOTIONS[0],
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
            rule: `width는 %없는 정수 ${WIDTH_RANGE.min}~${WIDTH_RANGE.max}만 쓴다`,
            received: value,
            fix: "60",
          });
        } else {
          resolved.width = n;
        }
        break;
      }
      case "frame":
        if (value !== "app") {
          issues.push({ rule: "frame 값은 app만 쓴다", received: value, fix: "app" });
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

/** frame=app으로 정해진 지시어의 캡션(이미지 alt)이 길이 제한을 넘는지 검사해 issues에 보탠다. */
function checkAppScreenshotCaption(
  resolved: ResolvedDirective,
  target: BlockRecord,
  issues: DirectiveIssue[],
): void {
  if (!resolved.isAppScreenshot || target.imageAlt === undefined) return;
  if (target.imageAlt.length <= CAPTION_MAX_LENGTH) return;
  issues.push({
    rule: `캡션은 ${CAPTION_MAX_LENGTH}자 이내로 쓴다`,
    received: target.imageAlt,
    fix: "캡션을 줄인다",
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
      messages.push(
        docMessage(
          line,
          "지시어는 최상위 블록에서만 쓴다",
          candidate.raw,
          "들여쓰기나 인용 부호(>)를 지우고 최상위로 옮긴다",
        ),
      );
      continue;
    }

    const nextLineIndex0 = candidate.lineIndex0 + 1;
    const nextLine = sourceLines[nextLineIndex0];
    if (nextLine === undefined || nextLine.trim() === "") {
      messages.push(directiveNoBlockMessage(line, candidate.raw));
      continue;
    }
    if (candidateLines.has(nextLineIndex0)) {
      messages.push(
        docMessage(line, "지시어를 연달아 쓸 수 없다", candidate.raw, "지시어 한 줄로 합친다"),
      );
      continue;
    }

    const target = registry.find((r) => r.mapStart0 === nextLineIndex0);
    if (!target) {
      messages.push(directiveNoBlockMessage(line, candidate.raw));
      continue;
    }
    if (target.container !== "top") {
      messages.push(
        blockMessage(
          target.topLevel,
          line,
          "인용 · 목록 · 콜아웃 안에는 지시어를 쓸 수 없다",
          candidate.raw,
          "최상위 블록 앞으로 옮긴다",
        ),
      );
      continue;
    }

    const { resolved, issues } = validateDirective(candidate.pairsText, target.semantic);
    checkAppScreenshotCaption(resolved, target, issues);
    if (issues.length > 0) {
      for (const issue of issues) {
        messages.push(blockMessage(target.topLevel, line, issue.rule, issue.received, issue.fix));
      }
      continue;
    }
    resolvedByMapStart.set(target.mapStart0, resolved);
  }

  return { resolvedByMapStart, messages };
}
