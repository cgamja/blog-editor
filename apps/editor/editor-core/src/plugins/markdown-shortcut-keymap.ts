import { toggleMark } from "@tiptap/pm/commands";
import { undoInputRule } from "@tiptap/pm/inputrules";
import type { Command } from "@tiptap/pm/state";
import { duplicateTopBlock, isInTopBlock, turnIntoTextblock } from "../commands/turn-into";
import { wrapInBulletList, wrapInOrderedList } from "../commands/wrap";

/**
 * Notion 단축키 — spec: editor-markdown-shortcuts, markdown-shortcuts design.md 7.
 * 기준: https://www.notion.com/help/keyboard-shortcuts
 */

const toggle =
  (markName: string): Command =>
  (state, dispatch) => {
    const type = state.schema.marks[markName];
    // https://prosemirror.net/docs/ref/#commands.toggleMark
    return type === undefined ? false : toggleMark(type)(state, dispatch);
  };

/** 최상위 문단일 때만 — 목록 · 인용 안에서 한 단계 더 감싸지 않는다(design.md 3) */
const onTopParagraph =
  (command: Command): Command =>
  (state, dispatch) =>
    isInTopBlock(state, state.selection.from, ["paragraph"]) && command(state, dispatch);

/**
 * 우리 본문엔 h1이 없어서 ⌘⌥1도 큰 제목(h2)이다.
 * macOS ⌥+숫자는 event.key가 특수 문자지만 prosemirror-keymap이 keyCode로 기본 이름을 찾는다.
 * https://prosemirror.net/docs/ref/#keymap
 */
export const markdownShortcutKeymap: Record<string, Command> = {
  Backspace: undoInputRule,
  "Mod-b": toggle("bold"),
  "Mod-i": toggle("italic"),
  "Mod-e": toggle("code"),
  "Mod-Alt-0": turnIntoTextblock("paragraph"),
  "Mod-Alt-1": turnIntoTextblock("heading", { level: 2 }),
  "Mod-Alt-2": turnIntoTextblock("heading", { level: 2 }),
  "Mod-Alt-3": turnIntoTextblock("heading", { level: 3 }),
  "Mod-Alt-5": onTopParagraph(wrapInBulletList),
  "Mod-Alt-6": onTopParagraph(wrapInOrderedList),
  "Mod-Alt-8": turnIntoTextblock("codeBlock"),
  "Mod-d": duplicateTopBlock,
};
