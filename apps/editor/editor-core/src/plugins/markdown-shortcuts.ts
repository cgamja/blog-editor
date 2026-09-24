import { Extension } from "@tiptap/core";
import { keymap } from "@tiptap/pm/keymap";
import type { Plugin } from "@tiptap/pm/state";
import { markdownInputRules } from "./markdown-input-rules";
import { markdownShortcutKeymap } from "./markdown-shortcut-keymap";
import { MARKDOWN_SHORTCUTS_PRIORITY } from "../keymap-priority.constants";

/** spec: editor-markdown-shortcuts */
export function markdownShortcutPlugins(): Plugin[] {
  return [markdownInputRules(), keymap(markdownShortcutKeymap)];
}

/**
 * 조립하는 쪽이 고른다(History · MoveBlock과 같다). 등록만 한다(adr-002).
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#prosemirror-plugins
 */
export const MarkdownShortcuts = Extension.create({
  name: "markdownShortcuts",
  priority: MARKDOWN_SHORTCUTS_PRIORITY,
  addProseMirrorPlugins: () => markdownShortcutPlugins(),
});
