import { Extension } from "@tiptap/core";
import { history, redo, undo } from "@tiptap/pm/history";
import { keymap } from "@tiptap/pm/keymap";
import type { Command, Plugin } from "@tiptap/pm/state";

/**
 * 되돌리기 · 다시 하기 단축키 — prosemirror-example-setup buildKeymap과 같은 조합.
 * https://prosemirror.net/docs/ref/#history.undo
 */
export const historyKeymap: Record<string, Command> = {
  "Mod-z": undo,
  "Mod-Shift-z": redo,
  "Mod-y": redo,
};

/**
 * 한글 조합 한 번이 여러 undo 단계로 쪼개지지 않는다 — prosemirror-history는 트랜잭션의
 * `composition` 메타가 이전과 같으면 새 그룹을 열지 않는다(1.5.0 소스 · CHANGELOG, design.md 2).
 * https://prosemirror.net/docs/ref/#history.history
 */
export function historyPlugins(): Plugin[] {
  return [history(), keymap(historyKeymap)];
}

/**
 * 스키마와 무관한 동작이라 `editorExtensions`에 넣지 않고 조립하는 쪽이 고른다(MoveBlock과 같다).
 * TipTap UndoRedo는 editor-core가 의존하지 않는 @tiptap/extensions에 있다(design.md 1).
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#prosemirror-plugins
 */
export const History = Extension.create({
  name: "history",
  addProseMirrorPlugins: () => historyPlugins(),
});
