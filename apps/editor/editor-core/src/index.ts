export { createEditorSchema, editorExtensions } from "./extensions";
export { docFromNode, docToNode } from "./doc-node";
export {
  backspaceAfterCustomBlock,
  insertAppScreenshot,
  insertCallout,
  setCalloutTone,
} from "./commands/custom-blocks";
export type { AppScreenshotInput } from "./commands/custom-blocks";
export {
  addSticker,
  moveStickerToBlock,
  placeOnNearestBlock,
  removeSticker,
  setBlockFont,
  setBlockMotion,
  setBlockWidth,
  updateSticker,
} from "./commands/decoration";
export type {
  BlockRect,
  StickerPatch,
  StickerPlacement,
  StickerTarget,
} from "./commands/decoration";
export { MoveBlock, moveBlockDown, moveBlockKeymap, moveBlockUp } from "./commands/move-block";
export { splitBlockKeepingStickers } from "./commands/split-block";
export {
  wrapInBlockquote,
  wrapInBulletList,
  wrapInCallout,
  wrapInOrderedList,
} from "./commands/wrap";
export { blockGuard } from "./plugins/block-guard";
export {
  normalizePastedSlice,
  pasteNormalizer,
  pasteNormalizerKey,
} from "./plugins/paste-normalizer";
