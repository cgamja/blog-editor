import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { screenMessages } from "./screen-messages";
import { tabIndexAfterKey } from "./screen-tabs";
import type { SideTab } from "./screen-types";

export interface SideTabsProps {
  postInfo: ReactNode;
  decorate: ReactNode;
  initialTab: SideTab;
  /** 바깥에서 고르는 탭 — 없으면 스스로 고른다(React 제어 · 비제어 컴포넌트) */
  tab?: SideTab | undefined;
  onTabChange?: ((tab: SideTab) => void) | undefined;
}

const TABS: readonly SideTab[] = ["postInfo", "decorate"];
const TAB_LABELS: Record<SideTab, string> = {
  postInfo: screenMessages.postInfoTab,
  decorate: screenMessages.decorateTab,
};

/**
 * 옆 패널 탭 「글 정보」 | 「꾸미기」(디자인 69:2). 자동 활성화 · 로빙 tabindex(WAI-ARIA APG Tabs,
 * https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). 두 패널 모두 마운트해 두고 hidden으로 가린다 —
 * 탭을 바꿔도 꾸미기 패널의 미리 보기 상태가 끊기지 않는다.
 */
export function SideTabs({ postInfo, decorate, initialTab, tab, onTabChange }: SideTabsProps) {
  const [ownTab, setOwnTab] = useState<SideTab>(initialTab);
  const active = tab ?? ownTab;
  const setActive = (next: SideTab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const tabId = (tab: SideTab) => `${baseId}-tab-${tab}`;
  const panelId = (tab: SideTab) => `${baseId}-panel-${tab}`;
  const panels: Record<SideTab, ReactNode> = { postInfo, decorate };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = tabIndexAfterKey(TABS.indexOf(active), event.key, TABS.length);
    if (next === null) return;
    event.preventDefault();
    setActive(TABS[next]!);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="editor-screen-side">
      <div className="editor-screen-tabs" role="tablist" aria-label={screenMessages.sideLabel}>
        {TABS.map((tab, index) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={tabId(tab)}
            aria-selected={active === tab}
            aria-controls={panelId(tab)}
            tabIndex={active === tab ? 0 : -1}
            className="editor-screen-tab"
            onClick={() => setActive(tab)}
            onKeyDown={handleKeyDown}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          hidden={active !== tab}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- APG Tabs: 패널 첫 내용이 포커스를 못 받으면(글 정보 자리 표시) tabpanel이 탭 순서에 든다. https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
          tabIndex={0}
          className="editor-screen-panel"
        >
          {panels[tab]}
        </div>
      ))}
    </div>
  );
}
