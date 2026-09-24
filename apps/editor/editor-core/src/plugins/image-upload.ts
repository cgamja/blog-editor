import { PluginKey } from "@tiptap/pm/state";
import type { Command, EditorState, Plugin } from "@tiptap/pm/state";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { ImageUploadEntry, ImageUploadRender, UploadedImageAttrs } from "./image-upload.types";

export const imageUploadKey = new PluginKey<readonly ImageUploadEntry[]>("imageUpload");

const unimplemented = (...args: unknown[]): never => {
  void args;
  throw new Error("미구현");
};

export const imageUpload = (render?: ImageUploadRender): Plugin<readonly ImageUploadEntry[]> =>
  unimplemented(render);
export const imageUploadsOf = (state: EditorState): readonly ImageUploadEntry[] =>
  unimplemented(state);
export const topGapAfterSelection = (state: EditorState): number => unimplemented(state);
export const nearestTopGap = (doc: PmNode, pos: number, before: boolean): number =>
  unimplemented(doc, pos, before);
export const startImageUpload = (id: string, pos: number): Command => unimplemented(id, pos);
export const failImageUpload = (id: string, message: string): Command => unimplemented(id, message);
export const cancelImageUpload = (id: string): Command => unimplemented(id);
export const finishImageUpload = (id: string, attrs: UploadedImageAttrs): Command =>
  unimplemented(id, attrs);
