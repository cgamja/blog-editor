import {
  chainCommands,
  createParagraphNear,
  liftEmptyBlock,
  newlineInCode,
  splitBlock,
} from "@tiptap/pm/commands";
import { NodeSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { enterInList } from "../plugins/list-keymap";
import { isTableCellTarget } from "../plugins/paste-normalizer";
import { splitBlockKeepingStickers } from "./split-block";
import { enterInTable } from "./table";

/**
 * 문단 안 선택을 강제 줄바꿈 하나로 바꾼다(spec: editor-hard-break, adr-028). 자리는 문단뿐이다 — 제목 · 코드 블록 ·
 * 표 칸(GFM 칸은 한 줄) · 노드 선택 · 여러 블록에 걸친 선택이면 false.
 * 강제 줄바꿈 자신은 마크를 물려받지 않는다 — `replaceSelectionWith(node, inheritMarks = false)`, 마크 자리가 없다.
 * 다음 줄에 이어 칠 글자는 마크를 잇는다(TipTap HardBreak `keepMarks` 기본과 같다: 저장된 마크, 없으면 줄 맨 앞이 아닐 때
 * 선택 자리의 마크) — `ensureMarks`가 저장된 마크로 둔다(prosemirror-state 1.4.4 transaction.ts `ensureMarks`).
 * 끝에서 끝나는 링크처럼 이어지지 않는 마크(`inclusive: false`)는 `$from.marks()`에 이미 빠져 있다.
 * https://prosemirror.net/docs/ref/#state.Transaction.replaceSelectionWith ·
 * https://prosemirror.net/docs/ref/#state.Transaction.ensureMarks ·
 * https://tiptap.dev/docs/editor/extensions/nodes/hard-break#keepmarks
 */
export const insertHardBreak: Command = (state, dispatch) => {
  const { selection, schema } = state;
  const hardBreak = schema.nodes.hardBreak;
  if (hardBreak === undefined || selection instanceof NodeSelection) return false;
  const { $from, $to } = selection;
  if ($from.parent.type !== schema.nodes.paragraph || !$from.sameParent($to)) return false;
  if (isTableCellTarget(selection)) return false;
  if (dispatch) {
    const marks = state.storedMarks ?? ($to.parentOffset > 0 ? $from.marks() : []);
    const tr = state.tr.replaceSelectionWith(hardBreak.create(), false);
    if (marks.length > 0) tr.ensureMarks(marks);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** 어느 Enter 커맨드도 받지 않는 자리(예: 목록 항목 둘에 걸친 선택)에서도 키를 삼킨다 — 브라우저 기본 줄바꿈을 막는다 */
const swallow: Command = () => true;

/**
 * Shift+Enter — 문단이면 강제 줄바꿈, 표 칸이면 Enter처럼 삼키고(칸 안은 문단 하나), 그 밖(제목 · 코드 블록 · 목록 ·
 * 노드 선택)은 Enter와 같다. 끝까지 아무도 받지 않으면 삼킨다 — 브라우저 기본 줄바꿈(contenteditable의 `<br>` 삽입)이
 * 제목 · 칸에 자리가 없는 모양을 DOM에서 거꾸로 읽혀 들이게 두지 않는다. Enter 쪽 순서는 우리 Enter 키맵과 같다:
 * 목록(ListKeys `enterInList`) → StickerSafeSplit(스티커는 한 블록에만) → TipTap 코어 Enter(`newlineInCode` ·
 * `createParagraphNear` · `liftEmptyBlock` · `splitBlock`, @tiptap/core 3.31.3 extensions/keymap.ts handleEnter).
 * 한글 조합 중에는 이 키가 오지 않는다 — prosemirror-view 1.42.5 `editHandlers.keydown`이 handleKeyDown 전에
 * `inOrNearComposition(view)`로 버린다(dist/index.js:3192 · 정의 :3547 — `view.composing`이거나, Safari(WebKit)에서
 * compositionend 뒤 500ms 안의 keydown 한 번).
 * https://github.com/ProseMirror/prosemirror-view/blob/1.42.5/src/input.ts#L495-L512
 */
export const hardBreakOrEnter: Command = chainCommands(
  insertHardBreak,
  enterInTable,
  enterInList,
  splitBlockKeepingStickers,
  newlineInCode,
  createParagraphNear,
  liftEmptyBlock,
  splitBlock,
  swallow,
);
