import type { Editor } from "@tiptap/react";
import type { BlockBand } from "@blog-editor/editor-core";

export interface MeasuredBlocks {
  bands: BlockBand[];
  frame: DOMRect;
  /** 최상위 블록 각각의 틀 기준 left */
  lefts: number[];
}

/** 최상위 블록마다 화면 사각형을 읽는다 — https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM */
export function measureBlocks(editor: Editor, frameEl: HTMLElement): MeasuredBlocks {
  const { view } = editor;
  const frame = frameEl.getBoundingClientRect();
  const bands: BlockBand[] = [];
  const lefts: number[] = [];
  let pos = 0;
  view.state.doc.forEach((node) => {
    const dom = view.nodeDOM(pos);
    const previous = bands.at(-1)?.bottom ?? frame.top;
    if (dom instanceof HTMLElement) {
      const rect = dom.getBoundingClientRect();
      bands.push({ top: rect.top, bottom: rect.bottom });
      lefts.push(rect.left - frame.left);
    } else {
      bands.push({ top: previous, bottom: previous });
      lefts.push(0);
    }
    pos += node.nodeSize;
  });
  return { bands, frame, lefts };
}

/** gap 자리 표시선의 틀 기준 y — 두 블록 사이 가운데, 양 끝이면 블록 바깥 가장자리. */
export function dropLineTop(bands: readonly BlockBand[], gap: number, frameTop: number): number {
  const before = bands[gap - 1];
  const after = bands[gap];
  if (before === undefined) return (after?.top ?? frameTop) - frameTop;
  if (after === undefined) return before.bottom - frameTop;
  return (before.bottom + after.top) / 2 - frameTop;
}

export function autoScrollStep(pointerY: number, box: { top: number; bottom: number }): number {
  throw new Error(`미구현: ${pointerY} ${box.top}`);
}
