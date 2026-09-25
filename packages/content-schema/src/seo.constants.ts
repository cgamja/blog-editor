/**
 * 글 내용 SEO 검사의 기준(adr-030). 구글은 제목 · 설명 · 본문 길이에 고정 규칙이 없다고 한다 —
 * 제목 링크 https://developers.google.com/search/docs/appearance/title-link ·
 * 스니펫 https://developers.google.com/search/docs/appearance/snippet ·
 * 본문 길이("no magical word count target") https://developers.google.com/search/docs/fundamentals/seo-starter-guide.
 * 그래서 아래 숫자는 한국어 검색 결과 화면(데스크톱 · 모바일에서 잘리는 지점)을 보고 잡은 작업값이고,
 * 이 규칙들은 must가 아니라 should · info로 둔다.
 */

export const SEO_LEVELS = ["must", "should", "info"] as const;

export const SEO_RULES = [
  "image-alt",
  "heading-missing",
  "duplicate-title",
  "duplicate-description",
  "title-length",
  "description-length",
  "first-paragraph-length",
  "keyword-in-title",
  "keyword-in-first-paragraph",
  "keyword-missing",
  "internal-link-missing",
  "question-heading",
  "body-short",
] as const;

/** 발견이 가리킬 수 있는 메타 칸 — 정렬도 이 순서다 */
export const SEO_META_FIELDS = ["title", "description", "keyword"] as const;

/** 검색 결과 제목이 잘리지 않고 너무 짧지도 않은 범위(글자) */
export const SEO_TITLE_LENGTH = { min: 10, max: 35 } as const;

/** 검색 결과 설명으로 보이는 범위(글자) — 저장 상한은 DESCRIPTION_MAX_LENGTH(160)로 따로다 */
export const SEO_DESCRIPTION_LENGTH = { min: 40, max: 120 } as const;

/** 첫 문단은 질문에 바로 답하는 짧은 요약이어야 스니펫 · AI 답변에 뽑힌다 */
export const SEO_FIRST_PARAGRAPH_MAX = 200;

/** 이보다 짧으면 알리기만 한다(info) — 구글 공식 최소치가 아니다 */
export const SEO_BODY_MIN_CHARS = 500;

/** 내부 경로 링크 — hrefSchema가 허용하는 `/`로 시작하는 경로(`//`는 hrefSchema가 이미 막는다) */
export const INTERNAL_HREF_PREFIX = "/";

/** 질문형 소제목의 끝 */
export const QUESTION_MARK = "?";

/** 강제 줄바꿈은 줄바꿈 한 글자다 — 빈 글자로 읽으면 줄 앞뒤 글자가 한 낱말로 붙는다 */
export const HARD_BREAK_TEXT = "\n";
