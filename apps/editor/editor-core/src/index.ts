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
} from "./commands/decoration.types";
export {
  isStickerRemoveKey,
  mapStickerRef,
  placeStickerNear,
  stickerKeyCommand,
  wrapRotation,
} from "./commands/sticker-edit";
export type { KeyModifiers, StickerRef } from "./commands/sticker-edit";
export { stickerCount, stickersIn } from "./commands/sticker-query";
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
