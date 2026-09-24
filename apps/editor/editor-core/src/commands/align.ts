import type { Node } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";

/** 스텁 — test 커밋이 typecheck를 통과하게 한다. 구현은 다음 커밋 */
export function alignOf(node: Node): string | null {
  void node;
  throw new Error("미구현");
}

export function setBlockAlign(align: string): Command {
  void align;
  return () => {
    throw new Error("미구현");
  };
}
