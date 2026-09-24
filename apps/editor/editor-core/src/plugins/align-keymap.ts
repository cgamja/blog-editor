import { Extension } from "@tiptap/core";
import type { Command } from "@tiptap/pm/state";

/** 스텁 — 구현은 다음 커밋 */
export const alignKeymap: Record<string, Command> = {};

export const AlignKeys = Extension.create({ name: "alignKeysStub" });
