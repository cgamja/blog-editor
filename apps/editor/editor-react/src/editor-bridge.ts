import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import type { Doc } from "@blog-editor/content-schema";
import {
  docToNode,
  isDocumentReplacement,
  replaceDocument,
  selectBlock,
} from "@blog-editor/editor-core";

/**
 * 화면(web)이 에디터를 다루는 좁은 길 — TipTap은 editor-core · editor-react 밖으로 나가지 않는다(adr-009).
 * web은 `useBlogEditor`가 준 에디터를 이 함수들로만 만진다.
 */
export type BlogEditorInstance = Editor;

/** 문서가 어떻게 바뀌었나 — `isReplacement`면 사람의 고침이 아니라 다른 곳의 판으로 바꿔 끼운 것이다 */
export interface DocChange {
  isReplacement: boolean;
}

/**
 * 문서가 바뀔 때마다 부른다(TipTap `update` 이벤트 — 선택만 바뀐 트랜잭션은 빠진다).
 * https://tiptap.dev/docs/editor/api/events#update
 */
export function useDocChange(editor: Editor, onChange: (change: DocChange) => void): void {
  useEffect(() => {
    const handleUpdate = ({ transaction }: { transaction: Transaction }) =>
      onChange({ isReplacement: isDocumentReplacement(transaction) });
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, onChange]);
}

/**
 * 다른 곳에서 바뀐 초안으로 본문을 바꿔 끼우고 `changed` 번호(0부터)의 최상위 블록을 잠깐 칠한다
 * (editor-core `replaceDocument` — 되돌리기 기록에 넣지 않는다). 조합 중에는 부르지 않는다(부르는 쪽이 미룬다).
 * @throws 닫힌 집합을 어기는 문서
 */
export function replaceEditorDoc(editor: Editor, doc: Doc, changed: readonly number[]): void {
  const { view } = editor;
  replaceDocument(docToNode(view.state.schema, doc), changed)(view.state, view.dispatch);
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

/**
 * 최상위 `index`번째(0부터) 블록으로 선택을 옮기고(editor-core `selectBlock` — 글 블록은 안쪽 커서, 그림은 노드 선택)
 * 그 자리를 보이게 스크롤한 뒤 편집 영역에 포커스한다 — 검색 노출 점검이 가리키는 블록으로 간다. 없는 블록이면 아무것도 안 한다.
 * 스크롤: https://prosemirror.net/docs/ref/#state.Transaction.scrollIntoView · 포커스: https://prosemirror.net/docs/ref/#view.EditorView.focus
 */
export function focusEditorBlock(editor: Editor, index: number): void {
  const { view } = editor;
  const moved = selectBlock(index)(view.state, (tr) => view.dispatch(tr.scrollIntoView()));
  if (moved) view.focus();
}
