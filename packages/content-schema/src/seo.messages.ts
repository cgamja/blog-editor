import {
  SEO_BODY_MIN_CHARS,
  SEO_DESCRIPTION_LENGTH,
  SEO_FIRST_PARAGRAPH_MAX,
  SEO_TITLE_LENGTH,
} from "./seo.constants";
import type { SeoRule } from "./seo.types";

/** 사람과 AI가 읽는 문장 — MCP 응답 · 발행 확인 목록이 그대로 보인다 */
export const SEO_MESSAGES = {
  "image-alt": {
    message: "이미지 설명(alt)이 비어 있어요.",
    fix: "사진에 무엇이 보이는지 한 문장으로 적어요. 검색 · 화면 읽기 프로그램이 이 글을 읽어요.",
  },
  "heading-missing": {
    message: "소제목이 하나도 없어요.",
    fix: "내용을 나누는 소제목(##)을 두세 개 넣어요.",
  },
  "duplicate-title": {
    message: "다른 글과 제목이 같아요.",
    fix: "이 글만의 내용이 드러나게 제목을 바꿔요.",
  },
  "duplicate-description": {
    message: "다른 글과 설명이 같아요.",
    fix: "이 글의 요점을 담아 설명을 새로 써요.",
  },
  "title-length": {
    message: `제목이 권장 길이(${SEO_TITLE_LENGTH.min}~${SEO_TITLE_LENGTH.max}자)를 벗어나요.`,
    fix: "검색어를 앞쪽에 두고 권장 길이에 맞춰요. 너무 길면 검색 결과에서 잘려요.",
  },
  "description-length": {
    message: `설명이 권장 길이(${SEO_DESCRIPTION_LENGTH.min}~${SEO_DESCRIPTION_LENGTH.max}자)를 벗어나요.`,
    fix: "검색 결과에 보일 한두 문장으로, 이 글에서 무엇을 얻는지 적어요.",
  },
  "first-paragraph-length": {
    message: `첫 문단이 ${SEO_FIRST_PARAGRAPH_MAX}자를 넘어요.`,
    fix: "첫 문단은 질문에 바로 답하는 두세 문장으로 줄이고, 자세한 설명은 뒤로 보내요.",
  },
  "keyword-in-title": {
    message: "핵심 검색어가 제목에 없어요.",
    fix: "핵심 검색어를 제목 앞쪽에 자연스럽게 넣어요.",
  },
  "keyword-in-first-paragraph": {
    message: "핵심 검색어가 첫 문단에 없어요.",
    fix: "첫 문단에서 핵심 검색어를 한 번 써요.",
  },
  "keyword-missing": {
    message: "핵심 검색어가 정해지지 않았어요.",
    fix: "독자가 검색창에 칠 말을 하나 정해 핵심 검색어 칸에 적어요.",
  },
  "internal-link-missing": {
    message: "다른 글로 가는 링크가 없어요.",
    fix: "관련 있는 내 글 한두 편을 본문에 링크로 이어요.",
  },
  "question-heading": {
    message: "질문형 소제목이 없어요.",
    fix: "독자가 궁금해할 질문을 소제목으로 쓰고 바로 아래 문단에서 답해요.",
  },
  "body-short": {
    message: `본문이 ${SEO_BODY_MIN_CHARS}자보다 짧아요.`,
    fix: "독자가 궁금해할 것(방법 · 이유 · 예시)을 더 채워요.",
  },
} as const satisfies Record<SeoRule, { message: string; fix: string }>;
