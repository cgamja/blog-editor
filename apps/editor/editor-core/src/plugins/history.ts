import { Extension } from "@tiptap/core";
import type { Command, Plugin } from "@tiptap/pm/state";

export const historyKeymap: Record<string, Command> = {};

export function historyPlugins(): Plugin[] {
  throw new Error("미구현");
}

export const History = Extension.create({ name: "history" });
