import { PREVIEW_MAX_EDGE, previewSliceAt, previewSlices } from "./preview-slices";

describe("mcp-drafts — preview_post 구간 나누기", () => {
  it("WHEN 페이지 높이를 구간으로 나누면 THEN 구간이 위에서부터 빈틈없이 이어지고 한 구간 높이가 1568 이하다", () => {
    expect(PREVIEW_MAX_EDGE).toBe(1568);
    expect(previewSlices(900)).toEqual([{ y: 0, height: 900 }]);
    expect(previewSlices(1568 * 2)).toEqual([
      { y: 0, height: 1568 },
      { y: 1568, height: 1568 },
    ]);
    expect(previewSlices(1568 * 2 + 1)).toEqual([
      { y: 0, height: 1568 },
      { y: 1568, height: 1568 },
      { y: 3136, height: 1 },
    ]);
  });

  it("WHEN part(1부터)로 구간을 고르면 THEN 범위 안이면 그 구간이고 0 · 전체 구간 수보다 크면 null이다", () => {
    // 범위 밖 part는 도구 오류로 이어진다 — 빈 이미지 · 마지막 구간으로 조용히 바꾸지 않는다
    const height = 1568 + 10;

    expect(previewSliceAt(height, 1)).toEqual({ y: 0, height: 1568 });
    expect(previewSliceAt(height, 2)).toEqual({ y: 1568, height: 10 });
    expect(previewSliceAt(height, 3)).toBeNull();
    expect(previewSliceAt(height, 0)).toBeNull();
  });
});
