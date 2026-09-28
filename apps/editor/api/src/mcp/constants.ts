/** MCP 토큰 하나가 여는 권한 — 초안 읽기 · 쓰기뿐(adr-007). 발행 범위는 없다. 연결용 토큰 · OAuth 토큰이 같이 쓴다 */
export const DRAFTS_SCOPE = "drafts";

/** preview_post 폭(ADR-042) — 사이트 기본 폭 1280, 흔한 휴대폰 폭 390. 응답 이미지도 이 순서(데스크톱 · 모바일)다 */
export const PREVIEW_WIDTHS = { desktop: 1280, mobile: 390 } as const;
/**
 * preview_post 한 장의 긴 변 상한(px) — Claude가 이보다 큰 이미지는 줄여 읽어 글자가 뭉개진다(ADR-042).
 * 폭은 이보다 작으므로 이 값이 곧 한 구간의 높이 상한이다.
 */
export const PREVIEW_MAX_EDGE = 1568;
