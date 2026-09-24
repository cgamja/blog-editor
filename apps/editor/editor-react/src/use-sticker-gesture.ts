import { useEffect, useState } from "react";
import type { PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import { STICKER_MESSAGES } from "./sticker-messages";
import { previewOf } from "./sticker-preview";
import { refOf } from "./sticker-ref";
import type { Gesture, GestureKind, Preview, StickerBox } from "./sticker-types";
import type { StickerLayout } from "./use-sticker-layout";
import type { StickerSelection } from "./use-sticker-selection";

type PointerHandler = (event: PointerEvent<HTMLElement>) => void;

export interface StickerGestureHandlers {
  onStart: (kind: GestureKind, box: StickerBox) => PointerHandler;
  onMove: PointerHandler;
  onEnd: PointerHandler;
  onCancel: PointerHandler;
}

export interface StickerGesture {
  gesture: Gesture | null;
  preview: Preview | null;
  handlers: StickerGestureHandlers;
}

/** 이만큼 움직이기 전에는 끌기가 아니라 고르기(클릭)다 */
const DRAG_THRESHOLD_PX = 3;

/**
 * 옮기기 · 크기 · 회전 끌기(sticker-drag design.md 1 · 3). 포인터를 잡은 요소는 끄는 동안 언마운트되지 않는다
 * (StickerLayer가 테두리를 숨기기만 한다) — 요소가 사라지면 캡처가 풀린다.
 * https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture
 * 끄는 동안 문서가 바뀌면(다른 곳의 트랜잭션) 잡아 둔 참조가 낡으므로 끌기를 취소한다.
 */
export function useStickerGesture(
  editor: Editor,
  layout: StickerLayout,
  selection: StickerSelection,
  onStatus: (message: string) => void,
): StickerGesture {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const active = gesture !== null;

  useEffect(() => {
    if (!active) return;
    const cancelOnDocChange = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) setGesture(null);
    };
    editor.on("transaction", cancelOnDocChange);
    return () => void editor.off("transaction", cancelOnDocChange);
  }, [editor, active]);

  const run = (command: Command) => command(editor.state, (tr) => editor.view.dispatch(tr));
  const isOurs = (event: PointerEvent<HTMLElement>) =>
    gesture !== null && event.pointerId === gesture.pointerId;

  const onStart = (kind: GestureKind, box: StickerBox) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || gesture !== null || editor.view.composing) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    selection.select(refOf(box));
    onStatus("");
    const point = layout.toLayerPoint(event.clientX, event.clientY);
    setGesture({ kind, box, pointerId: event.pointerId, start: point, current: point });
  };

  const onMove = (event: PointerEvent<HTMLElement>) => {
    if (!isOurs(event)) return;
    const current = layout.toLayerPoint(event.clientX, event.clientY);
    setGesture((previous) => previous && { ...previous, current });
  };

  const onEnd = (event: PointerEvent<HTMLElement>) => {
    if (!isOurs(event) || gesture === null) return;
    setGesture(null);
    if (editor.view.composing) return;
    const current = layout.toLayerPoint(event.clientX, event.clientY);
    const moved = Math.hypot(current.x - gesture.start.x, current.y - gesture.start.y);
    if (moved < DRAG_THRESHOLD_PX) {
      // 제자리 클릭은 고르기만 — 문서를 건드리지 않는다
      if (gesture.kind === "move") event.currentTarget.focus();
      return;
    }
    const preview = previewOf(editor, { ...gesture, current }, layout.measureBlocksNow());
    if (preview.command === null) {
      onStatus(STICKER_MESSAGES.cannotPlace);
      return;
    }
    if (run(preview.command) && preview.next !== null) selection.selectAndFocus(preview.next);
  };

  const onCancel = (event: PointerEvent<HTMLElement>) => {
    if (isOurs(event)) setGesture(null);
  };

  const preview = gesture === null ? null : previewOf(editor, gesture, layout.measureBlocksNow());

  return { gesture, preview, handlers: { onStart, onMove, onEnd, onCancel } };
}
