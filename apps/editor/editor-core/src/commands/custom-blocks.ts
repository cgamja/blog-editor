import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import { CALLOUT_TONES, CAPTION_MAX_LENGTH, imagePathSchema } from "@blog-editor/content-schema";

/**
 * 커스텀 블록(콜아웃 · 앱 스크린샷) 커맨드 — spec: editor-custom-blocks, design.md.
 * ProseMirror Command 관례: 적용할 수 없으면 dispatch 없이 false
 * (https://prosemirror.net/docs/guide/#commands · https://prosemirror.net/docs/ref/#state.Command).
 */

type CalloutTone = (typeof CALLOUT_TONES)[number];

const CUSTOM_BLOCKS: ReadonlySet<string> = new Set(["callout", "appScreenshot"]);

const isCalloutTone = (tone: string): tone is CalloutTone =>
  (CALLOUT_TONES as readonly string[]).includes(tone);

/** 글도 꾸미기도 없는 문단 — 꾸미기가 붙은 빈 문단은 사용자가 꾸민 자리라 바꾸지 않는다(design.md 2) */
const isBlankParagraph = (node: Node) =>
  node.type.name === "paragraph" &&
  node.childCount === 0 &&
  Object.values(node.attrs).every((value) => value === null);

/** 블록이 pos에서 시작할 때 그 안 첫 텍스트 자리 — 블록을 여는 자리 하나 안쪽 */
const textStartOf = (blockPos: number) => blockPos + 1;
/** 콜아웃이 pos에서 시작할 때 그 첫 문단의 텍스트 자리 — 콜아웃 · 문단 두 겹 안쪽 */
const firstTextPosInCallout = (calloutPos: number) => textStartOf(textStartOf(calloutPos));

/** 커서를 품은 콜아웃의 위치(콜아웃 바로 앞). 노드 선택된 콜아웃도 포함한다. 없으면 null */
function calloutPosAround(state: EditorState): number | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === "callout") {
    return selection.from;
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "callout") return $from.before(depth);
  }
  return null;
}

/**
 * 콜아웃 · 스크린샷은 최상위에만 올 수 있어서, 커서를 품은 **최상위 블록**을 기준으로 넣는다(design.md 2).
 * 그 블록이 빈 문단이면 그 자리를 바꾸고, 아니면 뒤에 넣는다. 문서 끝 틈(gap cursor)이면 문서 끝에 넣는다.
 * @returns 넣은 블록이 시작하는 위치
 */
function insertTopLevel(tr: Transaction, state: EditorState, block: Node): number {
  const { $from } = state.selection;
  const index = $from.index(0);
  if (index >= state.doc.childCount) {
    const end = state.doc.content.size;
    tr.insert(end, block);
    return end;
  }
  const current = state.doc.child(index);
  const start = $from.posAtIndex(index, 0);
  const end = start + current.nodeSize;
  if (isBlankParagraph(current)) {
    tr.replaceWith(start, end, block);
    return start;
  }
  tr.insert(end, block);
  return end;
}

export function insertCallout(tone: string): Command {
  return (state, dispatch) => {
    // 콜아웃은 중첩되지 않는다 — 스키마가 막을 것을 넣는 순간 거절한다
    if (!isCalloutTone(tone) || calloutPosAround(state) !== null) return false;
    if (dispatch) {
      const { schema } = state;
      const tr = state.tr;
      const start = insertTopLevel(
        tr,
        state,
        schema.node("callout", { tone }, schema.node("paragraph")),
      );
      tr.setSelection(TextSelection.create(tr.doc, firstTextPosInCallout(start)));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export function setCalloutTone(tone: string): Command {
  return (state, dispatch) => {
    const pos = calloutPosAround(state);
    const callout = pos === null ? null : state.doc.nodeAt(pos);
    if (!isCalloutTone(tone) || pos === null || callout === null) return false;
    if (dispatch) {
      // https://prosemirror.net/docs/ref/#transform.Transform.setNodeMarkup — 다른 attrs(꾸미기)는 그대로 넘긴다
      dispatch(state.tr.setNodeMarkup(pos, undefined, { ...callout.attrs, tone }));
    }
    return true;
  };
}

export interface AppScreenshotInput {
  src: string;
  caption: string;
}

export function insertAppScreenshot({ src, caption }: AppScreenshotInput): Command {
  return (state, dispatch) => {
    // 저장 때 zod가 던지기 전에, 넣는 순간 거절한다(design.md 5)
    if (!imagePathSchema.safeParse(src).success || caption.length > CAPTION_MAX_LENGTH) {
      return false;
    }
    if (dispatch) {
      const { schema } = state;
      const tr = state.tr;
      const screenshot = schema.node("appScreenshot", { src, caption });
      const after = insertTopLevel(tr, state, screenshot) + screenshot.nodeSize;
      // 이미지는 글자를 품지 않는다 — 바로 뒤가 문단이 아니면 이어 쓸 빈 문단을 둔다(design.md 3)
      if (tr.doc.nodeAt(after)?.type.name !== "paragraph") {
        tr.insert(after, schema.node("paragraph"));
      }
      tr.setSelection(TextSelection.create(tr.doc, textStartOf(after)));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/**
 * 커스텀 블록 바로 뒤 최상위 블록의 첫 글자 자리 Backspace — 기본 joinBackward는 그 블록을 콜아웃 안으로
 * 합친다. 합치지 않고 앞 블록을 고른다(빈 문단이면 지운다). 그 밖은 false라 키맵에서 기본 체인
 * (deleteSelection → joinBackward → selectNodeBackward, https://prosemirror.net/docs/ref/#commands.baseKeymap)
 * 앞에 걸면 된다(design.md 4).
 */
export const backspaceAfterCustomBlock: Command = (state, dispatch) => {
  const { selection } = state;
  const { $from } = selection;
  const index = $from.index(0);
  if (!selection.empty || $from.depth === 0 || index === 0) return false;
  const previous = state.doc.child(index - 1);
  if (!CUSTOM_BLOCKS.has(previous.type.name)) return false;
  const blockPos = $from.before(1);
  // https://prosemirror.net/docs/ref/#state.Selection^findFrom — textOnly로 블록 안 첫 글자 자리를 찾는다
  const firstText = Selection.findFrom(state.doc.resolve(blockPos), 1, true);
  if (firstText === null || firstText.from !== $from.pos) return false;
  if (dispatch) {
    const tr = state.tr;
    const block = state.doc.child(index);
    if (isBlankParagraph(block)) tr.delete(blockPos, blockPos + block.nodeSize);
    tr.setSelection(NodeSelection.create(tr.doc, blockPos - previous.nodeSize));
    dispatch(tr.scrollIntoView());
  }
  return true;
};
