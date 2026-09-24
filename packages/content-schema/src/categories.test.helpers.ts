/**
 * 2개 이상의 테스트 파일이 같이 쓰는 최소 헬퍼만 둔다(adr/0034 ③) — 픽스처 자체나
 * 시나리오별 입력은 각 테스트 파일에 인라인한다(DAMP).
 */

/** 사이트 BLOG_CATEGORIES — post-file.test.ts · fixtures.test.ts가 같이 쓴다(document-fixtures spec). */
export const BLOG_CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
