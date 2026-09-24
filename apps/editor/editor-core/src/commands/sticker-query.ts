import type { Node } from "@tiptap/pm/model";
import type { Sticker } from "@blog-editor/content-schema";

/**
 * 문서에서 스티커를 읽는다 — 커맨드와 UI가 attrs를 제각각 세지 않게 한 곳에 둔다(spec: editor-sticker-edit).
 * 값은 blockGuard(zod)가 지킨 닫힌 집합이라 여기서 다시 검증하지 않는다.
 */

export const stickersOf = (node: Node): Sticker[] =>
  Array.isArray(node.attrs.stickers) ? (node.attrs.stickers as Sticker[]) : [];

export function stickerCount(doc: Node): number {
  let count = 0;
  doc.forEach((block) => {
    count += stickersOf(block).length;
  });
  return count;
}

/** 최상위 블록 경계의 블록이 가진 스티커. 경계가 아니거나 블록이 없으면 빈 배열 */
export function stickersIn(doc: Node, blockPos: number): Sticker[] {
  if (!Number.isInteger(blockPos) || blockPos < 0 || blockPos >= doc.content.size) return [];
  // https://prosemirror.net/docs/ref/#model.ResolvedPos.depth — 최상위 블록 사이 경계는 깊이 0
  if (doc.resolve(blockPos).depth !== 0) return [];
  const node = doc.nodeAt(blockPos);
  return node === null ? [] : stickersOf(node);
}

const STICKER_FIELDS = ["id", "x", "y", "size", "rotate"] as const;

/** 두 스티커 목록이 같은가 — 키 순서(정규형은 가나다순)와 무관하게 필드로 본다 */
export function sameStickers(a: readonly Sticker[], b: readonly Sticker[]): boolean {
  return (
    a.length === b.length &&
    a.every((sticker, i) => STICKER_FIELDS.every((field) => sticker[field] === b[i]![field]))
  );
}
