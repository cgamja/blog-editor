/**
 * AI 수정 되돌리기를 거절한 까닭(ADR-041) — REST 422 `reason`과 MCP 오류 문장이 같은 것을 쓴다.
 * 글이 없는 것은 여기 없다 — REST는 404, MCP는 "글이 없다" 문장이다.
 */
export const AI_UNDO_UNAVAILABLE_REASONS = ["nothing", "newPost", "changed", "published"] as const;
export type AiUndoUnavailableReason = (typeof AI_UNDO_UNAVAILABLE_REASONS)[number];
