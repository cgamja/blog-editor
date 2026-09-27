import { useId } from "react";
import { scoreSeo } from "@blog-editor/content-schema";
import type { SeoTarget } from "@blog-editor/content-schema";
import { usePopover } from "../hooks/use-popover";
import { EDITOR_MESSAGES } from "../messages";
import type { SeoCheck } from "../types";
import { SeoFindingButtons } from "./SeoFindingButtons";

export interface SeoChipProps {
  /** 머리줄이 입력마다 다시 매긴 점검(`useSeoLive`) — 발행 확인과 같은 `seoCheckOf` */
  check: SeoCheck;
  /** 문서가 바뀌어 다시 매기기 전 — 블록 번호가 어긋날 수 있어 블록 항목을 막는다(`useSeoLive`) */
  isStale: boolean;
  onChoose: (target: SeoTarget) => void;
}

interface ChipView {
  name: string;
  value: string;
  mustCount: number;
}

function chipViewOf(check: SeoCheck): ChipView {
  const { seo } = EDITOR_MESSAGES;
  if (check.kind === "checked") {
    const score = scoreSeo(check.findings);
    const mustCount = check.findings.filter((finding) => finding.level === "must").length;
    return { name: seo.chipName(score, mustCount), value: String(score), mustCount };
  }
  // 다른 글 목록 없이 매긴 점수는 보이지 않는다(#166) — 점수 자리에 까닭을 둔다
  const value = check.kind === "othersLoading" ? seo.chipLoading : seo.chipUnavailable;
  return { name: seo.chipStatusName(value), value, mustCount: 0 };
}

/**
 * 머리줄 검색 노출 칩과 점검 팝오버(#151 디자인 C) — 점수와 꼭 고치기 개수를 늘 보이고, 누르면 발견 목록.
 * 항목을 누르면 팝오버를 닫고 그 자리(본문 블록 · 메타 칸)로 간다. 발행은 막지 않는다.
 */
export function SeoChip({ check, isStale, onChoose }: SeoChipProps) {
  const { seo } = EDITOR_MESSAGES;
  const popover = usePopover();
  const popoverId = useId();
  const view = chipViewOf(check);

  const choose = (target: SeoTarget) => {
    popover.close();
    onChoose(target);
  };

  return (
    <div className="seo-chip-wrap">
      <button
        ref={popover.buttonRef}
        type="button"
        className="seo-chip"
        aria-label={view.name}
        aria-expanded={popover.open}
        aria-controls={popover.open ? popoverId : undefined}
        onClick={popover.toggle}
      >
        <span className="seo-chip-label">{seo.chip}</span>{" "}
        <span className="seo-chip-value" data-kind={check.kind}>
          {view.value}
        </span>
        {view.mustCount > 0 && (
          <>
            {" "}
            <span className="seo-chip-must">{view.mustCount}</span>
          </>
        )}
      </button>
      {popover.open && (
        <div
          ref={popover.popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={seo.heading}
          tabIndex={-1}
          className="seo-popover"
        >
          <SeoPopoverBody check={check} isStale={isStale} onChoose={choose} />
          <p className="seo-popover-note">{seo.notBlocking}</p>
        </div>
      )}
    </div>
  );
}

function SeoPopoverBody({ check, isStale, onChoose }: SeoChipProps) {
  const { seo } = EDITOR_MESSAGES;
  if (check.kind === "unreadable") return <p className="seo-popover-empty">{seo.unavailable}</p>;
  if (check.kind === "othersLoading") {
    return <p className="seo-popover-empty">{seo.othersLoading}</p>;
  }
  if (check.kind === "othersFailed") {
    return (
      <div className="seo-checklist-failed">
        <p className="seo-popover-empty">{seo.othersFailed}</p>
        <button type="button" className="editor-save-retry" onClick={check.retry}>
          {seo.retry}
        </button>
      </div>
    );
  }
  const hasMust = check.findings.some((finding) => finding.level === "must");
  return (
    <>
      <p className="seo-popover-score">{seo.score(scoreSeo(check.findings))}</p>
      {hasMust && <p className="seo-checklist-notice">{seo.mustNotice}</p>}
      <SeoFindingButtons findings={check.findings} isStale={isStale} onChoose={onChoose} />
    </>
  );
}
