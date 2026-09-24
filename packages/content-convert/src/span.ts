import {
  FONTS,
  HEX_COLOR_PATTERN,
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  WEIGHTS_BY_FONT,
} from "@blog-editor/content-schema";
import type { TextStyleAttrs } from "@blog-editor/content-schema";
import type { StateInline } from "markdown-it";
import {
  SPAN_DUPLICATE_KEY_FIX,
  SPAN_DUPLICATE_KEY_RULE,
  SPAN_UNDERLINE_VALUE_FIX,
  SPAN_UNDERLINE_VALUE_RULE,
  SPAN_UNKNOWN_KEY_FIX,
  SPAN_WEIGHT_FIX,
  spanUnknownKeyRule,
  spanValueFix,
  spanValueRule,
  spanWeightRule,
} from "./message";
import { SPAN_STYLE_KEYS, SPAN_UNDERLINE_KEY } from "./constants";

/**
 * 괄호 span `[글자]{키=값 … underline}` — 글자 스타일 · 밑줄의 markdown 문법(ADR-020). pandoc ·
 * markdown-it-attrs 계열 모양이지만 새 의존성 없이 markdown-it 인라인 규칙 하나로 둔다.
 *
 * 토큰: `span_open`(meta = 원문 · 검사 결과, 파서는 무시) → `underline_open`? → `textstyle_open`?(meta.attrs)
 * → 라벨 안 토큰 → 닫는 토큰(역순). 값 검사는 여기서 한 번만 하고, check.ts가 `span_open`의 issues를
 * 메시지로, parser.ts가 `textstyle_open`의 attrs를 마크로 쓴다 — 두 단계가 같은 판정을 본다.
 */

export interface SpanIssue {
  rule: string;
  received: string;
  fix: string;
}

export interface ParsedSpan {
  style: TextStyleAttrs | undefined;
  underline: boolean;
  issues: SpanIssue[];
}

export interface SpanOpenMeta {
  body: string;
  issues: SpanIssue[];
}

type StyleKey = (typeof SPAN_STYLE_KEYS)[number];

// 지시어 줄의 PAIR와 같은 모양 + 값 없는 켜기 키. 이 모양이 아니면 span이 아니다(글자로 남는다)
const PAIR = /^[^\s{}=]+=[^\s{}]+$/;
const FLAG = /^[a-z]+$/;
const OPEN_BRACKET = 0x5b;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = "}";

/** 한 줄 안의 `키=값` · 켜기 키만 — 줄을 넘는 `{…}`는 우연한 글자일 가능성이 커서 span으로 보지 않는다. */
function isSpanBody(body: string): boolean {
  if (body.trim() === "" || body.includes("\n")) return false;
  return body
    .trim()
    .split(/\s+/)
    .every((token) => PAIR.test(token) || FLAG.test(token));
}

const ALLOWED_VALUES: Record<Exclude<StyleKey, "color" | "highlight">, readonly string[]> = {
  font: FONTS,
  weight: TEXT_WEIGHTS,
  size: TEXT_SIZES,
};

/** 색은 프리셋 이름 또는 hex — hex는 대소문자를 받고 정규형(소문자)으로 저장한다. */
function colorValue(value: string, presets: readonly string[]): string | undefined {
  const lower = value.toLowerCase();
  if (HEX_COLOR_PATTERN.test(lower)) return lower;
  return presets.includes(value) ? value : undefined;
}

function styleValue(key: StyleKey, value: string): string | undefined {
  if (key === "color") return colorValue(value, TEXT_COLORS);
  if (key === "highlight") return colorValue(value, HIGHLIGHT_COLORS);
  return ALLOWED_VALUES[key].includes(value) ? value : undefined;
}

function isStyleKey(key: string): key is StyleKey {
  return (SPAN_STYLE_KEYS as readonly string[]).includes(key);
}

/** `{…}` 안쪽 → 스타일 · 밑줄 · 문제 목록. 순수 함수 — 파서 두 단계가 같은 결과를 본다. */
export function parseSpanBody(body: string): ParsedSpan {
  const style: Record<string, string> = {};
  const issues: SpanIssue[] = [];
  const seen = new Set<string>();
  let underline = false;

  for (const token of body.trim().split(/\s+/)) {
    const eq = token.indexOf("=");
    const key = eq < 0 ? token : token.slice(0, eq);
    const value = eq < 0 ? undefined : token.slice(eq + 1);
    if (seen.has(key)) {
      issues.push({
        rule: SPAN_DUPLICATE_KEY_RULE,
        received: body.trim(),
        fix: SPAN_DUPLICATE_KEY_FIX,
      });
      continue;
    }
    seen.add(key);
    if (key === SPAN_UNDERLINE_KEY) {
      if (value === undefined) underline = true;
      else
        issues.push({
          rule: SPAN_UNDERLINE_VALUE_RULE,
          received: token,
          fix: SPAN_UNDERLINE_VALUE_FIX,
        });
      continue;
    }
    if (!isStyleKey(key) || value === undefined) {
      issues.push({ rule: spanUnknownKeyRule(), received: key, fix: SPAN_UNKNOWN_KEY_FIX });
      continue;
    }
    const accepted = styleValue(key, value);
    if (accepted === undefined) {
      issues.push({ rule: spanValueRule(key), received: value, fix: spanValueFix(key) });
      continue;
    }
    style[key] = accepted;
  }

  const font = (style.font ?? FONTS[0]) as (typeof FONTS)[number];
  if (
    style.weight !== undefined &&
    !(WEIGHTS_BY_FONT[font] as readonly string[]).includes(style.weight)
  ) {
    issues.push({ rule: spanWeightRule(font), received: style.weight, fix: SPAN_WEIGHT_FIX });
  }

  const hasStyle = Object.keys(style).length > 0;
  return { style: hasStyle ? (style as TextStyleAttrs) : undefined, underline, issues };
}

/**
 * markdown-it 인라인 규칙 — 링크 규칙(rules_inline/link.mjs)과 같은 방식으로 라벨을 찾고
 * (`parseLinkLabel`, 안쪽 링크는 허용), 라벨 범위만 다시 토큰화한다. `push`의 nesting 1/-1이
 * 강조 구분자 범위를 span 안에 가둔다(StateInline.push).
 */
export function bracketSpanRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== OPEN_BRACKET) return false;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, false);
  if (labelEnd < 0) return false;
  const braceStart = labelEnd + 1;
  if (state.src.charCodeAt(braceStart) !== OPEN_BRACE) return false;
  const braceEnd = state.src.indexOf(CLOSE_BRACE, braceStart + 1);
  if (braceEnd < 0 || braceEnd >= state.posMax) return false;
  const body = state.src.slice(braceStart + 1, braceEnd);
  if (!isSpanBody(body)) return false;

  if (!silent) {
    const parsed = parseSpanBody(body);
    const max = state.posMax;
    state.pos = labelStart;
    state.posMax = labelEnd;

    const open = state.push("span_open", "span", 1);
    open.meta = { body, issues: parsed.issues } satisfies SpanOpenMeta;
    if (parsed.underline) state.push("underline_open", "u", 1);
    if (parsed.style !== undefined)
      state.push("textstyle_open", "span", 1).meta = { attrs: parsed.style };
    state.md.inline.tokenize(state);
    if (parsed.style !== undefined) state.push("textstyle_close", "span", -1);
    if (parsed.underline) state.push("underline_close", "u", -1);
    state.push("span_close", "span", -1);

    state.posMax = max;
  }
  state.pos = braceEnd + 1;
  return true;
}
