import type { Node } from "@tiptap/pm/model";

/**
 * 목록 노드를 읽는다 — 목록 커맨드(task-list.ts)와 목록 키(list-keymap.ts)가 같은 판정을 쓰게 한 곳에 둔다
 * (spec: editor-list-keys · editor-task-list).
 */

const LIST_TYPES: readonly string[] = ["bulletList", "orderedList"];

/** 점 목록 · 번호 목록인가 */
export const isList = (node: Node | null | undefined): node is Node =>
  node != null && LIST_TYPES.includes(node.type.name);

/** 할 일 항목인가 — 체크 여부는 목록 항목 attrs `checked`다(값 없음 = 보통 항목, adr-036) */
export const isTaskItem = (node: Node): boolean =>
  node.type.name === "listItem" && node.attrs.checked != null;
