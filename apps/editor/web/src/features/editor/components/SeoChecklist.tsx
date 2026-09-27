import { useId } from "react";
import { EDITOR_MESSAGES } from "../messages";
import type { SeoCheck } from "../types";
import { SeoChecklistResult } from "./SeoChecklistResult";

export interface SeoChecklistProps {
  /** 점검 결과(`checkSeo`, 이미 must → should → info 순서) 또는 점검하지 못한 까닭 */
  check: SeoCheck;
}

/** 발행 확인 안의 검색 노출 점검(adr-030) — 점수(adr-034)와 무엇이 문제이고 어떻게 고치는지를 보인다 */
export function SeoChecklist({ check }: SeoChecklistProps) {
  const { seo } = EDITOR_MESSAGES;
  const headingId = useId();
  return (
    <section className="seo-checklist">
      <h3 id={headingId} className="seo-checklist-heading">
        {seo.heading}
      </h3>
      {check.kind === "unreadable" && <p className="seo-checklist-empty">{seo.unavailable}</p>}
      {check.kind === "othersLoading" && <p className="seo-checklist-empty">{seo.othersLoading}</p>}
      {check.kind === "othersFailed" && (
        <div className="seo-checklist-failed">
          <p className="seo-checklist-empty">{seo.othersFailed}</p>
          <button type="button" className="editor-save-retry" onClick={check.retry}>
            {seo.retry}
          </button>
        </div>
      )}
      {check.kind === "checked" && (
        <SeoChecklistResult findings={check.findings} headingId={headingId} />
      )}
    </section>
  );
}
