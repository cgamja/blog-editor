import { useState } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import type { Doc } from "@blog-editor/content-schema";
import { blogEditorExtensions } from "./extensions";
import { readDoc, toEditorContent } from "./content";

export interface BlogEditorOptions {
  /** 초기 문서. 마운트 때 한 번만 읽는다 — 참조가 바뀌어도 에디터를 다시 만들지 않는다 */
  doc: unknown;
  /** 이 값이 바뀔 때만 에디터를 새로 만든다(예: 글 id). 같은 key면 편집 중 상태를 지킨다 */
  key: string;
  /** 편집 영역(contenteditable) 자체의 접근성 이름 */
  label: string;
}

export interface BlogEditorHandle {
  editor: Editor;
  /** @throws 닫힌 집합을 어기는 문서(blockGuard가 편집 중 막지만 마지막 방어선은 zod다) */
  getDoc: () => Doc;
}

/**
 * 블로그 에디터 한 벌. 편집 중인 문서의 진실은 EditorState 하나다(adr-006) — 부모가 넘기는 doc이 저장 뒤
 * 새 객체로 바뀌어도 에디터를 다시 만들면 커서 · undo가 날아가므로, 다시 만드는 조건은 명시적인 `key`뿐이다.
 * 초기 문서가 닫힌 집합을 어기면 던진다 — 부르는 쪽이 오류를 보여 준다(content.ts).
 * https://tiptap.dev/docs/editor/getting-started/install/react
 */
export function useBlogEditor({ doc, key, label }: BlogEditorOptions): BlogEditorHandle {
  // key가 바뀔 때만 초기 content를 다시 읽는다 — 렌더 중 상태 갱신(React 공식 패턴: 이전 key 저장)
  const [initial, setInitial] = useState(() => ({ key, content: toEditorContent(doc) }));
  if (initial.key !== key) setInitial({ key, content: toEditorContent(doc) });

  const editor = useEditor(
    {
      extensions: blogEditorExtensions(),
      content: initial.content,
      editorProps: { attributes: { "aria-label": label } },
    },
    [initial.key],
  );
  return { editor, getDoc: () => readDoc(editor.state.doc) };
}
