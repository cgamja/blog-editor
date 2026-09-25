import { useState } from "react";
import type { Command, EditorState } from "@tiptap/pm/state";
import {
  addTableColumnAfter,
  addTableRowAfter,
  atTopTable,
  deleteTableColumn,
  deleteTableRow,
} from "@blog-editor/editor-core";
import { TABLE_MENU_MESSAGES } from "./messages";

/** 손잡이 블록이 표일 때 블록 메뉴에 더 보이는 항목(spec: editor-table) — 커서 칸, 커서가 그 표 밖이면 마지막 칸 기준 */
const TABLE_ACTIONS = [
  { label: TABLE_MENU_MESSAGES.addRowAfter, command: addTableRowAfter },
  { label: TABLE_MENU_MESSAGES.addColumnAfter, command: addTableColumnAfter },
  { label: TABLE_MENU_MESSAGES.deleteRow, command: deleteTableRow },
  { label: TABLE_MENU_MESSAGES.deleteColumn, command: deleteTableColumn },
] as const;

export interface TableMenuGroupProps {
  /** 메뉴를 연 손잡이의 최상위 블록 번호 — 표인 블록일 때만 그린다 */
  index: number;
  /** 메뉴를 열 때의 상태 — 할 수 있는 항목(마지막 행 · 열은 못 지운다)을 한 번만 잰다 */
  state: EditorState;
  choose: (command: Command) => void;
}

/** 블록 메뉴의 「표」 묶음 — 행 · 열 더하기 · 지우기. 할 수 없는 항목은 aria-disabled(APG: 비활성도 포커스를 받는다) */
export function TableMenuGroup({ index, state, choose }: TableMenuGroupProps) {
  const [actions] = useState(() =>
    TABLE_ACTIONS.map((action) => ({
      ...action,
      enabled: atTopTable(index, action.command)(state),
    })),
  );
  return (
    <>
      <div role="separator" className="block-menu-separator" />
      <div role="group" aria-label={TABLE_MENU_MESSAGES.group}>
        <div className="block-menu-heading" aria-hidden="true">
          {TABLE_MENU_MESSAGES.group}
        </div>
        {actions.map(({ label, command, enabled }) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={!enabled || undefined}
            onClick={() => enabled && choose(atTopTable(index, command))}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
