/**
 * 실패 메시지 세 칸 형식(spec: markdown-validation-message) — 「어디 · 무엇 · 어떻게」.
 *
 * 사람이 보는 문장은 전부 여기 모은다 — check.ts · directives.ts 양쪽에서 만들던 같은 문장(빈 문서 ·
 * 지시어 뒤 블록 없음 · HTML 정의 밖)이 따로 나던 것을 한 곳으로 좁힌다.
 */

export interface FoundMessage {
  /** 정렬 기준 — 원문 줄 번호(1부터), 같은 줄이면 발견 순(안정 정렬에 맡긴다). */
  line: number;
  text: string;
}

export function blockMessage(
  n: number,
  line: number,
  rule: string,
  received: string,
  fix: string,
): FoundMessage {
  return { line, text: `블록 ${n} (${line}줄): ${rule}(받음: "${received}") → ${fix}` };
}

export function docMessage(
  line: number,
  rule: string,
  received: string,
  fix: string,
): FoundMessage {
  return { line, text: `문서 (${line}줄): ${rule}(받음: "${received}") → ${fix}` };
}

/** 줄 번호 순으로 정렬한다 — 같은 줄이면 Array#sort의 안정성에 기대 발견 순을 지킨다(spec). */
export function sortMessages(messages: readonly FoundMessage[]): string[] {
  return [...messages].sort((a, b) => a.line - b.line).map((m) => m.text);
}

// ── 여러 곳에서 만들던 같은 문장 — 한 곳으로 ─────────────────────────────

export function emptyDocumentMessage(): FoundMessage {
  return docMessage(1, "본문이 비어 있다", "", "문단 하나 이상을 쓴다");
}

export function directiveNoBlockMessage(line: number, received: string): FoundMessage {
  return docMessage(
    line,
    "지시어 뒤에 블록이 없다",
    received,
    "지시어 줄을 지우거나 바로 아래에 블록을 쓴다",
  );
}

export function htmlNotAllowedMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(topLevel, line, "HTML 태그는 정의 밖이다", received, "HTML 태그를 지운다");
}

export function internalErrorMessage(reason: string): FoundMessage {
  const oneLine = reason.replace(/\s+/g, " ").trim().slice(0, 200);
  return docMessage(1, "변환 중 내부 오류가 났다", oneLine, "markdown을 확인해 다시 시도한다");
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
