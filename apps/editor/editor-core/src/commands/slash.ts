/**
 * 슬래시 메뉴에서 고른 항목 적용 — spec: editor-slash-menu, slash-menu design.md 4. 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - Transform.delete: https://prosemirror.net/docs/ref/#transform.Transform.delete
 * - EditorState.create(문서 · 선택만 다른 상태): https://prosemirror.net/docs/ref/#state.EditorState^create
 * - 되돌리기 묶음 나누기: plugins/slash-menu.ts markSlashItemApplied
 */
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { Transform } from "@tiptap/pm/transform";
import { markSlashItemApplied, slashMenuKey } from "../plugins/slash-menu";
import { TURN_INTO_TARGETS } from "./block-controls.constants";
import type { TurnIntoKind } from "./block-controls.constants";
import { turnTopBlockInto } from "./block-controls";
import { appendCommandStepsAndSelection } from "./derived-command";
import { INSERTABLE_BLOCKS } from "./drag-block.constants";
import type { InsertableBlockKind } from "./drag-block.constants";
import { insertBlockAfter, replaceEmptyTopParagraph } from "./drag-block";

const isTurnIntoKind = (kind: InsertableBlockKind): kind is InsertableBlockKind & TurnIntoKind =>
  Object.hasOwn(TURN_INTO_TARGETS, kind);

/**
 * `/거르기`를 지운 뒤 할 일. 빈 문단이면 그 자리를 바꾸고(「문단」은 지우기만 — null), 글자가 남았으면 아래에 넣는다.
 * 제목 · 목록 · 인용은 블록 메뉴 「바꾸기」와 같은 커맨드(꾸미기를 옮긴다), 콜아웃 · 구분선은 빈 문단 자리 바꾸기.
 */
function followUp(kind: InsertableBlockKind, index: number, empty: boolean): Command | null {
  if (!empty) return insertBlockAfter(index, kind);
  if (kind === "paragraph") return null;
  return isTurnIntoKind(kind)
    ? turnTopBlockInto(index, kind)
    : replaceEmptyTopParagraph(index, kind);
}

/**
 * 슬래시 메뉴에서 고른 `kind`를 적용한다. 한 트랜잭션으로 `/`부터 커서까지를 지우고 이어서 블록을 바꾸거나 넣는다.
 * 이어지는 커맨드는 지운 뒤 상태에서 먼저 물어 보고(거절이면 아무것도 지우지 않는다), 받아들이면 step을 옮겨 담는다
 * (appendCommandStepsAndSelection — TipTap 체인의 공유 트랜잭션). 되돌리기 묶음은 앞뒤로 끊는다
 * (markSlashItemApplied) — 거르기 글자 입력이나 적용 직후 친 글자와 한 묶음이 되지 않게.
 * 메뉴가 닫혀 있거나 목록 밖 kind면 false.
 */
export function applySlashItem(kind: InsertableBlockKind): Command {
  return (state, dispatch) => {
    const menu = slashMenuKey.getState(state);
    if (menu == null || !Object.hasOwn(INSERTABLE_BLOCKS, kind)) return false;
    const { from } = menu;
    const to = state.selection.from;
    const index = state.doc.resolve(from).index(0);
    // 체인에서는 state.tr이 공유 트랜잭션이다 — 받아들일지 정해질 때까지 건드리지 않는다
    const deleted = new Transform(state.doc).delete(from, to).doc;
    const next = followUp(kind, index, deleted.child(index).content.size === 0);
    const derived = EditorState.create({
      doc: deleted,
      selection: TextSelection.create(deleted, from),
      plugins: state.plugins,
    });
    if (next !== null && !next(derived)) return false;
    if (dispatch === undefined) return true;

    const tr = markSlashItemApplied(state.tr.delete(from, to));
    tr.setSelection(TextSelection.create(tr.doc, from));
    if (next !== null) appendCommandStepsAndSelection(tr, derived, next);
    dispatch(tr.scrollIntoView());
    return true;
  };
}
