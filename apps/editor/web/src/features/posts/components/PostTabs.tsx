import { Link } from "react-router";
import { POST_TABS, TAB_PARAM } from "../constants";
import { POSTS_MESSAGES } from "../messages";
import type { PostTab, TabCounts } from "../types";

interface PostTabsProps {
  current: PostTab;
  counts: TabCounts;
}

const tabLink = (tab: PostTab) => (tab === "all" ? "?" : `?${TAB_PARAM}=${tab}`);

/**
 * 상태 거르기 — 탭 값이 주소(`?tab=`)에 있어 뒤로 가기 · 새로 고침이 그대로 된다. 그래서 ARIA tabs(패널 전환)가
 * 아니라 링크 묶음 + `aria-current`로 둔다(https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ 는 같은 화면 안 전환용).
 */
export function PostTabs({ current, counts }: PostTabsProps) {
  return (
    <nav className="post-tabs" aria-label={POSTS_MESSAGES.tabsLabel}>
      {POST_TABS.map((tab) => (
        <Link
          key={tab}
          to={tabLink(tab)}
          className="post-tab"
          aria-current={tab === current ? "page" : undefined}
        >
          {POSTS_MESSAGES.tabs[tab]}
          <span className="post-tab__count">{counts[tab]}</span>
        </Link>
      ))}
    </nav>
  );
}
