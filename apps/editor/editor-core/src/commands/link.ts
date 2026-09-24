import type { Command } from "@tiptap/pm/state";

export function setLink(href: string): Command {
  void href;
  throw new Error("미구현");
}

export const removeLink: Command = () => {
  throw new Error("미구현");
};
