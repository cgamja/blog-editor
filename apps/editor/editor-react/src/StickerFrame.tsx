import { removeStickerLabel } from "./sticker-messages";
import type { GestureKind, StickerBox, StickerCorner } from "./sticker-types";
import { resizeCursor } from "./sticker-ui";
import type { StickerGestureHandlers } from "./use-sticker-gesture";

export interface StickerFrameProps {
  box: StickerBox;
  /** 끄는 중 — 유령이 대신 보이므로 숨기되 마운트는 유지한다(잡은 포인터가 풀리지 않게) */
  hidden: boolean;
  gesture: StickerGestureHandlers;
  onRemove: (box: StickerBox) => void;
}

const CORNERS: readonly StickerCorner[] = ["nw", "ne", "se", "sw"];

/**
 * 고른 스티커 — 점선 테두리 · 네 모서리 크기 조절점 · 위 회전 손잡이 · 지우기(이슈 #61 결정 B안, #71).
 * 테두리는 스티커와 같이 돌고, 조절점 커서는 화면에서 보이는 방향을 따른다(sticker-polish design.md 4).
 * 조절점과 손잡이는 포인터 전용이라 aria-hidden이고, 같은 일을 스티커 버튼의 키보드로 한다(sticker-drag design.md 4).
 */
export function StickerFrame({ box, hidden, gesture, onRemove }: StickerFrameProps) {
  const handleProps = (kind: GestureKind) => ({
    "aria-hidden": true,
    onPointerDown: gesture.onStart(kind, box),
    onPointerMove: gesture.onMove,
    onPointerUp: gesture.onEnd,
    onPointerCancel: gesture.onCancel,
  });

  return (
    <div
      className="sticker-frame"
      data-hidden={hidden ? "" : undefined}
      style={{
        left: box.centerX,
        top: box.centerY,
        width: box.width,
        height: box.height,
        transform: `translate(-50%, -50%) rotate(${box.rotate}deg)`,
      }}
    >
      <span aria-hidden="true" className="sticker-stem" />
      <span className="sticker-handle sticker-handle-rotate" {...handleProps("rotate")} />
      {CORNERS.map((corner) => (
        <span
          key={corner}
          className={`sticker-handle sticker-handle-resize sticker-handle-${corner}`}
          style={{ cursor: resizeCursor(corner, box.rotate) }}
          {...handleProps("resize")}
        />
      ))}
      <button
        type="button"
        className="sticker-remove"
        aria-label={removeStickerLabel(box.id)}
        onClick={() => onRemove(box)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
