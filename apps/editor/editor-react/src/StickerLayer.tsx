import { useCallback, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import { keydownHandler } from "@tiptap/pm/keymap";
import {
  historyKeymap,
  isStickerRemoveKey,
  removeSticker,
  stickerKeyCommand,
} from "@blog-editor/editor-core";
import type { StickerRef } from "@blog-editor/editor-core";
import { StickerFrame } from "./StickerFrame";
import { STICKER_MESSAGES, stickerAriaLabel } from "./sticker-messages";
import { refOf, sameRef } from "./sticker-ref";
import type { StickerBox } from "./sticker-types";
import { useStickerDrop } from "./use-sticker-drop";
import { useStickerGesture } from "./use-sticker-gesture";
import { useStickerLayout } from "./use-sticker-layout";
import { useStickerSelection } from "./use-sticker-selection";

/**
 * 에디터 위 스티커 오버레이 — spec: editor-sticker-layer, sticker-drag design.md.
 * ProseMirror DOM 밖 형제 요소라 포인터 · 키가 에디터에 닿지 않는다(design.md 1).
 * 끄는 동안은 유령만 그리고, 놓을 때 커맨드 1번 = 트랜잭션 1번 = undo 1번이다.
 */

/**
 * 스티커 버튼에 포커스가 있어도 되돌리기 · 다시 하기(⌘Z 등)는 에디터 것을 쓴다 — 버튼은 ProseMirror 밖이라
 * 에디터 키맵이 받지 못한다. Mod를 플랫폼대로 푸는 keydownHandler를 그대로 쓴다.
 * https://prosemirror.net/docs/ref/#keymap.keydownHandler
 */
const handleHistoryKeys = keydownHandler(historyKeymap);

export interface StickerLayerProps {
  editor: Editor;
}

export function StickerLayer({ editor }: StickerLayerProps) {
  const hintId = useId();
  const [status, setStatus] = useState("");
  const layout = useStickerLayout(editor);
  const selection = useStickerSelection(editor, layout.boxes);
  const { gesture, preview, handlers } = useStickerGesture(editor, layout, selection, setStatus);

  const handlePlaced = useCallback(
    (ref: StickerRef) => {
      setStatus("");
      selection.selectAndFocus(ref);
    },
    [selection.selectAndFocus],
  );
  useStickerDrop(editor, layout, { onPlaced: handlePlaced, onRejected: setStatus });

  const handleRemove = (box: StickerBox) => {
    removeSticker(box.blockPos, box.index)(editor.state, (tr) => editor.view.dispatch(tr));
    selection.leave();
  };

  const handleKeyDown = (box: StickerBox) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (gesture !== null || editor.view.composing) return;
    const { key, metaKey, ctrlKey, altKey } = event;
    if (key === "Escape" && !metaKey && !ctrlKey && !altKey) {
      event.preventDefault();
      selection.leave();
      return;
    }
    const command = stickerKeyCommand(refOf(box), key, { metaKey, ctrlKey, altKey });
    if (command === null) {
      if (handleHistoryKeys(editor.view, event.nativeEvent)) event.preventDefault();
      return;
    }
    event.preventDefault();
    command(editor.state, (tr) => editor.view.dispatch(tr));
    // 지운 스티커의 버튼은 사라진다 — 포커스를 글쓰기로 돌린다
    if (isStickerRemoveKey(key)) selection.leave();
  };

  const selectedBox = layout.boxes.find((box) => sameRef(selection.selected, refOf(box)));

  return (
    <div className="sticker-layer" ref={layout.layerRef}>
      <p id={hintId} className="sticker-visually-hidden">
        {STICKER_MESSAGES.keyboardHint}
      </p>
      {layout.boxes.map((box) => {
        // 회전해도 스티커를 덮도록 긴 변 기준 정사각형
        const side = Math.max(box.width, box.height);
        return (
          <button
            key={box.key}
            ref={(element) => selection.registerButton(box.key, element)}
            type="button"
            className="sticker-hit"
            aria-label={stickerAriaLabel(box.id)}
            aria-describedby={hintId}
            aria-pressed={sameRef(selection.selected, refOf(box))}
            style={{
              left: box.centerX - side / 2,
              top: box.centerY - side / 2,
              width: side,
              height: side,
            }}
            onFocus={() => selection.select(refOf(box))}
            onKeyDown={handleKeyDown(box)}
            onPointerDown={handlers.onStart("move", box)}
            onPointerMove={handlers.onMove}
            onPointerUp={handlers.onEnd}
            onPointerCancel={handlers.onCancel}
          />
        );
      })}
      {selectedBox !== undefined && (
        <StickerFrame
          box={selectedBox}
          hidden={gesture !== null}
          gesture={handlers}
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
              left: preview.centerX,
              top: preview.centerY,
              width: preview.width,
              transform: `translate(-50%, -50%) rotate(${preview.rotate}deg)`,
            }}
          />
          <span
            className="sticker-tag"
            style={{ left: preview.centerX, top: preview.centerY + preview.width / 2 }}
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
