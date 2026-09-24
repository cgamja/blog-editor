import { Extension } from "@tiptap/core";
import type { Command, Plugin } from "@tiptap/pm/state";

const notYet: Command = () => {
  throw new Error("미구현");
};

export const listKeymap: Record<string, Command> = {
  Enter: notYet,
  Tab: notYet,
  "Shift-Tab": notYet,
  Backspace: notYet,
};

export function listKeyPlugins(): Plugin[] {
  throw new Error("미구현");
}

export const ListKeys = Extension.create({ name: "listKeysStub" });
