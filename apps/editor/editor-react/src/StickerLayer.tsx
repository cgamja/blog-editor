import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import type { Command, Transaction } from "@tiptap/pm/state";
import { mapStickerRef, removeSticker, stickerKeyCommand } from "@blog-editor/editor-core";
import type { StickerRef } from "@blog-editor/editor-core";
import { StickerFrame } from "./StickerFrame";
import type { StickerBox } from "./sticker-measure";
import { CANNOT_PLACE, previewOf, refOf, type Gesture, type GestureKind } from "./sticker-preview";
import { stickerName } from "./sticker-ui";
import { useStickerDrop } from "./use-sticker-drop";
import { useStickerLayout } from "./use-sticker-layout";

/**
 * 에디터 위 스티커 오버레이 — spec: editor-sticker-layer, sticker-drag design.md.
 * ProseMirror DOM 밖 형제 요소라 포인터 · 키가 에디터에 닿지 않는다(design.md 1).
 * 끄는 동안은 유령만 그리고, 놓을 때 커맨드 1번 = 트랜잭션 1번 = undo 1번이다.
 */

const HINT =
  "방향키로 옮기고, 더하기 · 빼기로 크기를, 대괄호로 회전을 바꿔요. Delete로 지우고 Esc로 나가요.";
const REMOVE_KEYS = new Set(["Delete", "Backspace"]);
/** 이만큼 움직이기 전에는 끌기가 아니라 고르기(클릭)다 */
const DRAG_THRESHOLD_PX = 3;

const keyOf = ({ blockPos, index }: StickerRef) => `${blockPos}:${index}`;
const sameRef = (a: StickerRef | null, b: StickerRef) => a !== null && keyOf(a) === keyOf(b);

export interface StickerLayerProps {
  editor: Editor;
}

export function StickerLayer({ editor }: StickerLayerProps) {
  const { layerRef, boxes, toLocal } = useStickerLayout(editor);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterUpdate = useRef(false);
  const hintId = useId();
  const [selected, setSelected] = useState<StickerRef | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [status, setStatus] = useState("");

  const run = (command: Command) => command(editor.state, (tr) => editor.view.dispatch(tr));

  const handlePlaced = useCallback((ref: StickerRef) => {
    setStatus("");
    focusAfterUpdate.current = true;
    setSelected(ref);
  }, []);
  useStickerDrop(editor, { onPlaced: handlePlaced, onRejected: setStatus });

  // 고른 스티커가 다른 블록으로 옮겨 가면 버튼이 새로 생긴다 — 포커스를 따라 옮긴다
  useLayoutEffect(() => {
    if (!focusAfterUpdate.current || selected === null) return;
    const button = buttons.current.get(keyOf(selected));
    if (button === undefined) return;
    focusAfterUpdate.current = false;
    button.focus();
  }, [boxes, selected]);

  // 트랜잭션을 따라 고른 참조를 옮기고, 글을 쓰러 에디터로 돌아가면 고르기를 푼다
  useEffect(() => {
    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      setSelected((ref) => ref && mapStickerRef(ref, transaction.mapping, transaction.doc));
    };
    const handleFocus = () => setSelected(null);
    editor.on("transaction", handleTransaction);
    editor.on("focus", handleFocus);
    return () => {
      editor.off("transaction", handleTransaction);
      editor.off("focus", handleFocus);
    };
  }, [editor]);

  const handleGestureStart =
    (kind: GestureKind, box: StickerBox) => (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || editor.view.composing) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelected(refOf(box));
      setStatus("");
      const { clientX: x, clientY: y } = event;
      setGesture({ kind, box, startX: x, startY: y, x, y });
    };

  const handleGestureMove = (event: PointerEvent<HTMLElement>) => {
    setGesture((current) => current && { ...current, x: event.clientX, y: event.clientY });
  };

  const handleGestureEnd = (event: PointerEvent<HTMLElement>) => {
    const current = gesture;
    setGesture(null);
    if (current === null || editor.view.composing) return;
    const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (current.kind === "move" && moved < DRAG_THRESHOLD_PX) {
      event.currentTarget.focus();
      return;
    }
    const preview = previewOf(editor, { ...current, x: event.clientX, y: event.clientY });
    if (preview.command === null) {
      setStatus(CANNOT_PLACE);
      return;
    }
    if (run(preview.command)) {
      focusAfterUpdate.current = true;
      setSelected(preview.next);
    }
  };

  const handleGestureCancel = () => setGesture(null);

  const handleRemove = (box: StickerBox) => {
    run(removeSticker(box.blockPos, box.index));
    setSelected(null);
    editor.commands.focus();
  };

  const handleKeyDown = (box: StickerBox) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (editor.view.composing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setSelected(null);
      editor.commands.focus();
      return;
    }
    const command = stickerKeyCommand(refOf(box), event.key);
    if (command === null) return;
    event.preventDefault();
    if (REMOVE_KEYS.has(event.key)) handleRemove(box);
    else run(command);
  };

  const preview = gesture === null ? null : previewOf(editor, gesture);
  const selectedBox = boxes.find((box) => sameRef(selected, refOf(box)));
  const gestureHandlers = {
    onStart: handleGestureStart,
    onMove: handleGestureMove,
    onEnd: handleGestureEnd,
    onCancel: handleGestureCancel,
  };

  return (
    <div className="sticker-layer" ref={layerRef}>
      <p id={hintId} className="sticker-visually-hidden">
        {HINT}
      </p>
      {boxes.map((box) => {
        // 회전해도 스티커를 덮도록 긴 변 기준 정사각형
        const side = Math.max(box.width, box.height);
        return (
          <button
            key={box.key}
            ref={(element) => {
              if (element === null) buttons.current.delete(box.key);
              else buttons.current.set(box.key, element);
            }}
            type="button"
            className="sticker-hit"
            aria-label={`${stickerName(box.id)} 스티커`}
            aria-describedby={hintId}
            aria-pressed={sameRef(selected, refOf(box))}
            style={{
              ...toLocal(box.centerX - side / 2, box.centerY - side / 2),
              width: side,
              height: side,
            }}
            onFocus={() => setSelected(refOf(box))}
            onKeyDown={handleKeyDown(box)}
            onPointerDown={handleGestureStart("move", box)}
            onPointerMove={handleGestureMove}
            onPointerUp={handleGestureEnd}
            onPointerCancel={handleGestureCancel}
          />
        );
      })}
      {selectedBox !== undefined && gesture === null && (
        <StickerFrame
          box={selectedBox}
          toLocal={toLocal}
          gesture={gestureHandlers}
          onRemove={handleRemove}
        />
      )}
      {gesture !== null && preview !== null && (
        <>
          <img
            src={gesture.box.src}
            alt=""
            className="sticker-ghost"
            data-blocked={preview.command === null ? "" : undefined}
            style={{
              ...toLocal(preview.centerX, preview.centerY),
              width: preview.width,
              transform: `translate(-50%, -50%) rotate(${preview.rotate}deg)`,
            }}
          />
          <span
            className="sticker-tag"
            style={toLocal(preview.centerX, preview.centerY + preview.width / 2)}
          >
            {preview.label}
          </span>
        </>
      )}
      <p role="status" className="sticker-status">
        {status}
      </p>
    </div>
  );
}
