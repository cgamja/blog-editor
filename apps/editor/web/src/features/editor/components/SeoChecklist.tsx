import { useId } from "react";
import type { SeoFinding } from "@blog-editor/content-schema";
import { EDITOR_MESSAGES } from "../messages";
import { SeoChecklistResult } from "./SeoChecklistResult";

export interface SeoChecklistProps {
  /** `checkSeo` 결과(이미 must → should → info 순서). 문서를 읽지 못했으면 null */
  findings: readonly SeoFinding[] | null;
}

/** 발행 확인 안의 검색 노출 점검(adr-030) — 점수(adr-034)와 무엇이 문제이고 어떻게 고치는지를 보인다 */
export function SeoChecklist({ findings }: SeoChecklistProps) {
  const { seo } = EDITOR_MESSAGES;
  const headingId = useId();
  return (
    <section className="seo-checklist">
      <h3 id={headingId} className="seo-checklist-heading">
        {seo.heading}
      </h3>
      {findings === null ? (
        <p className="seo-checklist-empty">{seo.unavailable}</p>
      ) : (
        <SeoChecklistResult findings={findings} headingId={headingId} />
      )}
    </section>
  );
}
