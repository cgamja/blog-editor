import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { RefObject } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { BlockRect } from "@blog-editor/editor-core";
import { measureBlocks, measureStickers } from "./sticker-measure";
import type { LayerPoint, StickerBox } from "./sticker-types";

export interface StickerLayout {
  layerRef: RefObject<HTMLDivElement | null>;
  boxes: StickerBox[];
  /** 지금 블록 사각형(레이어 기준) — 놓을 자리를 셀 때마다 새로 잰다 */
  measureBlocksNow: () => BlockRect[];
  /** client 좌표 → 레이어 기준 */
  toLayerPoint: (clientX: number, clientY: number) => LayerPoint;
}

/**
 * 스티커 자리를 레이어 기준 px로 잰다. 레이어와 본문은 같이 스크롤되므로 스크롤로는 값이 바뀌지 않고,
 * 문서 · 글꼴 · 이미지 로드 · 창 크기가 바뀔 때만 다시 잰다.
 * 에디터가 마운트되기 전(isInitialized 전)에는 view.dom이 없다 — https://tiptap.dev/docs/editor/api/events#create
 */
export function useStickerLayout(editor: Editor): StickerLayout {
  const layerRef = useRef<HTMLDivElement>(null);
  const doc = useEditorState({ editor, selector: ({ editor: current }) => current.state.doc });
  const [layoutVersion, relayout] = useReducer((version: number) => version + 1, 0);
  const [boxes, setBoxes] = useState<StickerBox[]>([]);

  const origin = useCallback(
    () => layerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 },
    [],
  );

  useLayoutEffect(() => {
    if (layerRef.current === null || !editor.isInitialized) return;
    setBoxes(measureStickers(editor.view, origin()));
  }, [editor, origin, doc, layoutVersion]);

  useEffect(() => {
    let detach = () => {};
    const attach = () => {
      const dom = editor.view.dom;
      const observer = new ResizeObserver(relayout);
      observer.observe(dom);
      dom.addEventListener("load", relayout, true);
      window.addEventListener("resize", relayout);
      detach = () => {
        observer.disconnect();
        dom.removeEventListener("load", relayout, true);
        window.removeEventListener("resize", relayout);
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

  const measureBlocksNow = useCallback(
    () => measureBlocks(editor.view, origin()),
    [editor, origin],
  );
  const toLayerPoint = useCallback(
    (clientX: number, clientY: number) => {
      const { left, top } = origin();
      return { x: clientX - left, y: clientY - top };
    },
    [origin],
  );

  return { layerRef, boxes, measureBlocksNow, toLayerPoint };
}
