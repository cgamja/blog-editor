import { scoreSeo } from "@blog-editor/content-schema";
import type { SeoFinding } from "@blog-editor/content-schema";
import { EDITOR_MESSAGES } from "../messages";

export interface SeoChecklistResultProps {
  /** `checkSeo` 결과(이미 must → should → info 순서) */
  findings: readonly SeoFinding[];
  /** 목록 이름이 되는 점검 제목의 id */
  headingId: string;
}

/** 점검한 결과 — 점수(adr-034) · must 알림 · 발견 목록(없으면 "점검할 것이 없어요") */
export function SeoChecklistResult({ findings, headingId }: SeoChecklistResultProps) {
  const { seo } = EDITOR_MESSAGES;
  const hasMust = findings.some((finding) => finding.level === "must");
  return (
    <>
      <p className="seo-checklist-score">{seo.score(scoreSeo(findings))}</p>
      {hasMust && <p className="seo-checklist-notice">{seo.mustNotice}</p>}
      {findings.length === 0 ? (
        <p className="seo-checklist-empty">{seo.empty}</p>
      ) : (
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
    </>
  );
}
