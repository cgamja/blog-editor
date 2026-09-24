import { Extension } from "@tiptap/core";
import { keymap } from "@tiptap/pm/keymap";
import type { Plugin } from "@tiptap/pm/state";
import { markdownInputRules } from "./markdown-input-rules";
import { markdownShortcutKeymap } from "./markdown-shortcut-keymap";

/** spec: editor-markdown-shortcuts */
export function markdownShortcutPlugins(): Plugin[] {
  return [markdownInputRules(), keymap(markdownShortcutKeymap)];
}

// 커스텀 블록 Backspace(우선순위 1000)보다 먼저 규칙 되돌리기를 본다 — 되돌릴 게 없으면 false라 다음으로 넘어간다
const MARKDOWN_SHORTCUTS_PRIORITY = 1100;

/**
 * 조립하는 쪽이 고른다(History · MoveBlock과 같다). 등록만 한다(adr-002).
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#prosemirror-plugins
 */
export const MarkdownShortcuts = Extension.create({
  name: "markdownShortcuts",
  priority: MARKDOWN_SHORTCUTS_PRIORITY,
  addProseMirrorPlugins: () => markdownShortcutPlugins(),
});
