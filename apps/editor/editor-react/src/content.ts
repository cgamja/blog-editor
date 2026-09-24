import type { Node } from "@tiptap/pm/model";
import type { Doc } from "@blog-editor/content-schema";
import { createEditorSchema, docFromNode, docToNode } from "@blog-editor/editor-core";

/**
 * 에디터 초기 content. 반드시 docToNode(zod)를 지난다 — blockGuard는 이전 문서가 무효면 꺼지므로
 * 무효 문서가 에디터에 들어가면 세션 내내 가드가 없다(spec: editor-block-guard).
 * @throws 닫힌 집합을 어기는 문서
 */
export function toEditorContent(doc: unknown): Record<string, unknown> {
  return docToNode(createEditorSchema(), doc).toJSON() as Record<string, unknown>;
}

/**
 * 저장할 문서. @throws 닫힌 집합을 어기는 문서
 */
export function readDoc(node: Node): Doc {
  return docFromNode(node);
}
