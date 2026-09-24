import type { PointerEvent } from "react";
import type { StickerBox } from "./sticker-measure";
import type { GestureKind } from "./sticker-preview";
import { anchorLabel, stickerName } from "./sticker-ui";

type PointerHandler = (event: PointerEvent<HTMLElement>) => void;

export interface StickerFrameProps {
  box: StickerBox;
  toLocal: (x: number, y: number) => { left: number; top: number };
  gesture: {
    onStart: (kind: GestureKind, box: StickerBox) => PointerHandler;
    onMove: PointerHandler;
    onEnd: PointerHandler;
    onCancel: () => void;
  };
  onRemove: (box: StickerBox) => void;
}

/**
 * 고른 스티커 — 점선 테두리 · 오른쪽 아래 크기 조절점 · 위 회전 손잡이 · 지우기 · 꼬리표(이슈 #61 결정 B안).
 * 테두리는 스티커와 같이 돈다. 조절점과 손잡이는 포인터 전용이라 aria-hidden이고,
 * 같은 일을 스티커 버튼의 키보드로 한다(sticker-drag design.md 4).
 */
export function StickerFrame({ box, toLocal, gesture, onRemove }: StickerFrameProps) {
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
        style={{
          ...toLocal(box.centerX, box.centerY),
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
          aria-label={`${stickerName(box.id)} 스티커 지우기`}
          onClick={() => onRemove(box)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <span className="sticker-tag" style={toLocal(box.centerX, box.centerY + box.height / 2)}>
        {anchorLabel(box.nodeName)}
      </span>
    </>
  );
}
