import type { ListDialog, PostSummary, PostTab } from "./types";

/** 목록 한 줄의 필수 · 선택 키 — api.test.ts가 계약 PostList 항목의 required · properties와 견준다 */
export const POST_SUMMARY_KEYS = [
  "slug",
  "title",
  "date",
  "category",
  "draft",
  "source",
] as const satisfies readonly (keyof PostSummary)[];
export const POST_SUMMARY_OPTIONAL_KEYS = [
  "updated",
] as const satisfies readonly (keyof PostSummary)[];

export const POSTS_QUERY_KEY = ["posts"] as const;
export const POSTS_PATH = "/api/posts";

export const POST_TABS: readonly PostTab[] = ["all", "draft", "published"];
export const TAB_PARAM = "tab";

/** 가져오기 · AI로 쓰기 — 대화상자는 라우터가 `PostListPage`의 `dialogs`로 넘긴다(#98) */
export const LIST_DIALOGS: readonly ListDialog[] = ["import", "write-ai"];
export const DIALOG_PARAM = "dialog";

/** 에디터에서 쓴 글의 출처 값(api/openapi.json `source`) — 그 밖은 AI · 연결 토큰에서 온 글 */
export const EDITOR_SOURCE = "editor";
