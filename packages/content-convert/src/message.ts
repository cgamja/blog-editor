/**
 * 실패 메시지 세 칸 형식(spec: markdown-validation-message) — 「어디 · 무엇 · 어떻게」.
 *
 * 사람이 보는 문장은 전부 여기 모은다(CLEAN-CODE §3) — check.ts · directives.ts · convert.ts가
 * 저마다 같은 문장(빈 문서 · 지시어 뒤 블록 없음 · HTML 정의 밖 …)을 따로 손으로 쓰던 것을 한 곳으로
 * 좁힌다. 닫힌 집합(허용 키 · 톤 · 폰트 · 컨테이너 안 허용 블록 …)에서 나오는 문장은 그 집합 자체에서
 * 파생시켜, 집합이 바뀌어도 문장이 따로 놀지 않게 한다.
 */

import {
  ALT_MAX_LENGTH,
  CALLOUT_TONES,
  CAPTION_MAX_LENGTH,
  FONTS,
  MOTIONS,
  WIDTH_RANGE,
} from "@blog-editor/content-schema";
import { ALLOWED_IN, APP_FRAME, CONTAINER_LABEL, KNOWN_KEYS } from "./constants";
import { CALLOUT_CONTAINER_NAME } from "./tokens";
import type { ContainerKind, SemanticType } from "./types";

export interface FoundMessage {
  /** 정렬 기준 — 원문 줄 번호(1부터), 같은 줄이면 발견 순(안정 정렬에 맡긴다). */
  line: number;
  text: string;
}

/** 받은 값이 여러 줄이면 한 줄로 접는다 — 메시지는 항목마다 한 줄이다(markdown-validation-message). */
function toOneLine(value: string): string {
  return value.replace(/\s*\n\s*/g, " ");
}

export function blockMessage(
  n: number,
  line: number,
  rule: string,
  received: string,
  fix: string,
): FoundMessage {
  return { line, text: `블록 ${n} (${line}줄): ${rule}(받음: "${toOneLine(received)}") → ${fix}` };
}

export function docMessage(
  line: number,
  rule: string,
  received: string,
  fix: string,
): FoundMessage {
  return { line, text: `문서 (${line}줄): ${rule}(받음: "${toOneLine(received)}") → ${fix}` };
}

/** 줄 번호 순으로 정렬한다 — 같은 줄이면 Array#sort의 안정성에 기대 발견 순을 지킨다(spec). */
export function sortMessages(messages: readonly FoundMessage[]): string[] {
  return [...messages].sort((a, b) => a.line - b.line).map((m) => m.text);
}

// ── 문서 전체 ────────────────────────────────────────────────────────────

export function emptyDocumentMessage(): FoundMessage {
  return docMessage(1, "본문이 비어 있다", "", "문단 하나 이상을 쓴다");
}

/** internalErrorMessage가 원인 문구를 자르는 길이 — 메시지 한 줄 제약(spec)을 지키는 여유값. */
const INTERNAL_ERROR_MAX_LENGTH = 200;

export function internalErrorMessage(reason: string): FoundMessage {
  const oneLine = reason.replace(/\s+/g, " ").trim().slice(0, INTERNAL_ERROR_MAX_LENGTH);
  return docMessage(1, "변환 중 내부 오류가 났다", oneLine, "markdown을 확인해 다시 시도한다");
}

// ── 구조(check.ts) ──────────────────────────────────────────────────────

/** SemanticType → 사람이 읽는 낱말 — describeAllowedSemantics가 중복 없이 이어붙이는 데 쓴다. */
const SEMANTIC_LABEL: Partial<Record<SemanticType, string>> = {
  paragraph: "문단",
  bulletList: "목록",
  orderedList: "목록",
};

/** ALLOWED_IN[container]에서 "문단만" · "문단 · 목록만" 같은 문장을 파생시킨다(닫힌 집합 기준). */
function describeAllowedSemantics(allowed: ReadonlySet<SemanticType>): string {
  const labels: string[] = [];
  for (const semantic of allowed) {
    const label = SEMANTIC_LABEL[semantic] ?? semantic;
    if (!labels.includes(label)) labels.push(label);
  }
  return `${labels.join(" · ")}만`;
}

export function containerNotAllowedMessage(
  topLevel: number,
  line: number,
  parentKind: ContainerKind,
  received: string,
): FoundMessage {
  const label = CONTAINER_LABEL[parentKind];
  const allowedText = describeAllowedSemantics(ALLOWED_IN[parentKind]);
  return blockMessage(
    topLevel,
    line,
    `${label} 안에는 ${allowedText} 쓴다`,
    received,
    `${label} 밖으로 옮긴다`,
  );
}

