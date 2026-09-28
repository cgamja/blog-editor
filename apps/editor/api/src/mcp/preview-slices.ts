import { PREVIEW_MAX_EDGE } from "./constants";

export { PREVIEW_MAX_EDGE };

export interface PreviewSlice {
  y: number;
  height: number;
}

/** 페이지 높이를 위에서부터 빈틈없이 PREVIEW_MAX_EDGE씩 자른다 — 마지막 구간은 남은 높이다 */
export function previewSlices(pageHeight: number): PreviewSlice[] {
  const slices: PreviewSlice[] = [];
  for (let y = 0; y < pageHeight; y += PREVIEW_MAX_EDGE) {
    slices.push({ y, height: Math.min(PREVIEW_MAX_EDGE, pageHeight - y) });
  }
  return slices;
}

/** part(1부터)번째 구간. 0 이하 · 전체 구간 수보다 크면 null — 빈 이미지 · 마지막 구간으로 조용히 바꾸지 않는다 */
export function previewSliceAt(pageHeight: number, part: number): PreviewSlice | null {
  if (!Number.isInteger(part) || part < 1) return null;
  return previewSlices(pageHeight)[part - 1] ?? null;
}
