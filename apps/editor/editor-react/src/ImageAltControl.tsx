import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import { ALT_MAX_LENGTH } from "@blog-editor/content-schema";
import { setImageAlt } from "@blog-editor/editor-core";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";
import { useCommandRunner } from "./use-command-runner";

/** 조합 중인 키 입력의 keyCode(IME "Process" 키) */
const COMPOSING_KEY_CODE = 229;

export interface ImageAltControlProps {
  editor: Editor;
  /** 노드로 고른 그림의 위치와 지금 대체 텍스트 */
  pos: number;
  alt: string;
}

/**
 * 폭 도구줄 안의 「대체 텍스트」 버튼과 입력칸(spec: editor-image-insert). 비어 있으면 버튼에 경고 표시를 달고,
 * Enter로 적용 · Esc로 닫고 버튼으로 포커스를 돌린다. 편집 영역이 초점을 잃어도 노드 선택은 EditorState에
 * 남으므로 pos로 적용한다.
 */
export function ImageAltControl({ editor, pos, alt }: ImageAltControlProps) {
  const run = useCommandRunner(editor);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(alt);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const inputId = useId();
  const hintId = useId();
  const missing = alt === "";

  useEffect(() => {
    if (!open) return;
    setValue(alt);
    inputRef.current?.focus();
  }, [open, alt]);

  // 도구줄은 눌러도 편집 영역 선택이 풀리지 않게 mousedown을 막는다(WidthToolbar) — 입력칸은 초점을 받아야
  // 해서 입력칸 상자에서 전파를 끊는다
  useEffect(() => {
    const popover = popoverRef.current;
    if (!open || popover === null) return undefined;
    const stop = (event: MouseEvent) => event.stopPropagation();
    popover.addEventListener("mousedown", stop);
    return () => popover.removeEventListener("mousedown", stop);
  }, [open]);

  const closeToButton = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 Enter는 조합 확정이다 — 적용하지 않는다. Safari는 확정 Enter에 isComposing을 끄고
    // keyCode 229만 남긴다 — https://developer.mozilla.org/docs/Web/API/Element/keydown_event#keydown_events_with_ime
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === COMPOSING_KEY_CODE) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeToButton();
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(setImageAlt(pos, value.trim()));
      closeToButton();
    }
  };

  return (
    <span className="image-alt-control">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={
          missing
            ? `${IMAGE_INSERT_MESSAGES.altButton} — ${IMAGE_INSERT_MESSAGES.altMissing}`
            : IMAGE_INSERT_MESSAGES.altButton
        }
        data-missing={missing ? "" : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {IMAGE_INSERT_MESSAGES.altButton}
      </button>
      {open && (
        <span ref={popoverRef} className="image-alt-popover">
          <label htmlFor={inputId}>{IMAGE_INSERT_MESSAGES.altLabel}</label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={value}
            maxLength={ALT_MAX_LENGTH}
            aria-describedby={hintId}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <span id={hintId} className="image-alt-hint">
            {IMAGE_INSERT_MESSAGES.altHint}
          </span>
        </span>
      )}
    </span>
  );
}
