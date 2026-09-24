import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { hasLinkTarget, linkHrefAt } from "@blog-editor/editor-core";

export interface LinkPopoverAnchor {
  /** 기준 틀 안 좌표 */
  top: number;
  left: number;
  /** 선택에 이미 걸린 링크 주소, 없으면 "" */
  href: string;
}

// 선택 글자 바로 아래에 띄운다 — 디자인 68:2 인라인 툴바와 글자 사이 간격
const GAP_BELOW_TEXT = 8;

/**
 * ⌘K(Ctrl+K). 한글 입력 상태에서는 event.key가 "ㅏ"라 물리 키(event.code)도 본다.
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
 */
const isLinkShortcut = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  !event.shiftKey &&
  (event.code === "KeyK" || event.key.toLowerCase() === "k");

/**
 * 편집 영역에서 ⌘K를 받아 링크 팝오버를 열 자리를 돌려준다. 걸 대상(고른 글자 · 링크 안 커서)이 없거나
 * 한글 조합 중이면 열지 않는다. 키는 frame에서 받는다 — 편집 영역 밖(팝오버 등)의 ⌘K는 무시한다.
 * onOpen은 자리를 정하는 같은 이벤트 안에서 불러, 폼 상태가 한 번의 렌더로 함께 바뀌게 한다.
 */
export function useLinkShortcut(
  editor: Editor,
  frameRef: RefObject<HTMLDivElement | null>,
  onOpen: (anchor: LinkPopoverAnchor) => void,
): [LinkPopoverAnchor | null, (anchor: LinkPopoverAnchor | null) => void] {
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);
  const [anchor, setAnchor] = useState<LinkPopoverAnchor | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isLinkShortcut(event) || !editor.view.dom.contains(event.target as Node)) return;
      event.preventDefault();
      if (editor.view.composing || !hasLinkTarget(editor.state)) return;
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      const origin = frame.getBoundingClientRect();
      const opened = {
        top: coords.bottom - origin.top + GAP_BELOW_TEXT,
        left: coords.left - origin.left,
        href: linkHrefAt(editor.state) ?? "",
      };
      onOpenRef.current(opened);
      setAnchor(opened);
    };
    frame.addEventListener("keydown", onKeyDown);
    return () => frame.removeEventListener("keydown", onKeyDown);
  }, [editor, frameRef]);

  return [anchor, setAnchor];
}
