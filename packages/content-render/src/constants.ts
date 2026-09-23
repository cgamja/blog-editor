import type { Mark } from "@blog-editor/content-schema";
import { HEADING_LEVELS } from "@blog-editor/content-schema";

/** 바깥부터 a > strong > em > code 고정(입력 마크 순서 무관, spec: html-render) — 안에서 바깥으로 감싼다. */
export const MARK_INNER_TO_OUTER: readonly Mark["type"][] = ["code", "italic", "bold", "link"];

/**
 * heading level → 태그 이름. 태그 이름은 이스케이프로 막을 수 없으므로(공백 · `=`가 그대로 남는다)
 * 닫힌 표에서만 꺼낸다 — 검증되지 않은 level은 렌더가 아니라 오류다(spec: render-safety).
 */
export const HEADING_TAGS: Readonly<Record<(typeof HEADING_LEVELS)[number], string>> = {
  2: "h2",
  3: "h3",
};
