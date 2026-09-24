import { STICKER_IDS, STICKER_RANGES } from "@blog-editor/content-schema";
import { STICKER_HIDDEN_ATTR, wrapRotation } from "@blog-editor/editor-core";
import type { LayerPoint, LayerSize, StickerCorner, StickerId } from "./sticker-types";

/**
 * 스티커 오버레이의 순수 계산 — spec: editor-sticker-layer, sticker-drag design.md.
 * DOM을 모른다(node 환경 테스트). 사용자 문장은 sticker-messages.
 */

export const isStickerId = (value: string): value is StickerId =>
  (STICKER_IDS as readonly string[]).includes(value);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * 조절점을 끈 거리 비율만큼 크기를 바꾼다. 손이 범위 밖으로 가도 5~50에 모은다 —
 * 끄는 동안 보이는 유령이 곧 저장될 값이다(design.md 3).
 */
export function resizedSize(start: number, startDistance: number, distance: number): number {
  const { min, max } = STICKER_RANGES.size;
  if (startDistance <= 0) return start;
  return clamp(Math.round((start * distance) / startDistance), min, max);
}

const DEGREES_PER_RADIAN = 180 / Math.PI;

/** 중심 기준 각도가 바뀐 만큼 돌린다. ±180에서 감긴다 */
export function rotatedAngle(start: number, startRadians: number, radians: number): number {
  return wrapRotation(Math.round(start + (radians - startRadians) * DEGREES_PER_RADIAN)) + 0; // + 0: -0을 0으로
}

// ── 커서 · 숨김 규칙(sticker-polish design.md 3 · 4) ──

/** 모서리의 화면 각도(도, x축에서 시계 방향 — 화면 y가 아래) */
const CORNER_DEGREES: Record<StickerCorner, number> = { se: 45, sw: 135, nw: 225, ne: 315 };
const HALF_TURN_DEGREES = 180;
/** 크기 커서 네 방향이 각각 차지하는 폭 */
const CURSOR_SECTOR_DEGREES = 45;
/** 180°를 네 칸으로 나눈 순서 — 0° 가로부터 시계 방향 */
const RESIZE_CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"] as const;

/**
 * 크기 조절의 기준 거리 — 중심에서 모서리까지. 누른 점까지의 거리를 쓰면 중심 가까이를 눌렀을 때
 * 조금만 움직여도 크기가 폭주한다(sticker-polish-review).
 */
export const cornerDistance = (width: number, height: number): number =>
  Math.hypot(width / 2, height / 2);

/** 점이 에디터 틀(레이어 기준 0,0 ~ 폭,높이) 안인가 — 밖에 놓으면 끌기 취소다 */
export const isInsideLayer = ({ x, y }: LayerPoint, { width, height }: LayerSize): boolean =>
  x >= 0 && y >= 0 && x <= width && y <= height;

/**
 * 조절점은 스티커와 함께 돈다. 모서리 각도에 회전을 더한 화면 각도를 180°로 접어,
 * 가장 가까운 CSS 크기 커서를 고른다(반대 방향은 같은 커서).
 */
export function resizeCursor(corner: StickerCorner, rotate: number): string {
  const degrees = CORNER_DEGREES[corner] + rotate;
  const folded = ((degrees % HALF_TURN_DEGREES) + HALF_TURN_DEGREES) % HALF_TURN_DEGREES;
  const sector = Math.round(folded / CURSOR_SECTOR_DEGREES) % RESIZE_CURSORS.length;
  return RESIZE_CURSORS[sector] ?? RESIZE_CURSORS[0];
}

/** 래퍼의 첫 자식은 블록 요소이고 스티커는 그 뒤다(editor-core withDecoration) — 순번 0이 둘째 자식 */
const FIRST_STICKER_CHILD = 2;

/**
 * 끄는 동안 원래 자리의 스티커 하나를 가리는 CSS 규칙. editor-core 장식이 블록에 순번을 달고,
 * 이 규칙이 그 블록 바로 아래 자식 가운데 그 순번의 스티커만 고른다. `:nth-child(An+B of S)`는
 * 모르는 브라우저에서 규칙째 버려져서 자식 위치로 고른다(래퍼 구조가 고정이라 가능하다).
 */
export function hiddenStickerRule(index: number): string {
  const child = index + FIRST_STICKER_CHILD;
  return `.blog-editor [${STICKER_HIDDEN_ATTR}="${index}"] > .post-sticker:nth-child(${child}){visibility:hidden}`;
}

// ── 패널 격자 → 에디터 끌어 오기(HTML5 drag) ──

/** 이 앱만 읽는 형식 — 다른 곳(메모장 등)에 놓아도 글자가 들어가지 않는다 */
export const STICKER_DRAG_TYPE = "application/x-blog-editor-sticker";

/** DataTransfer에서 쓰는 부분만 */
export interface StickerDragData {
  readonly types: readonly string[];
  getData(type: string): string;
  setData(type: string, value: string): void;
}

export function writeStickerDrag(data: StickerDragData, id: StickerId): void {
  data.setData(STICKER_DRAG_TYPE, id);
}

/** 우리 형식이 아니거나 모르는 id면 null — 밖에서 온 끌기는 ProseMirror 기본 처리에 넘긴다 */
export function readStickerDrag(data: StickerDragData): StickerId | null {
  if (!data.types.includes(STICKER_DRAG_TYPE)) return null;
  const id = data.getData(STICKER_DRAG_TYPE);
  return isStickerId(id) ? id : null;
}
