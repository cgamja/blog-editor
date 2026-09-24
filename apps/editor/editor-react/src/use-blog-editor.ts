import { useMemo } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import type { Doc } from "@blog-editor/content-schema";
import { blogEditorExtensions } from "./extensions";
import { readDoc, toEditorContent } from "./content";

export interface BlogEditorHandle {
  editor: Editor;
  /** @throws 닫힌 집합을 어기는 문서(blockGuard가 편집 중 막지만 마지막 방어선은 zod다) */
  getDoc: () => Doc;
}

/**
 * 블로그 에디터 한 벌. `doc`이 바뀌면 에디터를 새로 만든다(deps).
 * 초기 문서가 닫힌 집합을 어기면 던진다 — 부르는 쪽이 오류를 보여 준다(content.ts).
 * https://tiptap.dev/docs/editor/getting-started/install/react
 */
export function useBlogEditor(doc: unknown): BlogEditorHandle {
  const content = useMemo(() => toEditorContent(doc), [doc]);
  const extensions = useMemo(() => blogEditorExtensions(), []);
  const editor = useEditor({ extensions, content }, [content]);
  return { editor, getDoc: () => readDoc(editor.state.doc) };
}
