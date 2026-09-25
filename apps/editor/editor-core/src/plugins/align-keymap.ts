import { Extension } from "@tiptap/core";
import { chainCommands } from "@tiptap/pm/commands";
import { keymap } from "@tiptap/pm/keymap";
import type { Command } from "@tiptap/pm/state";
import { setBlockAlign } from "../commands/align";
import { swallowing } from "../commands/move-block";
import { setTableColumnAlign } from "../commands/table";

/**
 * 정렬 단축키 — spec: editor-align, design.md 3. Google Docs · TipTap TextAlign과 같은 ⌘⇧L · E · R.
 * 소문자 이름이면 Shift로 대문자(`L`)가 된 키도 prosemirror-keymap이 keyCode로 다시 찾는다
 * (https://prosemirror.net/docs/ref/#keymap.keymap). 정렬할 수 없는 곳에서도 키를 삼킨다 —
 * ⌘⇧R은 브라우저 강력 새로 고침이다. 표 안이면 그 열의 정렬을 바꾼다(spec: editor-table) — 표 밖이면 표 커맨드가
 * false라 블록 정렬로 넘어간다. https://prosemirror.net/docs/ref/#commands.chainCommands
 */
const alignKey = (align: string): Command =>
  swallowing(chainCommands(setTableColumnAlign(align), setBlockAlign(align)));

export const alignKeymap: Record<string, Command> = {
  "Mod-Shift-l": alignKey("left"),
  "Mod-Shift-e": alignKey("center"),
  "Mod-Shift-r": alignKey("right"),
};

/**
 * 단축키를 싣는 확장 — 스키마와 무관해 `editorExtensions`에는 넣지 않고 조립하는 쪽이 고른다(등록만, adr-002).
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension
 */
export const AlignKeys = Extension.create({
  name: "alignKeys",
  addProseMirrorPlugins() {
    return [keymap(alignKeymap)];
  },
});
