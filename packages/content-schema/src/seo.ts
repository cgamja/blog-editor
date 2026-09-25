import type { Doc } from "./doc";
import {
  HARD_BREAK_TEXT,
  INTERNAL_HREF_PREFIX,
  QUESTION_MARK,
  SEO_BODY_MIN_CHARS,
  SEO_DESCRIPTION_LENGTH,
  SEO_FIRST_PARAGRAPH_MAX,
  SEO_LEVEL_PENALTY,
  SEO_LEVELS,
  SEO_META_FIELDS,
  SEO_SCORE_MAX,
  SEO_SCORE_MIN,
  SEO_TITLE_LENGTH,
} from "./seo.constants";
import { SEO_MESSAGES } from "./seo.messages";
import type { SeoFinding, SeoInput, SeoLevel, SeoOtherPost, SeoRule, SeoTarget } from "./seo.types";

type Block = Doc["content"][number];

/** 문서 노드를 스키마 모양과 무관하게 훑기 위한 최소 모양 — 글자 · 마크 · 자식만 본다 */
interface AnyNode {
  type: string;
  text?: string;
  marks?: readonly { type: string; attrs?: { href?: string } }[];
  content?: readonly AnyNode[];
}

/** 글자 수 — 자모가 나뉜 NFD 한글(macOS 복사 등)도 음절 하나로 센다 */
const charCount = (text: string) => [...text.normalize("NFC")].length;

/** 글자가 있는 첫 최상위 문단 — 블록 번호는 1부터 */
interface FirstParagraph {
  block: number;
  text: string;
}

/** 중복 비교 — 앞뒤 · 연속 공백과 대소문자를 무시한다 */
const comparable = (text: string) =>
  text.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** 검색어 포함 — 공백을 모두 빼고 본다("봄 산책" ↔ "봄산책") */
const compact = (text: string) => text.normalize("NFC").replace(/\s+/g, "").toLowerCase();

function textOf(node: AnyNode): string {
  if (node.text !== undefined) return node.text;
  if (node.type === "hardBreak") return HARD_BREAK_TEXT;
  return (node.content ?? []).map(textOf).join("");
}

function hasInternalLink(node: AnyNode): boolean {
  const linksInside = (node.marks ?? []).some(
    (mark) => mark.type === "link" && mark.attrs?.href?.startsWith(INTERNAL_HREF_PREFIX) === true,
  );
  return linksInside || (node.content ?? []).some(hasInternalLink);
}

function outOfRange(length: number, range: { min: number; max: number }): boolean {
  return length < range.min || length > range.max;
}

function finding(level: SeoLevel, rule: SeoRule, target: SeoTarget): SeoFinding {
  return { level, rule, target, ...SEO_MESSAGES[rule] };
}

function positionOf(target: SeoTarget): number {
  if (target.kind === "meta") return SEO_META_FIELDS.indexOf(target.field);
  if (target.kind === "block") return SEO_META_FIELDS.length + target.block;
  return Number.MAX_SAFE_INTEGER;
}

function byLevelThenPosition(a: SeoFinding, b: SeoFinding): number {
  return (
    SEO_LEVELS.indexOf(a.level) - SEO_LEVELS.indexOf(b.level) ||
    positionOf(a.target) - positionOf(b.target)
  );
}

function metaFindings({ slug, meta, others }: SeoInput): SeoFinding[] {
  const found: SeoFinding[] = [];
  const rivals = others.filter((other) => other.slug !== slug);
  if (rivals.some((other) => comparable(other.title) === comparable(meta.title))) {
    found.push(finding("must", "duplicate-title", { kind: "meta", field: "title" }));
  }
  const description = comparable(meta.description);
  if (
    rivals.some(
      (other) => other.description !== undefined && comparable(other.description) === description,
    )
  ) {
    found.push(finding("must", "duplicate-description", { kind: "meta", field: "description" }));
  }
  if (outOfRange(charCount(meta.title.trim()), SEO_TITLE_LENGTH)) {
    found.push(finding("should", "title-length", { kind: "meta", field: "title" }));
  }
  if (outOfRange(charCount(meta.description.trim()), SEO_DESCRIPTION_LENGTH)) {
    found.push(finding("should", "description-length", { kind: "meta", field: "description" }));
  }
  return found;
}

