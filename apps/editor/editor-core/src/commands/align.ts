import type { Node } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";
import { defaultAlignOf } from "@blog-editor/content-schema";
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

/** 지금 모양 — 저장값, 없으면 그 블록의 기본 모양(content-schema 정규형 규칙). 정렬 자리가 없는 블록이면 null */
export function alignOf(node: Node): Align | null {
  if (!canHoldDecoration(node, ALIGN_KEY)) return null;
  return alignOrNull(node.attrs[ALIGN_KEY]) ?? defaultAlignOf(node.type.name);
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
        // 기본 모양이면 저장하지 않는다 — normalize가 지우는 값과 같은 규칙(defaultAlignOf 한 곳)
        const stored = value === defaultAlignOf(node.type.name) ? null : value;
        // https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute — 노드 선택이 유지된다
        tr.setNodeAttribute(pos, ALIGN_KEY, stored);
      }
      dispatch(tr);
    }
    return true;
  };
}
