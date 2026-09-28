import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { measureBlocks } from "./block-geometry";
import { blockFlagRows } from "./block-flag-rows";
import type { BlockFlag, BlockFlagRow } from "./block-flag-types";

/**
 * 본문 한 줄 높이(px) — 편집 영역의 계산된 line-height. 브라우저는 숫자 line-height도 px로 돌려준다
 * (https://developer.mozilla.org/docs/Web/API/Window/getComputedStyle#notes — resolved value). `normal`이면 모른다
 */
function lineHeightOf(element: HTMLElement): number | undefined {
  const value = Number.parseFloat(getComputedStyle(element).lineHeight);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * 점 줄의 자리 — 점 목록 · 문서(블록 높이가 바뀐다) · 창 크기 · 틀 · 편집 영역 크기(글꼴 · 그림이 늦게 그려질 때) ·
 * 편집 영역 안 그림 로드 · 실패가 있을 때마다 블록 DOM을 다시 잰다. 그림 로드 · 실패(깨진 그림 자리로 높이가 바뀐다)는
 * 편집 영역이 최소 높이 안에 남으면 어느 크기도 안 바뀌므로 따로 듣는다(`load` · `error`는 버블링하지 않아 캡처로 —
 * https://developer.mozilla.org/docs/Web/API/HTMLElement/load_event).
 * 틀 기준 좌표라 스크롤로는 바뀌지 않는다. 점 줄은 본문 칸(편집 영역) 오른쪽에서 시작하고,
 * 점이 쓸 오른쪽 끝은 틀을 감싼 종이(부모)의 오른쪽이다.
 */
export function useBlockFlagRows(
  editor: Editor,
  frameRef: RefObject<HTMLDivElement | null>,
  flags: readonly BlockFlag[],
): BlockFlagRow[] {
  const [rows, setRows] = useState<BlockFlagRow[]>([]);

  useLayoutEffect(() => {
    const frameEl = frameRef.current;
    if (frameEl === null || flags.length === 0) {
      setRows([]);
      return undefined;
    }
    const measure = () => {
      if (editor.isDestroyed) return;
      const { bands, frame, lefts, rights } = measureBlocks(editor, frameEl);
      const paperRight = frameEl.parentElement?.getBoundingClientRect().right ?? frame.right;
      const columnRight = editor.view.dom.getBoundingClientRect().right - frame.left;
      setRows(
        blockFlagRows(flags, {
          bands,
          lefts,
          rights,
          columnRight,
          frameTop: frame.top,
          frameWidth: paperRight - frame.left,
          lineHeight: lineHeightOf(editor.view.dom),
        }),
      );
    };
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) measure();
    };
    const content = editor.view.dom;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frameEl);
    observer.observe(content);
    window.addEventListener("resize", measure);
    content.addEventListener("load", measure, true);
    content.addEventListener("error", measure, true);
    editor.on("transaction", onTransaction);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      content.removeEventListener("load", measure, true);
      content.removeEventListener("error", measure, true);
      editor.off("transaction", onTransaction);
    };
  }, [editor, frameRef, flags]);

  return rows;
}
