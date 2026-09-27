import { useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import type { SeoTarget } from "@blog-editor/content-schema";
import { focusEditorBlock, focusEditorStart } from "@blog-editor/editor-react";
import type { BlogEditorInstance, SideTab } from "@blog-editor/editor-react";

/**
 * 검색 노출 발견이 가리키는 곳으로 간다(#151) — 블록이면 본문 편집기의 그 블록 안, 메타면 그 입력 칸.
 * 설명 · 핵심 검색어 칸은 옆 패널 「글 정보」 탭에 있어, 가려져 있으면 탭을 먼저 연 뒤(동기로 그려) 포커스한다.
 */
export function useSeoJump(editor: BlogEditorInstance, openTab: (tab: SideTab) => void) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const keywordRef = useRef<HTMLInputElement>(null);

  const jumpTo = useCallback(
    (target: SeoTarget) => {
      if (target.kind === "block") {
        focusEditorBlock(editor, target.block - 1);
        return;
      }
      if (target.kind === "body") {
        focusEditorStart(editor);
        return;
      }
      if (target.field === "title") {
        titleRef.current?.focus();
        return;
      }
      // hidden 패널 안 칸은 포커스를 받지 못한다 — 탭을 그린 뒤 옮긴다
      flushSync(() => openTab("postInfo"));
      (target.field === "description" ? descriptionRef : keywordRef).current?.focus();
    },
    [editor, openTab],
  );

  return {
    jumpTo,
    fieldRefs: { title: titleRef, description: descriptionRef, keyword: keywordRef },
  };
}
