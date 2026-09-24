import type { Attrs } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";

export function turnIntoTextblock(typeName: string, attrs: Attrs | null = null): Command {
  void typeName;
  void attrs;
  throw new Error("미구현");
}

export const duplicateTopBlock: Command = () => {
  throw new Error("미구현");
};
