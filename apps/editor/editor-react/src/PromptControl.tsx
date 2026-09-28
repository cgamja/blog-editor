import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import { PROMPT_MAX_LENGTH } from "@blog-editor/content-schema";
import { setPrompt } from "@blog-editor/editor-core";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";
import { COMPOSING_KEY_CODE } from "./ime.constants";
import { promptCopyText } from "./photo-prompt-model";
import { useCommandRunner } from "./use-command-runner";

export interface PromptControlProps {
  editor: Editor;
  /** 노드로 고른 그림 · 사진 자리의 위치 */
  pos: number;
  /** 지금 이미지 프롬프트 — 없을 수 있다 */
  prompt: string | null;
  /** 사진 자리 비율 — 있으면 복사할 때 ` --ar W:H`를 붙인다. 그림은 비율이 없다 */
  ratio: string | null;
}

type CopyStatus = "idle" | "copied" | "failed";

/**
 * 「이미지 프롬프트」 버튼과 입력칸(adr-043) — 에디터에만 보이는 영어 프롬프트를 보고 고치고, 「프롬프트 복사」로
 * 클립보드에 넣는다. 사람이 그 글로 Midjourney 등에서 사진을 만든다. Enter로 적용 · Esc로 닫는다. 사진 설명
 * 입력(BriefControl)과 같은 틀이다.
 */
export function PromptControl({ editor, pos, prompt, ratio }: PromptControlProps) {
  const run = useCommandRunner(editor);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(prompt ?? "");
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    if (!open) return;
    setValue(prompt ?? "");
    setCopyStatus("idle");
    inputRef.current?.focus();
  }, [open, prompt]);

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
    // 한글 조합 중 Enter는 조합 확정이다 — 적용하지 않는다(BriefControl과 같은 이유)
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === COMPOSING_KEY_CODE) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeToButton();
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(setPrompt(pos, value));
      closeToButton();
    }
  };

  // 입력칸에 보이는 글을 복사한다 — 적용 전에 고친 글도 그대로 이미지 도구로 가져갈 수 있게
  const copyText = value.trim();
  const copy = () => {
    const failed = () => setCopyStatus("failed");
    try {
      // 누른 그 자리에서 부른다 — Safari는 사용자 동작 밖의 클립보드 쓰기를 거절한다
      navigator.clipboard
        .writeText(promptCopyText(copyText, ratio))
        .then(() => setCopyStatus("copied"), failed);
    } catch {
      // 보안 문맥이 아니면(http) navigator.clipboard가 없다
      failed();
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
        {IMAGE_INSERT_MESSAGES.promptButton}
      </button>
      {open && (
        <span ref={popoverRef} className="brief-popover">
          <label htmlFor={inputId}>{IMAGE_INSERT_MESSAGES.promptLabel}</label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            lang="en"
            value={value}
            maxLength={PROMPT_MAX_LENGTH}
            aria-describedby={hintId}
            onChange={(event) => {
              setValue(event.target.value);
              setCopyStatus("idle");
            }}
            onKeyDown={onKeyDown}
          />
          <span id={hintId} className="brief-hint">
            {IMAGE_INSERT_MESSAGES.promptHint}
          </span>
          {copyText !== "" && (
            <button type="button" onClick={copy}>
              {IMAGE_INSERT_MESSAGES.copyPrompt}
            </button>
          )}
          <span role="status" className="brief-hint">
            {copyStatus === "copied" && IMAGE_INSERT_MESSAGES.promptCopied}
            {copyStatus === "failed" && IMAGE_INSERT_MESSAGES.promptCopyFailed}
          </span>
        </span>
      )}
    </span>
  );
}
