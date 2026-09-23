import { FONTS, MOTIONS, WIDTH_RANGE } from "@blog-editor/content-schema";
import { blockMessage, docMessage, type FoundMessage } from "./message";
import type { BlockRecord, SemanticType } from "./types";

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

export interface ResolvedDirective {
  font?: (typeof FONTS)[number];
  motion?: (typeof MOTIONS)[number];
  width?: number;
  isAppScreenshot?: boolean;
}

const CLEAN_LINE = /^\{([^{}]+)\}[ \t]*$/;
const PREFIXED_LINE = /^(?:[ \t]+|(?:>[ \t]?)+)\{([^{}]+)\}[ \t]*$/;
const PAIR = /^[^\s{}=]+=[^\s{}]+$/;

function isDirectiveBody(body: string): boolean {
  const tokens = body.trim().split(/\s+/);
  return tokens.length > 0 && tokens.every((t) => PAIR.test(t));
}

function isFenceMarker(line: string): { char: string; len: number } | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return null;
  const marker = match[1]!;
  return { char: marker[0]!, len: marker.length };
}

export interface StripResult {
  strippedText: string;
  /** 지시어 줄이 빈 줄로 바뀐(줄 번호는 그대로인) 줄 배열 — 토큰화와 이후 메시지 조회가 이걸 쓴다. */
  lines: string[];
  candidates: DirectiveCandidate[];
}

/**
 * 지시어 줄을 markdown 파싱보다 앞서 줄 단위로 걷어낸다(spec: markdown-directive). 코드 펜스
 * 안(``` · ~~~)의 `{…}` 모양 줄은 그냥 코드 글자로 남겨야 하므로 펜스 상태를 같이 추적한다.
 */
export function stripDirectiveLines(markdown: string): StripResult {
  const lines = markdown.split("\n");
  const candidates: DirectiveCandidate[] = [];
  let fence: { char: string; len: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const marker = isFenceMarker(line);

    if (fence) {
      if (marker && marker.char === fence.char && marker.len >= fence.len) fence = null;
      continue;
    }
    if (marker) {
      fence = marker;
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

  return { strippedText: lines.join("\n"), lines, candidates };
}

const KNOWN_KEYS = new Set(["font", "motion", "width", "frame"]);
const KEY_ALLOW: Record<SemanticType, ReadonlySet<string>> = {
  paragraph: new Set(["font", "motion"]),
  heading: new Set(["font", "motion"]),
  bulletList: new Set(["font", "motion"]),
  orderedList: new Set(["font", "motion"]),
  blockquote: new Set(["font", "motion"]),
  callout: new Set(["font", "motion"]),
  codeBlock: new Set(["motion"]),
  horizontalRule: new Set(["motion"]),
  image: new Set(["motion", "width", "frame"]),
};

interface DirectiveIssue {
  rule: string;
  received: string;
  fix: string;
}

/** `{key=value ...}`의 안쪽 글자를 target(귀속된 블록의 의미) 기준으로 검증한다. */
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
      messages.push(
        docMessage(
          line,
          "지시어 뒤에 블록이 없다",
          candidate.raw,
          "지시어 줄을 지우거나 바로 아래에 블록을 쓴다",
        ),
      );
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
      messages.push(
        docMessage(
          line,
          "지시어 뒤에 블록이 없다",
          candidate.raw,
          "지시어 줄을 지우거나 바로 아래에 블록을 쓴다",
        ),
      );
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
