import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import type { StickerRef } from "../commands/sticker-edit";

export const stickerHidingKey = new PluginKey<StickerRef | null>("stickerHiding");

export function stickerHiding(): Plugin<StickerRef | null> {
  throw new Error("미구현");
}

export function hideSticker(ref: StickerRef | null): Command {
  throw new Error(`미구현: ${String(ref)}`);
}
