/**
 * 범위 고치기(editDocRange) 실패 문장 — 받는 쪽은 AI다. 무엇이 틀렸는지와 다음에 어떻게 집으면 되는지를
 * 같이 적어 AI가 스스로 고치게 한다(adr-007 · adr-031).
 */

export function selectionEmptyMessage(): string {
  return "범위가 비었다 — '시작 글...끝 글'이나 바꿀 글자 그대로를 준다";
}

/** @param hasEllipsis 범위에 `...`나 `…`가 있었는가 — 있었으면 그것이 글자일 수 있다고 알린다 */
export function selectionNotFoundMessage(selection: string, hasEllipsis: boolean): string {
  const base = `범위를 찾지 못했다(받음: "${selection}") — get_post의 글에 보이는 글자 그대로, 마크다운 기호 없이(** · [글]{…} 빼고) 집는다. 길면 '시작 글...끝 글'로 앞뒤 몇 글자만 준다`;
  return hasEllipsis
    ? `${base}. 범위에 ...나 …가 글자로 들어 있다면 ...가 없는 부분으로 고른다`
    : base;
}

/** @param count 찾은 곳 전체 수 — `places`는 그중 보여 줄 앞쪽 몇 곳이다 */
export function selectionAmbiguousMessage(
  selection: string,
  count: number,
  places: readonly string[],
): string {
  return `범위가 ${count}곳에 있다(받음: "${selection}") — 더 긴 글로 한 곳만 집는다:\n${places.map((place) => `- ${place}`).join("\n")}`;
}

/** 여러 곳을 알릴 때 한 곳의 모습 — 블록 번호는 1부터(형식 가이드의 '블록 n'과 같다) */
export function selectionPlace(blockNumber: number, around: string): string {
  return `블록 ${blockNumber}: "…${around}…"`;
}

/** @param isInOneCodeBlock 범위가 코드 블록 하나 안인가 — 글자만 바꾸는 방법이 문단과 다르다 */
export function selectionPartialBlockMessage(isInOneCodeBlock: boolean): string {
  const textOnly = isInOneCodeBlock
    ? "글자만 바꾸려면 펜스 없이 새 글만 보낸다"
    : "글자만 바꾸려면 꾸밈 줄 없이 문단 하나로 보낸다";
  return `선택이 블록 일부만 덮는다 — 블록을 바꾸려면 블록(목록 · 인용 · 콜아웃 · 표 · 코드 블록이면 그 전체)의 처음부터 끝까지 고르고, ${textOnly}`;
}

export function insertEmptyMessage(): string {
  return "넣을 markdown이 비었다 — 넣을 블록을 준다";
}

export function documentWouldBeEmptyMessage(): string {
  return "고치면 본문이 비게 된다 — 글에는 블록이 하나 이상 있어야 한다";
}
