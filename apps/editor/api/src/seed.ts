/**
 * 1단계 시드 값(adr-007 — 계정 1개 · 워크스페이스 1개). 로컬(serve.ts)과 배포(edge.ts) 진입점이 같은 값을 써야
 * 같은 저장 경로 · 카테고리 · 계정으로 돈다 — 한 곳에 둔다.
 */
export const DEFAULT_WORKSPACE_ID = "default";
// 1단계 워크스페이스 카테고리 — 사이트 BLOG_CATEGORIES와 같다. 설정 API는 읽기만 한다(카테고리 편집은 기존 글 이관과 함께)
export const DEFAULT_CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
export const SEED_ACCOUNT_ID = "owner";
export const DEFAULT_USERNAME = "admin";
export const DEFAULT_IMAGE_BASE_URL = "https://simsimeestudio.com";