function keywordFindings({ meta }: SeoInput, first: FirstParagraph | null): SeoFinding[] {
  const keyword = meta.keyword?.trim() ?? "";
  if (keyword === "")
    return [finding("info", "keyword-missing", { kind: "meta", field: "keyword" })];
  const found: SeoFinding[] = [];
  if (!compact(meta.title).includes(compact(keyword))) {
    found.push(finding("should", "keyword-in-title", { kind: "meta", field: "title" }));
  }
  if (first !== null && !compact(first.text).includes(compact(keyword))) {
    found.push(
      finding("should", "keyword-in-first-paragraph", { kind: "block", block: first.block }),
    );
  }
  return found;
}

function firstParagraphOf(blocks: readonly Block[]): FirstParagraph | null {
  const index = blocks.findIndex(
    (block) => block.type === "paragraph" && textOf(block as AnyNode).trim() !== "",
  );
  if (index === -1) return null;
  return { block: index + 1, text: textOf(blocks[index] as AnyNode) };
}

function bodyFindings({ slug, doc, others }: SeoInput, first: FirstParagraph | null): SeoFinding[] {
  const blocks = doc.content;
  const found: SeoFinding[] = [];
  blocks.forEach((block, index) => {
    if (block.type === "image" && block.attrs.alt.trim() === "") {
      found.push(finding("must", "image-alt", { kind: "block", block: index + 1 }));
    }
  });
  const headings = blocks.flatMap((block, index) =>
    block.type === "heading" ? [{ block: index + 1, text: textOf(block as AnyNode).trim() }] : [],
  );
  const firstHeading = headings[0];
  if (firstHeading === undefined) {
    found.push(finding("must", "heading-missing", { kind: "body" }));
  } else if (!headings.some((heading) => heading.text.endsWith(QUESTION_MARK))) {
    found.push(finding("info", "question-heading", { kind: "block", block: firstHeading.block }));
  }
  if (first !== null && charCount(first.text) > SEO_FIRST_PARAGRAPH_MAX) {
    found.push(finding("should", "first-paragraph-length", { kind: "block", block: first.block }));
  }
  // 이을 글이 있을 때만 — 자기 글은 이을 대상이 아니다(중복 비교와 같은 규칙)
  const hasOtherPosts = others.some((other) => other.slug !== slug);
  if (hasOtherPosts && !blocks.some((block) => hasInternalLink(block as AnyNode))) {
    found.push(finding("info", "internal-link-missing", { kind: "body" }));
  }
  const bodyText = blocks
    .filter((block) => block.type !== "codeBlock")
    .map((block) => textOf(block as AnyNode))
    .join("");
  if (charCount(bodyText.replace(/\s+/g, "")) < SEO_BODY_MIN_CHARS) {
    found.push(finding("info", "body-short", { kind: "body" }));
  }
  return found;
}

/**
 * 글 내용 SEO 점검(adr-030) — AI · 네트워크를 부르지 않는 규칙 검사다. 발견을 돌려줄 뿐 저장 · 발행을
 * 막지 않는다. MCP 쓰기 도구 응답과 에디터 발행 확인이 같은 함수를 쓴다.
 */
export function checkSeo(input: SeoInput): SeoFinding[] {
  const first = firstParagraphOf(input.doc.content);
  return [
    ...metaFindings(input),
    ...keywordFindings(input, first),
    ...bodyFindings(input, first),
  ].sort(byLevelThenPosition);
}

/**
 * 목록 요약을 비교 대상으로 — web(GET /api/posts)과 MCP(저장소 목록)가 같은 함수로 만들어 같은 점수를 얻는다
 * (adr-034). 목록은 저장소가 검증 없이 준 값이라 제목이 문자열인 항목만, 설명은 문자열일 때만 쓴다.
 */
export function seoOthersOf(
  summaries: readonly { slug: string; title?: unknown; description?: unknown }[],
): SeoOtherPost[] {
  return summaries.flatMap(({ slug, title, description }) =>
    typeof title === "string"
      ? [{ slug, title, description: typeof description === "string" ? description : undefined }]
      : [],
  );
}

/**
 * 검색 노출 점수 0~100(adr-034) — 만점에서 규칙 하나당 한 번 그 등급의 감점을 뺀다. 같은 규칙이 여러 블록에서
 * 걸려도(alt 없는 이미지 여럿) 고칠 일은 한 종류라 한 번만 뺀다. 저장 · 발행을 막지 않는다(adr-030).
 */
export function scoreSeo(findings: readonly SeoFinding[]): number {
  const levelByRule = new Map(findings.map(({ rule, level }) => [rule, level]));
  const penalty = [...levelByRule.values()].reduce(
    (sum, level) => sum + SEO_LEVEL_PENALTY[level],
    0,
  );
  return Math.max(SEO_SCORE_MIN, SEO_SCORE_MAX - penalty);
}
