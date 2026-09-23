/**
 * 실패 메시지 세 칸 형식(spec: markdown-validation-message) — 「어디 · 무엇 · 어떻게」.
 * n(블록 순번) · m(원문 줄 번호) · rule(허용 집합) · received(받은 값) · fix(고친 예 또는 할 일).
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
