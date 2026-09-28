import { checkSeo } from "@blog-editor/content-schema";
import type { SeoFinding, SeoLevel, SeoTarget } from "@blog-editor/content-schema";
import type { BlockFlag, BlockFlagTone } from "@blog-editor/editor-react";
import { EDITOR_MESSAGES } from "./messages";
import type { SeoCheck, SeoCheckInput } from "./types";

/**
 * 검색 노출 점검 — 발행 확인과 머리줄 칩이 같은 이 함수로 매긴다(adr-030 · adr-034).
 * 다른 글과의 중복 비교 없이 매긴 점수는 MCP가 주는 점수와 달라 보이지 않는다(#166).
 */
export function seoCheckOf({ slug, meta, doc, others }: SeoCheckInput): SeoCheck {
  if (doc === null) return { kind: "unreadable" };
  if (others.kind === "loading") return { kind: "othersLoading" };
  if (others.kind === "failed") return { kind: "othersFailed", retry: others.retry };
  return { kind: "checked", findings: checkSeo({ slug, meta, doc, others: others.posts }) };
}

/** 발견이 가리키는 곳의 이름 — 팝오버 항목의 「→ 위치」 */
export function seoPlaceOf(target: SeoTarget): string {
  const { places } = EDITOR_MESSAGES.seo;
  if (target.kind === "meta") return places[target.field];
  if (target.kind === "block") return places.block(target.block);
  return places.body;
}

const TONE_OF_LEVEL: Record<SeoLevel, BlockFlagTone> = {
  must: "strong",
  should: "medium",
  info: "weak",
};

/** 블록을 가리키는 발견만 본문 여백 점으로 — 이름은 "<등급>: <문구>" */
export function seoFlagsOf(findings: readonly SeoFinding[]): BlockFlag[] {
  const { seo } = EDITOR_MESSAGES;
  return findings.flatMap((finding) =>
    finding.target.kind === "block"
      ? [
          {
            // 순번이 아니라 규칙 · 블록으로 — 다시 매겨도 같은 발견은 같은 id라 강조 상태가 다른 점에 옮겨 붙지 않는다
            id: `${finding.rule}-${finding.target.block}`,
            // 발견의 블록 번호는 1부터(변환 메시지의 "블록 N"), 점은 0부터다
            index: finding.target.block - 1,
            label: seo.dotName(seo.levels[finding.level], finding.message),
            tone: TONE_OF_LEVEL[finding.level],
          },
        ]
      : [],
  );
}
