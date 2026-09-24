import { useEffect, useLayoutEffect, useReducer, useRef, useState, type RefObject } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { measureStickers, type StickerBox } from "./sticker-measure";

export interface StickerLayout {
  layerRef: RefObject<HTMLDivElement | null>;
  boxes: StickerBox[];
  /** client 좌표 → 오버레이 안 좌표. 잴 때마다 새로 읽어 스크롤 중에도 어긋나지 않는다 */
  toLocal: (x: number, y: number) => { left: number; top: number };
}

/**
 * 스티커 자리를 잰다. 문서가 바뀔 때, 그리고 문서 밖 이유(글꼴 · 이미지 로드 · 창 크기 · 스크롤)로
 * 블록 자리가 바뀔 때 다시 잰다. 에디터가 마운트되기 전(isInitialized 전)에는 view.dom이 없다.
 * https://tiptap.dev/docs/editor/api/events#create
 */
export function useStickerLayout(editor: Editor): StickerLayout {
  const layerRef = useRef<HTMLDivElement>(null);
  const doc = useEditorState({ editor, selector: ({ editor: current }) => current.state.doc });
  const [layoutVersion, relayout] = useReducer((version: number) => version + 1, 0);
  const [boxes, setBoxes] = useState<StickerBox[]>([]);

  useLayoutEffect(() => {
    if (layerRef.current === null || !editor.isInitialized) return;
    setBoxes(measureStickers(editor.view));
  }, [editor, doc, layoutVersion]);

  useEffect(() => {
    let detach = () => {};
    const attach = () => {
      const dom = editor.view.dom;
      const observer = new ResizeObserver(relayout);
      observer.observe(dom);
      dom.addEventListener("load", relayout, true);
      window.addEventListener("resize", relayout);
      window.addEventListener("scroll", relayout, { capture: true, passive: true });
      detach = () => {
        observer.disconnect();
        dom.removeEventListener("load", relayout, true);
        window.removeEventListener("resize", relayout);
        window.removeEventListener("scroll", relayout, { capture: true });
      };
      relayout();
    };
    if (editor.isInitialized) attach();
    else editor.on("create", attach);
    return () => {
      editor.off("create", attach);
      detach();
    };
  }, [editor]);

  const toLocal = (x: number, y: number) => {
    const origin = layerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { left: x - origin.left, top: y - origin.top };
  };

  return { layerRef, boxes, toLocal };
}
