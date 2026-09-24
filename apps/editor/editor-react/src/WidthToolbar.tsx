import { useLayoutEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { setBlockWidth } from "@blog-editor/editor-core";
import { WIDTH_PRESETS, widthTargetOf } from "./decoration-state";
import { useEditorCommand } from "./use-editor-command";

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
  const run = useEditorCommand(editor);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // 폭이 바뀌면 블록 크기도 바뀐다 — 그릴 때마다가 아니라 대상 · 값이 바뀔 때만 다시 잰다
  useLayoutEffect(() => {
    if (target === null) return undefined;
    const measure = () => {
      // https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM
      const block = editor.view.nodeDOM(target.pos);
      const frame = toolbarRef.current?.offsetParent;
      if (!(block instanceof HTMLElement) || !(frame instanceof HTMLElement)) return;
      const blockRect = block.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      setAnchor({
        left: blockRect.left - frameRect.left + blockRect.width / 2,
        top: blockRect.top - frameRect.top,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [editor, target?.pos, target?.value]);

  if (target === null) return null;

  return (
    <div
      ref={toolbarRef}
      className="width-toolbar"
      role="toolbar"
      aria-label="사진 폭"
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
      <span className="width-toolbar-value">가로 {target.value}%</span>
    </div>
  );
}
