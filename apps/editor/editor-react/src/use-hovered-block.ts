import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { blockIndexAt } from "@blog-editor/editor-core";
import { measureBlocks } from "./block-geometry";

/** 버튼 세로 자리 — 본문 첫 줄(17px × 1.85)의 가운데에 44px 버튼을 맞춘다(디자인 top -6px). */
const HANDLE_OFFSET_Y = -6;

export interface HoveredBlock {
  index: number;
  /** 틀(frame) 기준 좌표 */
  top: number;
  left: number;
}

/**
 * 마우스를 올린 최상위 블록 — 틀 안 어디서든(손잡이 위 포함, 손잡이는 틀의 자손이다).
 * `frozen`(끄는 중 · 메뉴 열림)이면 지금 블록을 붙잡고 따라가지 않는다.
 * 글을 고치면 블록 자리가 바뀌니 옛 좌표의 손잡이를 지운다.
 */
export function useHoveredBlock(
  editor: Editor,
  frameRef: RefObject<HTMLDivElement | null>,
  frozen: boolean,
): [HoveredBlock | null, (value: HoveredBlock | null) => void] {
  const [hovered, setHovered] = useState<HoveredBlock | null>(null);

  useEffect(() => {
    const frameEl = frameRef.current;
    if (frozen || frameEl === null) return undefined;
    const onMove = (event: PointerEvent) => {
      const { bands, frame, lefts } = measureBlocks(editor, frameEl);
      const index = blockIndexAt(bands, event.clientY);
      setHovered(
        index === null
          ? null
          : { index, top: bands[index]!.top - frame.top + HANDLE_OFFSET_Y, left: lefts[index]! },
      );
    };
    const onLeave = () => setHovered(null);
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) setHovered(null);
    };
    frameEl.addEventListener("pointermove", onMove);
    frameEl.addEventListener("pointerleave", onLeave);
    editor.on("transaction", onTransaction);
    return () => {
      frameEl.removeEventListener("pointermove", onMove);
      frameEl.removeEventListener("pointerleave", onLeave);
      editor.off("transaction", onTransaction);
    };
  }, [editor, frameRef, frozen]);

  return [hovered, setHovered];
}
