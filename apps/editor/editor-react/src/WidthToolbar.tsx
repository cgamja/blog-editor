import { useLayoutEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { setBlockWidth } from "@blog-editor/editor-core";
import { WIDTH_PRESETS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { widthTargetOf } from "./decoration-state";
import { useCommandRunner } from "./use-command-runner";

export interface WidthToolbarProps {
  editor: Editor;
}

interface Anchor {
  left: number;
  top: number;
}

/**
 * 그림 · 앱 스크린샷을 노드로 골랐을 때 블록 위 가운데에 뜨는 폭 도구줄(디자인 69:2, spec: decoration-panel).
 * 부르는 쪽은 에디터와 이 도구줄을 `position: relative` 상자 하나에 함께 둔다 — 위치를 그 상자 기준으로 잰다.
 */
export function WidthToolbar({ editor }: WidthToolbarProps) {
  const target = useEditorState({
    editor,
    selector: ({ editor: current }) => widthTargetOf(current.state),
  });
  const run = useCommandRunner(editor);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // 대상 · 폭이 바뀔 때 붙인다(속성이 바뀌면 ProseMirror가 블록 DOM을 새로 그린다). 그 뒤로는
  // 블록 · 기준 상자의 크기 변화(이미지 로드 · 창 크기)와 안쪽 스크롤 상자의 스크롤(capture —
  // scroll은 버블링하지 않는다)마다 다시 잰다
  useLayoutEffect(() => {
    if (target === null) return undefined;
    // https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM
    const block = editor.view.nodeDOM(target.pos);
    const frame = toolbarRef.current?.offsetParent;
    if (!(block instanceof HTMLElement) || !(frame instanceof HTMLElement)) return undefined;
    const measure = () => {
      const blockRect = block.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      setAnchor({
        left: blockRect.left - frameRect.left + blockRect.width / 2,
        top: blockRect.top - frameRect.top,
      });
    };
    measure();
    // https://developer.mozilla.org/docs/Web/API/ResizeObserver
    const observer = new ResizeObserver(measure);
    observer.observe(block);
    observer.observe(frame);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, { capture: true });
    };
  }, [editor, target?.pos, target?.value]);

  if (target === null) return null;

  return (
    <div
      ref={toolbarRef}
      className="width-toolbar"
      role="toolbar"
      aria-label={decorationMessages.widthToolbarLabel}
      style={anchor === null ? { visibility: "hidden" } : { left: anchor.left, top: anchor.top }}
      // 누르는 동안 편집 영역의 노드 선택이 풀리지 않게 한다
      onMouseDown={(event) => event.preventDefault()}
    >
      {WIDTH_PRESETS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={target.value === value}
          onClick={() => run(setBlockWidth(value))}
        >
          {label}
        </button>
      ))}
      <span className="width-toolbar-value">{decorationMessages.widthValue(target.value)}</span>
    </div>
  );
}
