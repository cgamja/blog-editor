import { useCallback, useEffect, useState } from "react";
import type { PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import { hideSticker } from "@blog-editor/editor-core";
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
 * Esc나 에디터 틀 밖에 놓기도 취소다 — 스냅에 거리 한도가 없어 따로 그만둘 길이 있어야 한다(sticker-polish-review).
 */
export function useStickerGesture(
  editor: Editor,
  layout: StickerLayout,
  selection: StickerSelection,
  onStatus: (message: string) => void,
): StickerGesture {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const active = gesture !== null;

  const run = (command: Command) => command(editor.state, (tr) => editor.view.dispatch(tr));
  const cancel = useCallback(() => setGesture(null), []);

  useCancelOnDocChange(editor, active, cancel);
  useCancelOnEscape(active, cancel);
  // 끌기가 끝나면(놓기 · 취소 · 제자리 클릭) 원래 자리의 스티커를 다시 보인다.
  // 놓기 트랜잭션이면 core가 이미 풀어 두어 hideSticker(null)은 false다
  useEffect(() => {
    if (!active) return;
    return () => {
      if (!editor.isDestroyed) run(hideSticker(null));
    };
  }, [editor, active]);

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
    // 끄는 동안은 유령이 스티커다 — 원래 자리의 것이 남아 있으면 안 움직이는 것처럼 보인다(sticker-polish design.md 1)
    run(hideSticker(refOf(box)));
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
    const preview = previewOf(
      editor,
      { ...gesture, current },
      layout.measureBlocksNow(),
      layout.measureLayerNow(),
    );
    // 틀 밖에 놓은 것은 취소다 — 알릴 것이 없다
    if (preview.cancelled) return;
    if (preview.command === null) {
      onStatus(STICKER_MESSAGES.cannotPlace);
      return;
    }
    if (run(preview.command) && preview.next !== null) selection.selectAndFocus(preview.next);
  };

  const onCancel = (event: PointerEvent<HTMLElement>) => {
    if (isOurs(event)) cancel();
  };

  const preview =
    gesture === null
      ? null
      : previewOf(editor, gesture, layout.measureBlocksNow(), layout.measureLayerNow());

  return { gesture, preview, handlers: { onStart, onMove, onEnd, onCancel } };
}

/** 끄는 동안 문서가 바뀌면 잡아 둔 (블록 위치, 순번)이 낡는다 */
function useCancelOnDocChange(editor: Editor, active: boolean, cancel: () => void) {
  useEffect(() => {
    if (!active) return;
    const cancelOnDocChange = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) cancel();
    };
    editor.on("transaction", cancelOnDocChange);
    return () => void editor.off("transaction", cancelOnDocChange);
  }, [editor, active, cancel]);
}

/**
 * 끄는 동안 Esc = 제자리. 포인터를 잡은 요소가 포커스를 갖지 않을 수 있어(조절점은 span) 창에서 받는다.
 * 캡처 단계라 에디터 키맵보다 먼저다.
 */
function useCancelOnEscape(active: boolean, cancel: () => void) {
  useEffect(() => {
    if (!active) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };
    window.addEventListener("keydown", cancelOnEscape, true);
    return () => window.removeEventListener("keydown", cancelOnEscape, true);
  }, [active, cancel]);
}
