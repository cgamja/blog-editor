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

/**
 * @param count 찾은 곳 전체 수 — `places`는 그중 보여 줄 앞쪽 몇 곳이다
 * @param wholeBlockNumbers 블록 글자 전체와 같은 곳의 블록 번호(1부터) — 비면 그 줄을 쓰지 않는다(#158 · adr-038)
 * @param isDeletion 지우기였나 — 짧은 블록은 더 긴 글로 집을 수 없어 지우는 길을 따로 알린다(#178)
 */
export function selectionAmbiguousMessage(
  selection: string,
  count: number,
  places: readonly string[],
  wholeBlockNumbers: readonly number[],
  isDeletion: boolean,
): string {
  const lines = [
    `범위가 ${count}곳에 있다(받음: "${selection}") — 더 긴 글로 한 곳만 집는다:`,
    ...places.map((place) => `- ${place}`),
  ];
  if (wholeBlockNumbers.length > 0) {
    const numbers = wholeBlockNumbers.map((number) => `블록 ${number}`).join(", ");
    const rangeForm =
      "범위형으로 바로 앞 블록 글자부터 이 블록까지(시작 글=앞 블록 글자...끝 글=이 블록 글자, 첫 블록이면 이 블록부터 바로 뒤 블록 글자까지) 집어";
    const saveWhole = "글 전체 markdown으로 저장한다(앞 · 뒤 블록에 글자가 없으면 이 길)";
    // 바꿔서 유일하게 만드는 길은 블록 전체와 같은 곳이 하나일 때만 — 둘 이상이면 어느 것을 바꿀지부터 못 집는다
    const renameFirst =
      wholeBlockNumbers.length === 1 ? "먼저 이 블록 글자를 바꿔 유일하게 만든 뒤 지우거나, " : "";
    const ways = isDeletion
      ? `지우기는 블록 전체를 고르지 않는다. 이 블록만 지우려면 ${rangeForm} 새 markdown에 이웃 블록 글만 다시 쓰거나(빈 markdown이면 이웃도 지워진다), ${renameFirst}${saveWhole}`
      : `하나만 고치려면 ${rangeForm} 새 markdown에 이웃 블록 글과 함께 다시 쓰거나 ${saveWhole}`;
    lines.push(
      `블록 전체와 같은 곳이 ${wholeBlockNumbers.length}곳이다: ${numbers} — ${ways}. 이웃 블록까지 다시 쓸 때는 이웃 블록의 지시어(font · align 등)도 함께 적는다 — 적지 않으면 초기화된다`,
    );
  }
  return lines.join("\n");
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

/**
 * 스티커가 붙은 블록 여럿을 `sticker=` 없는 새 블록들로 바꾸면 스티커가 말없이 사라진다(adr-032).
 * @param stickerDirectives 옛 스티커를 AI가 그대로 베낄 수 있게 쓴 `sticker=…` 글
 * @param canKeep 새 블록이 스티커를 받을 수 있나 — 사진 자리뿐이면 false라 남기는 법(지시어)을 안내하지 않는다
 */
export function stickersWouldDropMessage(
  stickerDirectives: readonly string[],
  canKeep: boolean,
): string {
  const keep = canKeep
    ? `남기려면 새 markdown 블록의 지시어에 ${stickerDirectives.join(" ")}를 적고, `
    : "새 블록(사진 자리)은 스티커를 받지 않는다. ";
  return `바꾸는 블록에 붙은 스티커 ${stickerDirectives.length}개가 사라진다 — ${keep}버리려면 insert_after로 새 글을 옛 블록 뒤에 먼저 넣은 뒤, 옛 블록을 빈 markdown으로 지운다. 글 전체를 고친다면 글 전체 markdown으로 다시 저장해도 된다`;
}
