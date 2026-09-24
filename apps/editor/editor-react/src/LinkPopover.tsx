import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { removeLink, setLink } from "@blog-editor/editor-core";
import { LINK_MESSAGES } from "./messages";
import { useCommandRunner } from "./use-command-runner";
import { useCloseOnOutsidePointer, useEscapeKey } from "./use-dismiss";
import { useLinkShortcut } from "./use-link-shortcut";

export interface LinkPopoverProps {
  editor: Editor;
  /** 팝오버 좌표의 기준(BlogEditor 바깥 틀, position: relative) */
  frameRef: RefObject<HTMLDivElement | null>;
}

/**
 * ⌘K 링크 입력 폼(Notion). window.prompt 대신 선택 아래 작은 폼을 띄운다(markdown-shortcuts design.md 7).
 * 주소 검증은 editor-core setLink(hrefSchema 허용 목록) 하나다 — 거절되면 이유를 폼 안에 보인다.
 * 폼에 포커스가 가도 선택은 EditorState에 남아 적용 대상이 바뀌지 않는다.
 */
export function LinkPopover({ editor, frameRef }: LinkPopoverProps) {
  const run = useCommandRunner(editor);
  const [anchor, setAnchor] = useLinkShortcut(editor, frameRef);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const close = useCallback(() => setAnchor(null), [setAnchor]);
  const closeToEditor = useCallback(() => {
    setAnchor(null);
    editor.view.focus();
  }, [editor, setAnchor]);
  const insideRefs = useMemo(() => [formRef], []);
  useEscapeKey(anchor !== null, closeToEditor);
  useCloseOnOutsidePointer(anchor !== null, insideRefs, close);

  // 열릴 때마다 입력칸을 선택 주소로 채우고 고른다 — 바로 새 주소를 칠 수 있게
  useEffect(() => {
    if (anchor === null) return;
    setValue(anchor.href);
    setInvalid(false);
    inputRef.current?.select();
  }, [anchor]);

  if (anchor === null) return null;

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (run(setLink(value.trim()))) closeToEditor();
    else setInvalid(true);
  };

  const unlink = () => {
    run(removeLink);
    closeToEditor();
  };

  return (
    <form
      ref={formRef}
      className="link-popover"
      aria-label={LINK_MESSAGES.dialog}
      style={{ top: anchor.top, left: anchor.left }}
      onSubmit={apply}
    >
      <label htmlFor={inputId}>{LINK_MESSAGES.address}</label>
      <div className="link-popover-row">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="url"
          autoComplete="off"
          value={value}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
        />
        <button type="submit">{LINK_MESSAGES.apply}</button>
      </div>
      {invalid && (
        <p id={errorId} className="link-popover-error" role="alert">
          {LINK_MESSAGES.invalid}
        </p>
      )}
      {anchor.href !== "" && (
        <button type="button" className="link-popover-remove" onClick={unlink}>
          {LINK_MESSAGES.remove}
        </button>
      )}
    </form>
  );
}
