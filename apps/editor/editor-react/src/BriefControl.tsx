import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import { BRIEF_MAX_LENGTH } from "@blog-editor/content-schema";
import { imageToPlaceholder, setBrief } from "@blog-editor/editor-core";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";
import { COMPOSING_KEY_CODE } from "./ime.constants";
import { useCommandRunner } from "./use-command-runner";

export interface BriefControlProps {
  editor: Editor;
  /** 노드로 고른 그림 · 사진 자리의 위치 */
  pos: number;
  /** 지금 사진 설명 — 그림은 없을 수 있다 */
  brief: string | null;
  /** 그림이면 「사진 자리로 되돌리기」를 보인다(설명이 있을 때만) */
  canRevert: boolean;
}

/**
 * 「사진 설명」 버튼과 입력칸(adr-033) — 에디터에만 보이는 설명을 보고 고친다. 버튼에 설명 앞부분을 함께 보여 그림을
 * 고르기만 해도 어떤 사진이었는지 보인다. Enter로 적용 · Esc로 닫는다. 대체 텍스트 입력(ImageAltControl)과 같은 틀이다.
 */
export function BriefControl({ editor, pos, brief, canRevert }: BriefControlProps) {
  const run = useCommandRunner(editor);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(brief ?? "");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    if (!open) return;
    setValue(brief ?? "");
    inputRef.current?.focus();
  }, [open, brief]);

  // 도구줄은 눌러도 편집 영역 선택이 풀리지 않게 mousedown을 막는다 — 입력칸은 초점을 받아야 해서 전파를 끊는다
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
    // 한글 조합 중 Enter는 조합 확정이다 — 적용하지 않는다(ImageAltControl과 같은 이유)
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === COMPOSING_KEY_CODE) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeToButton();
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(setBrief(pos, value));
      closeToButton();
    }
  };

  return (
    <span className="brief-control">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {IMAGE_INSERT_MESSAGES.briefButton}
        {brief !== null && <span className="brief-control-preview">{brief}</span>}
      </button>
      {open && (
        <span ref={popoverRef} className="brief-popover">
          <label htmlFor={inputId}>{IMAGE_INSERT_MESSAGES.briefLabel}</label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={value}
            maxLength={BRIEF_MAX_LENGTH}
            aria-describedby={hintId}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <span id={hintId} className="brief-hint">
            {IMAGE_INSERT_MESSAGES.briefHint}
          </span>
          {canRevert && brief !== null && (
            <button type="button" onClick={() => run(imageToPlaceholder(pos))}>
              {IMAGE_INSERT_MESSAGES.toPlaceholder}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
