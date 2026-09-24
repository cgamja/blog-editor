import { EDITOR_SOURCE, LIST_DIALOGS, POST_TABS } from "./constants";
import type { ListDialog, PostSummary, PostTab, TabCounts } from "./types";

const DEFAULT_TAB: PostTab = "all";

const isOneOf = <T extends string>(values: readonly T[], value: string | null): value is T =>
  value !== null && (values as readonly string[]).includes(value);

/** `?tab=` 값 → 탭. 모르는 값 · 없음은 전체 */
export function tabOf(param: string | null): PostTab {
  return isOneOf(POST_TABS, param) ? param : DEFAULT_TAB;
}

export function countByTab(posts: readonly PostSummary[]): TabCounts {
  const drafts = posts.filter(({ draft }) => draft).length;
  return { all: posts.length, draft: drafts, published: posts.length - drafts };
}

export function postsOfTab(posts: readonly PostSummary[], tab: PostTab): PostSummary[] {
  if (tab === "all") return [...posts];
  const wantDraft = tab === "draft";
  return posts.filter(({ draft }) => draft === wantDraft);
}

const lastEditedOf = ({ updated, date }: PostSummary) => updated ?? date;

/** 고친 날 최신순, 같으면 주소순 — `YYYY-MM-DD`는 문자열 비교가 날짜 비교다 */
export function sortByLastEdited(posts: readonly PostSummary[]): PostSummary[] {
  return [...posts].sort(
    (a, b) => lastEditedOf(b).localeCompare(lastEditedOf(a)) || a.slug.localeCompare(b.slug),
  );
}

/** `2026-09-21` → `9월 21일`. Intl 출력은 환경마다 공백 · 점이 달라 숫자로 조립한다 */
export function lastEditedLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}월 ${day}일`;
}

export const lastEditedLabelOf = (post: PostSummary) => lastEditedLabel(lastEditedOf(post));

/** 에디터 밖(Claude · ChatGPT · 연결 토큰)에서 올라온 초안 — 발행된 글에는 붙이지 않는다(문구가 "초안") */
export function isAiDraft(post: PostSummary): boolean {
  return post.draft && post.source !== EDITOR_SOURCE;
}

/** `?dialog=` 값 → 목록 대화상자. 모르는 값은 아무것도 열지 않는다 */
export function listDialogOf(param: string | null): ListDialog | null {
  return isOneOf(LIST_DIALOGS, param) ? param : null;
}
