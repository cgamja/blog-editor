import { STICKER_IDS } from "@blog-editor/content-schema";

type StickerId = (typeof STICKER_IDS)[number];

/**
 * 스티커 원본 픽셀 크기(사이트 `public/stickers/*.png` 실측, spec: render-decoration) —
 * img에 width/height를 내려 레이아웃 이동을 막는다. 키 타입을 STICKER_IDS에서 파생해
 * 스키마에 id가 늘면 이 맵이 누락됐을 때 typecheck가 잡는다.
 */
export const STICKER_SIZES: Record<StickerId, { width: number; height: number }> = {
  "star-coral": { width: 151, height: 160 },
  "star-mint": { width: 160, height: 153 },
  heart: { width: 160, height: 128 },
  cloud: { width: 160, height: 102 },
  bottle: { width: 81, height: 160 },
  rattle: { width: 129, height: 160 },
  pacifier: { width: 145, height: 133 },
  "foot-coral": { width: 109, height: 160 },
  "foot-mint": { width: 110, height: 160 },
};
