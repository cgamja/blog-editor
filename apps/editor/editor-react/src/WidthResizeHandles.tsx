import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { Node } from "@tiptap/pm/model";
import { previewBlockWidth, resizedWidthPercent, setBlockWidth } from "@blog-editor/editor-core";
import type { WidthDrag } from "@blog-editor/editor-core";
import { decorationMessages } from "./decoration-messages";
import { widthTargetOf } from "./decoration-state";
import { useCommandRunner } from "./use-command-runner";
import { useEscapeKey } from "./use-dismiss";

type Side = WidthDrag["side"];

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Resize extends Omit<WidthDrag, "x"> {
  pos: number;
  value: number;
  /** 끌기를 시작할 때의 문서 — 끄는 사이 문서가 바뀌면 놓지 않는다 */
  doc: Node;
}

const SIDES: readonly Side[] = ["left", "right"];
const PERCENT = 100;

/**
 * 그림 · 앱 스크린샷을 노드로 골랐을 때 좌우 가장자리에 뜨는 폭 손잡이(Notion의 이미지 크기 조절, 이슈 #81).
 * 끄는 동안은 editor-core 폭 미리보기 장식만 바꾸고, 놓을 때 setBlockWidth를 한 번 부른다
 * (block-controls design.md 6). 포인터 전용이다 — 키보드는 폭 도구줄(작게 · 보통 · 꽉 차게)이 맡는다.
 * 부르는 쪽은 에디터와 이 손잡이를 `position: relative` 틀 하나에 함께 둔다 — 위치를 그 틀 기준으로 잰다.
 */
export function WidthResizeHandles({ editor }: { editor: Editor }) {
  const target = useEditorState({
    editor,
    selector: ({ editor: current }) => widthTargetOf(current.state),
  });
  const run = useCommandRunner(editor);
  const layerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [resize, setResize] = useState<Resize | null>(null);

  // 잴 때마다 블록 DOM을 다시 구한다 — 미리보기 장식 · 속성이 바뀌면 ProseMirror가 DOM을 새로 그린다(WidthToolbar와 같다)
  useLayoutEffect(() => {
    if (target === null) return undefined;
    const offsetParent = layerRef.current?.offsetParent;
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
      const rect = block.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      setBox({
        left: rect.left - frameRect.left,
        top: rect.top - frameRect.top,
        width: rect.width,
        height: rect.height,
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

  const cancel = useCallback(() => {
    if (resize !== null) run(previewBlockWidth(resize.pos, null));
    setResize(null);
  }, [resize, run]);
  useEscapeKey(resize !== null, cancel);

  if (target === null) return null;

  const onPointerDown = (side: Side) => (event: PointerEvent<HTMLSpanElement>) => {
    // 주 버튼만. 한글 조합 중에는 문서를 바꾸는 일을 시작하지 않는다(.claude/rules/editor.md)
    if (event.button !== 0 || box === null || editor.view.composing) return;
    // 그림의 노드 선택이 풀리지 않게 — 폭은 선택된 블록에 적용된다
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResize({
      pos: target.pos,
      side,
      startX: event.clientX,
      startPercent: target.value,
      // 지금 보이는 폭이 value%이니 100%는 그 비율로 거꾸로 구한다
      containerWidth: (box.width * PERCENT) / target.value,
      value: target.value,
      doc: editor.state.doc,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (resize === null) return;
    const value = resizedWidthPercent({ ...resize, x: event.clientX });
    if (value === resize.value) return;
    setResize({ ...resize, value });
    run(previewBlockWidth(resize.pos, value));
  };

  const onPointerUp = () => {
    if (resize === null) return;
    const { pos, value, startPercent, doc } = resize;
    setResize(null);
    const unchanged = editor.state.doc === doc && !editor.view.composing;
    // 폭이 바뀌면 문서가 바뀌어 미리보기는 스스로 풀린다(width-preview). 그대로면 미리보기만 푼다
    if (unchanged && value !== startPercent) run(setBlockWidth(value));
    else run(previewBlockWidth(pos, null));
  };

  return (
    <div ref={layerRef} className="width-resize" data-resizing={resize !== null || undefined}>
      {box !== null &&
        SIDES.map((side) => (
          <span
            key={side}
            className="width-resize-handle"
            data-side={side}
            aria-hidden="true"
            style={{
              top: box.top + box.height / 2,
              left: side === "left" ? box.left : box.left + box.width,
            }}
            onPointerDown={onPointerDown(side)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancel}
            onLostPointerCapture={() => resize !== null && cancel()}
          />
        ))}
      {box !== null && resize !== null && (
        <span
          className="width-resize-value"
          style={{ top: box.top + box.height, left: box.left + box.width / 2 }}
          aria-hidden="true"
        >
          {decorationMessages.widthValue(resize.value)}
        </span>
      )}
    </div>
  );
}
