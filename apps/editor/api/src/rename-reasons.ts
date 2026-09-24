/** 주소 바꾸기 409의 이유 — 화면이 충돌 대화상자(stale)와 주소 칸 문장(published · taken)으로 나눈다 */
export const RENAME_CONFLICT_REASONS = ["published", "stale", "taken"] as const;
export type RenameConflictReason = (typeof RENAME_CONFLICT_REASONS)[number];