export function listItemRepeatedBlockMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "목록 항목은 문단 하나 다음에 안쪽 목록만 온다",
    received,
    "문단 하나로 시작하고 그 아래에 안쪽 목록만 둔다",
  );
}

export function listItemMustStartWithParagraphMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "목록 항목은 문단 하나로 시작한다",
    received,
    "문단 하나로 시작하고 그 아래에 안쪽 목록을 둔다",
  );
}

export function headingLevelMessage(
  topLevel: number,
  line: number,
  received: string,
  suggestedText: string,
): FoundMessage {
  return blockMessage(topLevel, line, "제목은 ##·###만 쓴다", received, `"## ${suggestedText}"`);
}

export function orderedListStartMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "순서 목록은 1부터 시작한다",
    received,
    "번호를 1부터 다시 매긴다",
  );
}

export function codeLanguageMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "코드 언어는 소문자로 시작하는 소문자 · 숫자 · +#.만 쓴다(-는 안 된다)",
    received,
    "ts",
  );
}

export function tableNotAllowedMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "표는 정의 밖이다",
    received,
    "표 대신 목록이나 문단으로 쓴다",
  );
}

export function htmlNotAllowedMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(topLevel, line, "HTML 태그는 정의 밖이다", received, "HTML 태그를 지운다");
}

export function calloutContainerNameMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `컨테이너는 :::${CALLOUT_CONTAINER_NAME}만 쓴다`,
    received,
    `:::${CALLOUT_CONTAINER_NAME}`,
  );
}

export function calloutNotClosedMessage(line: number, received: string): FoundMessage {
  return docMessage(line, "콜아웃이 닫히지 않았다", received, '끝에 ":::" 줄 추가');
}

export function calloutEmptyMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "콜아웃 안에는 내용이 있어야 한다",
    received,
    "문단이나 목록을 하나 이상 쓴다",
  );
}

export function calloutToneMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `콜아웃 tone은 ${CALLOUT_TONES.join(" · ")}만 쓴다`,
    received,
    ":::callout tone=tip",
  );
}

export function hardBreakMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "줄 끝 공백 둘이나 \\로 강제 줄바꿈은 쓸 수 없다",
    received,
    "문단을 그대로 잇거나(공백 하나) 새 문단으로 나눈다",
  );
}

export function strikethroughMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(topLevel, line, "취소선(~~)은 정의 밖이다", received, "취소선을 지운다");
}

export function footnoteDefinitionMessage(line: number, received: string): FoundMessage {
  return docMessage(line, "각주는 정의 밖이다", received, "각주 없이 문단으로 쓴다");
}

export function footnoteInlineMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(topLevel, line, "각주는 정의 밖이다", received, "각주 없이 글로 쓴다");
}

export function taskListMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "할 일 목록은 정의 밖이다",
    received,
    "대괄호 없이 일반 목록으로 쓴다",
  );
}

export function emptyLinkTextMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(topLevel, line, "링크 글자는 비울 수 없다", received, '"[글자](주소)"');
}

export function linkTitleMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(topLevel, line, "링크의 title은 쓸 수 없다", received, "title을 지운다");
}

export function linkSchemeMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "링크는 http(s) · mailto · 내부 경로만",
    received,
    '"[글자](https://example.com)"',
  );
}

export function imageTitleMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(topLevel, line, "이미지의 title은 쓸 수 없다", received, "title을 지운다");
}

export function imagePathMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "이미지는 /images/<이름>.<확장자> 경로만",
    received,
    '이미지 줄을 지우고 사람에게 업로드를 요청한다. 이미 올린 "/images/…" 경로만 쓸 수 있다',
  );
}

export function imageAltLengthMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `대체 글자는 ${ALT_MAX_LENGTH}자 이내로 쓴다`,
    received,
    "대체 글자를 줄인다",
  );
}

/** "이미지는 최상위 블록에서만 쓴다" — 제목 안 · 인용/목록/콜아웃 안 두 자리가 같은 규칙 문장을
 * 쓰므로 한 곳에 둔다(리뷰 2026-09-23: 같은 문장을 두 번 손으로 쓰지 않는다). */
const IMAGE_TOP_LEVEL_ONLY_RULE = "이미지는 최상위 블록에서만 쓴다";

export function imageInHeadingMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    IMAGE_TOP_LEVEL_ONLY_RULE,
    received,
    "이미지만 있는 문단으로 따로 쓴다(제목 밖으로 옮긴다)",
  );
}

