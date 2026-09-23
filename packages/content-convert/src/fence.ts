/**
 * CommonMark 펜스(``` · ~~~) 상태 추적 — directives.ts(지시어 · 각주 정의 줄 걷어내기)와
 * references.ts(참조 정의 줄 찾기)가 "이 줄이 코드 펜스 안이라 그냥 글자다"를 똑같은 규칙으로
 * 판단해야 조용히 어긋나지 않는다. 둘 다 여기 걸 쓴다.
 */

/** 열린 펜스의 글자(백틱/물결)와 길이. */
export interface FenceState {
  char: string;
  len: number;
}

/**
 * 여는 펜스인가 — CommonMark 규칙: 백틱 펜스는 정보 문자열에 백틱이 있으면 펜스를 열지 않는다
 * (물결표 펜스는 백틱을 가져도 된다).
 */
export function parseFenceOpen(line: string): FenceState | null {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return null;
  const marker = match[1]!;
  const info = match[2]!;
  const char = marker[0]!;
  if (char === "`" && info.includes("`")) return null;
  return { char, len: marker.length };
}

/** 닫는 펜스인가 — 같은 글자, 길이가 여는 펜스 이상, 뒤에 정보 문자열이 없다(공백만 허용). */
export function isFenceClose(line: string, fence: FenceState): boolean {
  const closeRe = fence.char === "`" ? /^ {0,3}(`{3,})[ \t]*$/ : /^ {0,3}(~{3,})[ \t]*$/;
  const match = closeRe.exec(line);
  return match !== null && match[1]!.length >= fence.len;
}

/**
 * 줄마다 "펜스 여는 줄 · 안쪽 · 닫는 줄"인지(true) 아닌지(false)를 미리 계산한다 — 지시어 · 참조
 * 정의를 찾는 줄 스캔이 코드 펜스 내용을 건너뛰는 데 쓴다(펜스 여는/닫는 줄 자체도 정의 줄이 아니므로
 * true).
 */
export function computeFenceMask(lines: readonly string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false);
  let fence: FenceState | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (fence) {
      mask[i] = true;
      if (isFenceClose(line, fence)) fence = null;
      continue;
    }
    const opened = parseFenceOpen(line);
    if (opened) {
      fence = opened;
      mask[i] = true;
    }
  }
  return mask;
}
