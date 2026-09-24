export const SETTINGS_PATH = "/api/settings";
export const SETTINGS_QUERY_KEY = ["settings"] as const;
/** 글쓰기 가이드 상한 — api `input-limits.ts` `MAX_GUIDE_LENGTH`와 같은 값(계약 400 문장에도 있다) */
export const GUIDE_MAX_LENGTH = 20_000;
/** 가이드 입력칸 높이(줄) — Figma 70:2 textarea rows */
export const GUIDE_ROWS = 9;
