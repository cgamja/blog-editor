import type { Block, DecorationAttrs } from "@blog-editor/content-schema";

/** 이미지 · 스티커 경로 앞에 붙는 도메인(plan 3-8). 문서에는 경로만 있다. */
export interface RenderOptions {
  imageBaseUrl: string;
}

/** 렌더 한 번 동안 고정되는 값 — 끝 슬래시를 정리하고 이스케이프한 imageBaseUrl. */
export interface RenderContext {
  imageBaseUrl: string;
}

// ── 안쪽 노드(blockquote · callout · listItem 안) — attrs 자리가 없다(spec: html-render) ──
// content-schema는 이 모양을 내부 타입으로만 쓰고 export하지 않는다. 다시 선언하지 않고 Block에서
// 파생한다 — 스키마 쪽 안쪽 노드에 필드가 더해지거나 바뀌면 여기도 그대로 따라온다.

export type InnerParagraph = Extract<Block, { type: "blockquote" }>["content"][number];
export type InnerListItem = Extract<Block, { type: "bulletList" }>["content"][number];
export type CalloutChild = Extract<Block, { type: "callout" }>["content"][number];
export type InnerList = Exclude<CalloutChild, InnerParagraph>;
export type TableRow = Extract<Block, { type: "table" }>["content"][number];
export type TableCell = TableRow["content"][number];

/**
 * 최상위 블록 attrs 중 꾸미기 필드만 뽑은 모양 — DecorationAttrs(Partial)를 그대로 쓰지 않는다.
 * exactOptionalPropertyTypes 아래에서 zod가 만드는 실제 attrs 타입은 `font?: F | undefined`처럼
 * optional 필드에 명시적 undefined가 섞여 있어 Partial<{ font: F }>(= `font?: F`, undefined
 * 불가)에 그대로 대입되지 않는다 — 여기서만 명시적으로 `| undefined`를 더해 받아들인다.
 */
export interface Decoration {
  font?: DecorationAttrs["font"] | undefined;
  motion?: DecorationAttrs["motion"] | undefined;
  width?: DecorationAttrs["width"] | undefined;
  align?: DecorationAttrs["align"] | undefined;
  stickers?: DecorationAttrs["stickers"] | undefined;
}
