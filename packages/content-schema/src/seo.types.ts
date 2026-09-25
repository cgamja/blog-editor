import type { Doc } from "./doc";
import type { SEO_LEVELS, SEO_META_FIELDS, SEO_RULES } from "./seo.constants";

export type SeoLevel = (typeof SEO_LEVELS)[number];
export type SeoRule = (typeof SEO_RULES)[number];
export type SeoMetaField = (typeof SEO_META_FIELDS)[number];

/** 발견이 가리키는 곳 — 메타 칸 · 최상위 블록(1부터, 변환 메시지의 "블록 N"과 같은 셈) · 글 전체 */
export type SeoTarget =
  { kind: "meta"; field: SeoMetaField } | { kind: "block"; block: number } | { kind: "body" };

export interface SeoFinding {
  level: SeoLevel;
  rule: SeoRule;
  target: SeoTarget;
  message: string;
  fix: string;
}

/** 중복 비교에 쓰는 다른 글 요약 — 목록 API에는 설명이 없어 선택이다 */
export interface SeoOtherPost {
  slug: string;
  title: string;
  description?: string | undefined;
}

export interface SeoInput {
  /** 검사하는 글의 주소 — `others`에서 자기 자신을 빼는 데 쓴다 */
  slug?: string | undefined;
  meta: { title: string; description: string; keyword?: string | undefined };
  doc: Doc;
  others: readonly SeoOtherPost[];
}
