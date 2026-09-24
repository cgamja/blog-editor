import { anchorLabel, removeStickerLabel } from "./sticker-messages";
import type { GestureKind, StickerBox } from "./sticker-types";
import type { StickerGestureHandlers } from "./use-sticker-gesture";

export interface StickerFrameProps {
  box: StickerBox;
  /** 끄는 중 — 유령이 대신 보이므로 숨기되 마운트는 유지한다(잡은 포인터가 풀리지 않게) */
  hidden: boolean;
  gesture: StickerGestureHandlers;
  onRemove: (box: StickerBox) => void;
}

/**
 * 고른 스티커 — 점선 테두리 · 오른쪽 아래 크기 조절점 · 위 회전 손잡이 · 지우기 · 꼬리표(이슈 #61 결정 B안).
 * 테두리는 스티커와 같이 돈다. 조절점과 손잡이는 포인터 전용이라 aria-hidden이고,
 * 같은 일을 스티커 버튼의 키보드로 한다(sticker-drag design.md 4).
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
    <>
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
        <span className="sticker-handle sticker-handle-resize" {...handleProps("resize")} />
        <button
          type="button"
          className="sticker-remove"
          aria-label={removeStickerLabel(box.id)}
          onClick={() => onRemove(box)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {!hidden && (
        <span
          className="sticker-tag"
          style={{ left: box.centerX, top: box.centerY + box.height / 2 }}
        >
          {anchorLabel(box.nodeName)}
        </span>
      )}
    </>
  );
}
