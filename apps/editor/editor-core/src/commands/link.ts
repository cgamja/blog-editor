import type { MarkType, ResolvedPos } from "@tiptap/pm/model";
import type { Command, EditorState } from "@tiptap/pm/state";
import { hrefOrNull } from "../closed-values";

/**
 * 링크 넣기 · 빼기 — spec: editor-markdown-shortcuts.
 * 주소는 content-schema hrefSchema(허용 목록)로만 거른다 — 붙여넣기 · 저장과 같은 규칙이다.
 */

interface Range {
  from: number;
  to: number;
}

/** 커서가 든 링크 글자 전체. 같은 href의 link 마크가 이어진 텍스트 노드들을 한 덩어리로 본다 */
function linkExtentAt($pos: ResolvedPos, type: MarkType): Range | null {
  // https://prosemirror.net/docs/ref/#model.ResolvedPos.marks
  const mark = type.isInSet($pos.marks());
  if (mark === undefined) return null;
  const start = $pos.start();
  let offset = 0;
  let run: Range | null = null;
  for (let index = 0; index < $pos.parent.childCount; index += 1) {
    const child = $pos.parent.child(index);
    const from = start + offset;
    const to = from + child.nodeSize;
    offset += child.nodeSize;
    if (!mark.isInSet(child.marks)) {
      if (run !== null && run.to >= $pos.pos) return run;
      run = null;
      continue;
    }
    run = run === null ? { from, to } : { from: run.from, to };
  }
  return run;
}

/** 고른 글자, 없으면 커서가 든 링크 전체 */
function targetRange(state: EditorState, type: MarkType): Range | null {
  const { from, to, empty, $from } = state.selection;
  return empty ? linkExtentAt($from, type) : { from, to };
}

/**
 * 고른 글자(또는 커서가 든 링크)에 href 링크를 건다. 허용 목록 밖 주소 · 대상 없음 · 마크를 못 받는 블록이면 false.
 * https://prosemirror.net/docs/ref/#transform.Transform.addMark
 */
export function setLink(href: string): Command {
  return (state, dispatch) => {
    const valid = hrefOrNull(href);
    const type = state.schema.marks.link;
    if (valid === null || type === undefined) return false;
    const range = targetRange(state, type);
    // https://prosemirror.net/docs/ref/#model.NodeType.allowsMarkType
    if (range === null || !state.selection.$from.parent.type.allowsMarkType(type)) return false;
    if (dispatch) {
      const tr = state.tr
        .removeMark(range.from, range.to, type)
        .addMark(range.from, range.to, type.create({ href: valid }));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export function linkHrefAt(state: EditorState): string | null {
  void state;
  throw new Error("미구현");
}

export function hasLinkTarget(state: EditorState): boolean {
  void state;
  throw new Error("미구현");
}

/** 고른 글자(또는 커서가 든 링크)에서 링크를 뺀다. 링크가 없으면 false */
export const removeLink: Command = (state, dispatch) => {
  const type = state.schema.marks.link;
  if (type === undefined) return false;
  const range = targetRange(state, type);
  // https://prosemirror.net/docs/ref/#model.Node.rangeHasMark
  if (range === null || !state.doc.rangeHasMark(range.from, range.to, type)) return false;
  if (dispatch) dispatch(state.tr.removeMark(range.from, range.to, type).scrollIntoView());
  return true;
};
