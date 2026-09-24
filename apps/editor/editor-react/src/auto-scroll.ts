/** 끄는 동안 스크롤 상자 가장자리에서의 자동 스크롤 계산(block-controls design.md 4) — DOM 없는 순수 함수 */

/** 스크롤 상자 가장자리에서 이만큼 안쪽이면 자동 스크롤한다(block-controls design.md 4) */
const AUTO_SCROLL_EDGE_PX = 48;
/** 가장자리에 닿았을 때 한 프레임(rAF) 스크롤 양 — 60fps에서 초당 약 960px */
const AUTO_SCROLL_MAX_PX = 16;

/** 가장자리까지 거리 → 속도. 가장자리에 가까울수록(밖이면 최대) 빠르다 */
function edgeSpeed(distance: number): number {
  if (distance >= AUTO_SCROLL_EDGE_PX) return 0;
  const closeness = (AUTO_SCROLL_EDGE_PX - Math.max(distance, 0)) / AUTO_SCROLL_EDGE_PX;
  return Math.round(AUTO_SCROLL_MAX_PX * closeness);
}

/**
 * 끄는 동안 한 프레임에 스크롤할 양(px). 위 가장자리면 음수, 아래 가장자리면 양수, 가운데면 0.
 * `box`는 스크롤 상자의 화면 세로 범위다.
 */
export function autoScrollStep(pointerY: number, box: { top: number; bottom: number }): number {
  const up = edgeSpeed(pointerY - box.top);
  if (up > 0) return -up;
  return edgeSpeed(box.bottom - pointerY);
}
