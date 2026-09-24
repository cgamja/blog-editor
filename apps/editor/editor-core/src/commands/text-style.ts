import type { Command, EditorState } from "@tiptap/pm/state";
import type { TextStylePatch, TextStyleSummary } from "./text-style.types";

export const setTextStyle: (patch: TextStylePatch) => Command = () => {
  throw new Error("미구현");
};

export const textStyleSummary: (state: EditorState) => TextStyleSummary = () => {
  throw new Error("미구현");
};

export const applyLastColor: Command = () => {
  throw new Error("미구현");
};
