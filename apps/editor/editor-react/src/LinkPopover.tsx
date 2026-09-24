import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { removeLink, setLink } from "@blog-editor/editor-core";
import { LINK_MESSAGES } from "./messages";
import { useCommandRunner } from "./use-command-runner";
import { useCloseOnOutsidePointer, useEscapeKey } from "./use-dismiss";

export interface LinkPopoverProps {
  editor: Editor;
  /** 팝오버 좌표의 기준(BlogEditor 바깥 틀, position: relative) */
  frameRef: RefObject<HTMLDivElement | null>;
}

interface Opened {
  top: number;
  left: number;
  /** 커서가 이미 링크 안이면 그 주소 — 「링크 빼기」를 보인다 */
  href: string;
}

// 선택 글자 바로 아래에 띄운다 — 디자인 68:2 인라인 툴바와 글자 사이 간격
const GAP_BELOW_TEXT = 8;

const isLinkShortcut = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === "k";

function hrefAtSelection(editor: Editor): string {
  const { state } = editor;
  const mark = state.schema.marks.link?.isInSet(state.selection.$from.marks());
  return mark === undefined ? "" : String(mark.attrs.href);
}

/**
 * ⌘K 링크 입력(Notion). window.prompt 대신 선택 아래 작은 폼을 띄운다(markdown-shortcuts design.md 7).
 * 주소 검증은 editor-core setLink(hrefSchema 허용 목록) 하나다 — 거절되면 이유를 폼 안에 보인다.
 * 폼에 포커스가 가도 선택은 EditorState에 남아 적용 대상이 바뀌지 않는다.
 */
export function LinkPopover({ editor, frameRef }: LinkPopoverProps) {
  const run = useCommandRunner(editor);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const close = useCallback(() => setOpened(null), []);
  const closeToEditor = useCallback(() => {
    setOpened(null);
    editor.view.focus();
  }, [editor]);
  const insideRefs = useMemo(() => [formRef], []);
  useEscapeKey(opened !== null, closeToEditor);
  useCloseOnOutsidePointer(opened !== null, insideRefs, close);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isLinkShortcut(event) || !editor.view.dom.contains(event.target as Node)) return;
      event.preventDefault();
      // 고른 글자도, 커서가 든 링크도 없으면 걸 대상이 없다 — removeLink(dispatch 없이)가 "링크 안인가"를 답한다
      if (editor.view.composing || (editor.state.selection.empty && !removeLink(editor.state))) {
        return;
      }
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      const origin = frame.getBoundingClientRect();
      const href = hrefAtSelection(editor);
      setOpened({
        top: coords.bottom - origin.top + GAP_BELOW_TEXT,
        left: coords.left - origin.left,
        href,
      });
      setValue(href);
      setInvalid(false);
    };
    frame.addEventListener("keydown", onKeyDown);
    return () => frame.removeEventListener("keydown", onKeyDown);
  }, [editor, frameRef]);

  useEffect(() => {
    if (opened !== null) inputRef.current?.select();
  }, [opened]);

  if (opened === null) return null;

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
      style={{ top: opened.top, left: opened.left }}
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
      {opened.href !== "" && (
        <button type="button" className="link-popover-remove" onClick={unlink}>
          {LINK_MESSAGES.remove}
        </button>
      )}
    </form>
  );
}
