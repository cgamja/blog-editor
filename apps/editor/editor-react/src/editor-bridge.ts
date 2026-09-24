import { useEffect } from "react";
import type { Editor } from "@tiptap/react";

/**
 * 화면(web)이 에디터를 다루는 좁은 길 — TipTap은 editor-core · editor-react 밖으로 나가지 않는다(adr-009).
 * web은 `useBlogEditor`가 준 에디터를 이 함수들로만 만진다.
 */
export type BlogEditorInstance = Editor;

/**
 * 문서가 바뀔 때마다 부른다(TipTap `update` 이벤트 — 선택만 바뀐 트랜잭션은 빠진다).
 * https://tiptap.dev/docs/editor/api/events#update
 */
export function useDocChange(editor: Editor, onChange: () => void): void {
  useEffect(() => {
    editor.on("update", onChange);
    return () => {
      editor.off("update", onChange);
    };
  }, [editor, onChange]);
}

/**
 * 한글 조합 중인가 — 조합 중에는 문서를 읽어 보내거나 바꾸는 부수 효과를 미룬다(CLAUDE.md).
 * 아직 DOM에 붙지 않은 에디터는 조합 중일 수 없다.
 * https://prosemirror.net/docs/ref/#view.EditorView.composing
 */
export function isEditorComposing(editor: Editor): boolean {
  return !editor.isDestroyed && editor.isInitialized && editor.view.composing;
}

/** 본문 글자만(블록 사이 빈 줄) — 충돌 때 클립보드 사본 */
export function editorPlainText(editor: Editor): string {
  return editor.getText({ blockSeparator: "\n\n" });
}

/** 본문 맨 앞에 커서 — 제목 칸에서 Enter */
export function focusEditorStart(editor: Editor): void {
  editor.commands.focus("start");
}
