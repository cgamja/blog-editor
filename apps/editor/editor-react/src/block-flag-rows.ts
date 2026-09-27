import type { BlockBand } from "@blog-editor/editor-core";
import type { BlockFlag, BlockFlagRow } from "./block-flag-types";

export interface BlockFlagGeometry {
  bands: readonly BlockBand[];
  /** 최상위 블록 각각의 틀 기준 left */
  lefts: readonly number[];
  /** 최상위 블록 각각의 틀 기준 right */
  rights: readonly number[];
  /** 틀의 화면 top */
  frameTop: number;
  /** 틀 왼쪽부터 종이 오른쪽 끝까지의 폭 — 점은 이 안에 둔다 */
  frameWidth: number;
  /** 본문 한 줄 높이(DOM에서 잰 값) — 없으면 블록 가운데에 둔다 */
  lineHeight?: number | undefined;
}

/**
 * 점을 블록별 줄로 묶고 틀 기준 자리를 정한다(#151 디자인 C). 없는 블록(문서가 바뀌어 번호가 넘친)을 가리키는 점은 뺀다.
 * 줄은 블록 오른쪽 가장자리 너머 종이 오른쪽 여백에서 시작한다 — 왼쪽 손잡이 줄과 본문 글자를 가리지 않는다.
 * 여백이 점 여러 개보다 좁으면 줄 폭(maxWidth)에서 접혀 아래로 쌓인다(editor.css `.block-flag-row` flex-wrap).
 */
export function blockFlagRows(
  flags: readonly BlockFlag[],
  { bands, lefts, rights, frameTop, frameWidth, lineHeight }: BlockFlagGeometry,
): BlockFlagRow[] {
  const byIndex = new Map<number, BlockFlag[]>();
  for (const flag of flags) {
    if (bands[flag.index] === undefined) continue;
    byIndex.set(flag.index, [...(byIndex.get(flag.index) ?? []), flag]);
  }
  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, row]) => {
      const band = bands[index]!;
      const height = band.bottom - band.top;
      const blockLeft = lefts[index] ?? 0;
      const blockRight = rights[index] ?? blockLeft;
      const firstLine = Math.min(height, lineHeight ?? height);
      return {
        index,
        top: band.top - frameTop + firstLine / 2,
        left: blockRight,
        maxWidth: Math.max(frameWidth - blockRight, 0),
        block: {
          top: band.top - frameTop,
          left: blockLeft,
          width: blockRight - blockLeft,
          height,
        },
        flags: row,
      };
    });
}
