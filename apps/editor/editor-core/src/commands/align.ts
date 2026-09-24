import type { Node } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";
import type { ALIGNS } from "@blog-editor/content-schema";
import { alignOrNull } from "../closed-values";
import { canHoldDecoration, selectedTopBlocks } from "./decoration";

/**
 * 블록 정렬 — spec: editor-align, design.md. 꾸미기 커맨드(editor-decoration)와 같은 관례:
 * 선택이 걸친 최상위 블록 전부, 하나라도 자리가 없으면 거절, 집합 밖 값은 자르지 않고 false,
 * 이미 그 모양이면 true이되 dispatch 없음(https://prosemirror.net/docs/ref/#state.Command).
 */

type Align = (typeof ALIGNS)[number];

const ALIGN_KEY = "align";

/**
 * 속성이 없을 때 post.css가 그리는 모양 — 폭을 줄일 수 있는 블록(그림 · 앱 스크린샷)은 가운데 여백,
 * 글 블록은 왼쪽 글자(design.md 1). 이 값과 같으면 저장하지 않아 정규형이 하나로 남는다
 */
const defaultAlignOf = (node: Node): Align =>
  canHoldDecoration(node, "width") ? "center" : "left";

/** 지금 모양 — 저장값, 없으면 그 블록의 기본 모양. 정렬 자리가 없는 블록이면 null */
export function alignOf(node: Node): Align | null {
  if (!canHoldDecoration(node, ALIGN_KEY)) return null;
  return alignOrNull(node.attrs[ALIGN_KEY]) ?? defaultAlignOf(node);
}

export function setBlockAlign(align: string): Command {
  const value = alignOrNull(align);
  if (value === null) return () => false;
  return (state, dispatch) => {
    const blocks = selectedTopBlocks(state);
    if (blocks.length === 0 || !blocks.every(({ node }) => canHoldDecoration(node, ALIGN_KEY)))
      return false;
    const changed = blocks.filter(({ node }) => alignOf(node) !== value);
    if (dispatch && changed.length > 0) {
      const tr = state.tr;
      for (const { pos, node } of changed) {
        const stored = value === defaultAlignOf(node) ? null : value;
        // https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute — 노드 선택이 유지된다
        tr.setNodeAttribute(pos, ALIGN_KEY, stored);
      }
      dispatch(tr);
    }
    return true;
  };
}
