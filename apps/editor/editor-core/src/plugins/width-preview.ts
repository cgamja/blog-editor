import { PluginKey } from "@tiptap/pm/state";
import type { Command, Plugin } from "@tiptap/pm/state";
import type { WidthPreviewState } from "../commands/block-controls.types";

export const widthPreviewKey = new PluginKey<WidthPreviewState | null>("widthPreview");

export function widthPreview(): Plugin<WidthPreviewState | null> {
  throw new Error("미구현");
}

export function previewBlockWidth(pos: number, width: number | null): Command {
  throw new Error(`미구현: ${pos} ${width}`);
}
