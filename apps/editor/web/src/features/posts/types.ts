/**
 * `GET /api/posts`의 한 줄(api/openapi.json `PostList`) — 계약 생성기가 들어오기 전까지 손으로 맞춘다.
 * `source`는 `editor` · `claude` · `chatgpt` · `token:<이름>`, 날짜는 `YYYY-MM-DD`.
 */
export interface PostSummary {
  slug: string;
  title: string;
  date: string;
  updated?: string;
  category: string;
  draft: boolean;
  source: string;
}

/** 목록 탭 — `?tab=` 값과 같다 */
export type PostTab = "all" | "draft" | "published";

export type TabCounts = Readonly<Record<PostTab, number>>;

/** 목록에서 여는 대화상자 — `?dialog=` 값과 같다 */
export type ListDialog = "import" | "write-ai";
