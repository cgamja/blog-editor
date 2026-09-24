import type { Command } from "@tiptap/pm/state";
import type { TurnIntoKind } from "./block-controls.constants";
import type { WidthDrag } from "./block-controls.types";

export function deleteTopBlock(index: number): Command {
  throw new Error(`미구현: ${index}`);
}

export function atTopBlock(index: number, command: Command): Command {
  throw new Error(`미구현: ${index} ${typeof command}`);
}

export function turnTopBlockInto(index: number, kind: TurnIntoKind): Command {
  throw new Error(`미구현: ${index} ${kind}`);
}

export function resizedWidthPercent(drag: WidthDrag): number {
  throw new Error(`미구현: ${drag.side}`);
}
