import type { SummaryValue, TextStyleSummary } from "@blog-editor/editor-core";

export interface Placement {
  top: number;
  below: boolean;
}

export interface WeightOptions {
  weights: readonly string[];
  /** 고를 두께가 없는 이유 — 있으면 두께 고르기를 막는다 */
  reason: string | null;
}

export const contrastRatio: (foreground: string, background: string) => number = () => {
  throw new Error("미구현");
};

export const isHardToRead: (style: {
  color?: string | null;
  highlight?: string | null;
}) => boolean = () => {
  throw new Error("미구현");
};

export const normalizeHexInput: (raw: string) => string | null = () => {
  throw new Error("미구현");
};

export const toolbarPlacement: (box: {
  selectionTop: number;
  selectionBottom: number;
  toolbarHeight: number;
  gap: number;
}) => Placement = () => {
  throw new Error("미구현");
};

export const weightOptionsFor: (
  font: TextStyleSummary["font"] | SummaryValue<string>,
) => WeightOptions = () => {
  throw new Error("미구현");
};
