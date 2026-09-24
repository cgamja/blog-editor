import type { StickerRef } from "@blog-editor/editor-core";

export const refOf = ({ blockPos, index }: StickerRef): StickerRef => ({ blockPos, index });

export const keyOf = ({ blockPos, index }: StickerRef): string => `${blockPos}:${index}`;

export const sameRef = (a: StickerRef | null, b: StickerRef): boolean =>
  a !== null && keyOf(a) === keyOf(b);
