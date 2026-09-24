/**
 * 그림의 대체 텍스트 — spec: editor-image-insert, image-insert design.md 4.
 * Transaction.setNodeAttribute: https://prosemirror.net/docs/ref/#state.Transaction.setNodeAttribute
 */
import type { Command } from "@tiptap/pm/state";
import { ALT_MAX_LENGTH } from "@blog-editor/content-schema";

/** pos의 image 노드 alt만 바꾼다. 한도를 넘거나 그림이 아니면 false, 같은 값이면 dispatch 없이 true(#62 관례) */
export function setImageAlt(pos: number, alt: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node === null || node.type.name !== "image" || alt.length > ALT_MAX_LENGTH) return false;
    if (node.attrs.alt !== alt) dispatch?.(state.tr.setNodeAttribute(pos, "alt", alt));
    return true;
  };
}