export function imageInContainerMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    IMAGE_TOP_LEVEL_ONLY_RULE,
    received,
    "인용 · 목록 · 콜아웃 밖으로 옮긴다",
  );
}

export function imageMixedWithTextMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "이미지는 글자와 섞을 수 없다",
    received,
    "이미지만 있는 문단으로 따로 쓴다",
  );
}

// ── 지시어(directives.ts) ───────────────────────────────────────────────

export function directiveNoBlockMessage(line: number, received: string): FoundMessage {
  return docMessage(
    line,
    "지시어 뒤에 블록이 없다",
    received,
    "지시어 줄을 지우거나 바로 아래에 블록을 쓴다",
  );
}

export function directiveNestedMessage(line: number, received: string): FoundMessage {
  return docMessage(
    line,
    "지시어는 최상위 블록에서만 쓴다",
    received,
    "들여쓰기나 인용 부호(>)를 지우고 최상위로 옮긴다",
  );
}

export function directiveRepeatedMessage(line: number, received: string): FoundMessage {
  return docMessage(line, "지시어를 연달아 쓸 수 없다", received, "지시어 한 줄로 합친다");
}

export function directiveInContainerMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "인용 · 목록 · 콜아웃 안에는 지시어를 쓸 수 없다",
    received,
    "최상위 블록 앞으로 옮긴다",
  );
}

export const DIRECTIVE_DUPLICATE_KEY_RULE = "같은 키를 두 번 쓸 수 없다";
export const DIRECTIVE_DUPLICATE_KEY_FIX = "키마다 한 번만 쓴다";

/** 지시어 키 전체 집합(KNOWN_KEYS)에서 파생시킨다 — frame은 앱 스크린샷 전용이라 따로 적는다. */
export function directiveUnknownKeyRule(): string {
  const keys = [...KNOWN_KEYS].filter((key) => key !== "frame").join(" · ");
  return `지시어 키는 ${keys}(앱 스크린샷은 frame)만 쓴다`;
}
export const DIRECTIVE_UNKNOWN_KEY_FIX = "font=jua motion=fade-up width=60 중에서 쓴다";

export function directiveKeyNotAllowedRule(key: string): string {
  return `이 블록에는 "${key}"를 쓸 수 없다`;
}
export const DIRECTIVE_KEY_NOT_ALLOWED_FIX = "이 블록에 맞는 키만 쓴다";

export const DIRECTIVE_FRAME_REQUIRES_IMAGE_RULE = "frame=app 뒤에는 이미지가 와야 한다";
export const DIRECTIVE_FRAME_REQUIRES_IMAGE_FIX = "바로 다음 줄에 이미지를 쓴다";

export function directiveFontValueRule(): string {
  return `font는 ${FONTS.join(" · ")}만 쓴다`;
}
export const DIRECTIVE_FONT_VALUE_FIX: string = FONTS[0];

export function directiveMotionValueRule(): string {
  return `motion은 ${MOTIONS.join(" · ")}만 쓴다`;
}
export const DIRECTIVE_MOTION_VALUE_FIX: string = MOTIONS[0];

export function directiveWidthValueRule(): string {
  return `width는 %없는 정수 ${WIDTH_RANGE.min}~${WIDTH_RANGE.max}만 쓴다`;
}
export const DIRECTIVE_WIDTH_VALUE_FIX = "60";

export const DIRECTIVE_FRAME_VALUE_RULE = "frame 값은 app만 쓴다";
export const DIRECTIVE_FRAME_VALUE_FIX = APP_FRAME;

export function directiveCaptionLengthRule(): string {
  return `캡션은 ${CAPTION_MAX_LENGTH}자 이내로 쓴다`;
}
export const DIRECTIVE_CAPTION_LENGTH_FIX = "캡션을 줄인다";

// ── 참조 정의(references.ts) ────────────────────────────────────────────

export function unusedReferenceMessage(line: number, received: string): FoundMessage {
  return docMessage(
    line,
    "쓰는 곳이 없는 링크 참조 정의는 정의 밖이다",
    received,
    "쓰는 곳이 없으면 정의 줄을 지우거나 [글](주소) 인라인 링크로 쓴다",
  );
}

export function referenceTitleMessage(line: number, received: string): FoundMessage {
  return docMessage(line, "링크 참조 정의의 title은 쓸 수 없다", received, "title을 지운다");
}

export function duplicateReferenceLabelMessage(line: number, received: string): FoundMessage {
  return docMessage(
    line,
    "같은 라벨을 두 번 정의할 수 없다",
    received,
    "라벨마다 한 번만 정의한다",
  );
}
