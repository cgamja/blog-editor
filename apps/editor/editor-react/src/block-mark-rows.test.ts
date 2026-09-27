import { blockFlagRows } from "./block-flag-rows";
import type { BlockFlag } from "./block-flag-types";

/** 블록 손잡이 줄 폭(px) — editor.css `.block-handles` 6.5rem. 점이 손잡이 줄과 안 겹치는지 재는 데만 쓴다 */
const BLOCK_HANDLES_WIDTH_PX = 104;

// 종이(틀)는 화면 x 200에서 폭 800. 본문 블록은 틀 기준 x 120–680 — 왼쪽 여백 120 · 오른쪽 여백 120
const FRAME = { frameTop: 50, frameLeft: 200, frameWidth: 800 };
const BLOCK_LEFT = 120;
const BLOCK_RIGHT = 680;
const geometry = {
  ...FRAME,
  bands: [
    { top: 100, bottom: 132 },
    { top: 140, bottom: 240 },
  ],
  lefts: [BLOCK_LEFT, BLOCK_LEFT],
  rights: [BLOCK_RIGHT, BLOCK_RIGHT],
};

const flag = (id: string, index: number): BlockFlag => ({
  id,
  index,
  label: `권장: ${id}`,
  tone: "medium",
});

describe("blockFlagRows: 여백 점은 종이 안 오른쪽 여백에 둔다(#151 디자인 C)", () => {
  it("WHEN 블록 1에 점 둘 THEN 줄은 블록 오른쪽 가장자리 너머에서 시작해 종이 안에서 끝나고 손잡이 줄과 겹치지 않는다", () => {
    const [row] = blockFlagRows([flag("a", 1), flag("b", 1)], geometry);
    const left = row?.left ?? Number.NaN;
    // 점 버튼 44px 둘 + 사이 4px
    const width = 44 * 2 + 4;

    expect(left).toBeGreaterThanOrEqual(BLOCK_RIGHT);
    expect(left + width).toBeLessThanOrEqual(FRAME.frameWidth);
    const handlesStart = BLOCK_LEFT - BLOCK_HANDLES_WIDTH_PX;
    expect(left >= BLOCK_LEFT || left + width <= handlesStart).toBe(true);
  });

  it("WHEN 문서에 없는 블록 번호(5)를 가리키는 점 THEN 그 줄은 버리고 있는 블록의 줄만 남는다", () => {
    const rows = blockFlagRows([flag("gone", 5), flag("a", 0)], geometry);

    expect(rows.map((row) => row.index)).toEqual([0]);
  });
});
