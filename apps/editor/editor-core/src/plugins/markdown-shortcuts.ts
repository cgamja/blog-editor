import { Extension } from "@tiptap/core";
import type { Command, Plugin } from "@tiptap/pm/state";

export function markdownInputRules(): Plugin {
  throw new Error("미구현");
}

export const markdownShortcutKeymap: Record<string, Command> = {};

export function markdownShortcutPlugins(): Plugin[] {
  throw new Error("미구현");
}

export const MarkdownShortcuts = Extension.create({ name: "markdownShortcutsStub" });
