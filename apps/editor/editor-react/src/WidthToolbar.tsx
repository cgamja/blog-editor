import { useLayoutEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { alignOf, setBlockAlign, setBlockWidth } from "@blog-editor/editor-core";
import { AlignIcon } from "./AlignIcon";
import { ALIGN_OPTIONS, WIDTH_PRESETS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { widthTargetOf } from "./decoration-state";
import { ImageAltControl } from "./ImageAltControl";
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
  // 정렬도 도구줄 대상(노드 선택한 그림 · 스크린샷)의 지금 모양 — 대상이 없으면 쓰이지 않는다
  const align = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { selection } = current.state;
      return selection instanceof NodeSelection ? alignOf(selection.node) : null;
    },
  });
  // 그림이면 대체 텍스트도 도구줄에서 넣는다(스크린샷은 캡션이라 대상이 아니다) — 아니면 null
  const imageAlt = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { selection } = current.state;
      return selection instanceof NodeSelection && selection.node.type.name === "image"
        ? String(selection.node.attrs.alt)
        : null;
    },
  });
  const run = useCommandRunner(editor);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // 잴 때마다 블록 DOM을 다시 구한다 — 같은 블록이라도 속성(폭 · 움직임 · 스티커)이 바뀌면 ProseMirror가
  // DOM을 새로 그리므로, 옛 DOM을 붙잡으면 도구줄이 튄다. 트랜잭션 · 크기 변화(이미지 로드 · 창 크기) ·
  // 안쪽 스크롤 상자의 스크롤(capture — scroll은 버블링하지 않는다)마다 다시 잰다
  useLayoutEffect(() => {
    if (target === null) return undefined;
    const offsetParent = toolbarRef.current?.offsetParent;
    if (!(offsetParent instanceof HTMLElement)) return undefined;
    const frame = offsetParent;
    const { pos } = target;
    let block: HTMLElement | null = null;
    // https://developer.mozilla.org/docs/Web/API/ResizeObserver
    const observer = new ResizeObserver(() => measure());
    function measure() {
      // https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM
      const current = editor.view.nodeDOM(pos);
      const next = current instanceof HTMLElement ? current : null;
      if (next !== block) {
        if (block !== null) observer.unobserve(block);
        if (next !== null) observer.observe(next);
        block = next;
      }
      if (block === null) return;
      const blockRect = block.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      setAnchor({
        left: blockRect.left - frameRect.left + blockRect.width / 2,
        top: blockRect.top - frameRect.top,
      });
    }
    observer.observe(frame);
    measure();
    // TipTap은 뷰가 새 상태를 그린 뒤 transaction 이벤트를 낸다 — https://tiptap.dev/docs/editor/api/events#transaction
    editor.on("transaction", measure);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      editor.off("transaction", measure);
      window.removeEventListener("scroll", measure, { capture: true });
    };
  }, [editor, target?.pos]);

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
      <span className="width-toolbar-divider" aria-hidden="true" />
      {ALIGN_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-label={decorationMessages.alignButton(label)}
          aria-pressed={align === value}
          onClick={() => run(setBlockAlign(value))}
        >
          <AlignIcon align={value} />
        </button>
      ))}
      {imageAlt !== null && (
        <>
          <span className="width-toolbar-divider" aria-hidden="true" />
          <ImageAltControl key={target.pos} editor={editor} pos={target.pos} alt={imageAlt} />
        </>
      )}
    </div>
  );
}
