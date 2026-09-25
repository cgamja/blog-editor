import { useId } from "react";
import type { SeoFinding } from "@blog-editor/content-schema";
import { EDITOR_MESSAGES } from "../messages";

export interface SeoChecklistProps {
  /** `checkSeo` 결과(이미 must → should → info 순서). 문서를 읽지 못했으면 null */
  findings: readonly SeoFinding[] | null;
}

/** 발행 확인 안의 검색 노출 점검 목록(adr-030) — 무엇이 문제이고 어떻게 고치는지만 보인다 */
export function SeoChecklist({ findings }: SeoChecklistProps) {
  const { seo } = EDITOR_MESSAGES;
  const headingId = useId();
  const hasMust = findings?.some((finding) => finding.level === "must") === true;
  return (
    <section className="seo-checklist">
      <h3 id={headingId} className="seo-checklist-heading">
        {seo.heading}
      </h3>
      {hasMust && <p className="seo-checklist-notice">{seo.mustNotice}</p>}
      {findings === null && <p className="seo-checklist-empty">{seo.unavailable}</p>}
      {findings?.length === 0 && <p className="seo-checklist-empty">{seo.empty}</p>}
      {findings !== null && findings.length > 0 && (
        <ul className="seo-checklist-list" aria-labelledby={headingId}>
          {findings.map((finding, index) => (
            <li key={`${finding.rule}-${index}`} className="seo-checklist-item">
              <span className="seo-checklist-level" data-level={finding.level}>
                {seo.levels[finding.level]}
              </span>
              <span className="seo-checklist-text">
                <span>{finding.message}</span>
                <span className="seo-checklist-fix">{finding.fix}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
