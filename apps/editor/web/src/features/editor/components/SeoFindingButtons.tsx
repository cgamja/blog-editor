import type { SeoFinding, SeoTarget } from "@blog-editor/content-schema";
import { EDITOR_MESSAGES } from "../messages";
import { seoPlaceOf } from "../seo-check";

export interface SeoFindingButtonsProps {
  /** `checkSeo` 결과(이미 must → should → info 순서) */
  findings: readonly SeoFinding[];
  /** 문서가 바뀌어 다시 매기기 전 — 블록을 가리키는 항목은 옛 번호라 누르지 못하게 한다 */
  isStale: boolean;
  onChoose: (target: SeoTarget) => void;
}

/** 팝오버 안 발견 목록 — 등급 pill · 문구 · 「→ 위치」, 누르면 그 자리로 간다(#151 디자인 C) */
export function SeoFindingButtons({ findings, isStale, onChoose }: SeoFindingButtonsProps) {
  const { seo } = EDITOR_MESSAGES;
  if (findings.length === 0) return <p className="seo-popover-empty">{seo.empty}</p>;
  const blocksPending = isStale && findings.some((finding) => finding.target.kind === "block");
  return (
    <>
      {blocksPending && <p className="seo-popover-empty">{seo.blockPending}</p>}
      <ul className="seo-popover-list">
        {findings.map((finding, index) => (
          <li key={`${finding.rule}-${index}`}>
            <button
              type="button"
              className="seo-popover-item"
              disabled={isStale && finding.target.kind === "block"}
              onClick={() => onChoose(finding.target)}
            >
              <span className="seo-checklist-level" data-level={finding.level}>
                {seo.levels[finding.level]}
              </span>
              <span className="seo-popover-message">{finding.message}</span>
              <span className="seo-popover-place">{seo.goTo(seoPlaceOf(finding.target))}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
