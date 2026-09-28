import type { SeoLevel } from "@blog-editor/content-schema";
import type { MetaField } from "./types";

/** 머리줄 검색 노출 칩 글자 — 칩 이름 문장들이 이것으로 시작한다 */
const SEO_CHIP = "검색 노출";

/** 편집 화면의 사용자 문장 — 디자인 68:2 · 67:2와 디자인 결정(FBoYaNUUHcxHPzpWUibKBR)의 문장을 한 곳에 둔다 */
export const EDITOR_MESSAGES = {
  bodyLabel: "본문",
  titleLabel: "제목",
  titlePlaceholder: "제목을 적어 주세요",
  loading: "글을 불러오는 중이에요.",
  aiDraftNote: "AI가 올린 초안이에요. 발행 전에 끝까지 읽어 보세요.",
  status: {
    saving: "저장 중…",
    savedDraft: "초안 저장됨",
    savedPublished: "발행 글에 반영됨",
    published: "빌드 중 — 1~2분 뒤 공개",
    failed: "저장하지 못했어요",
    retry: "다시 시도",
    incomplete: "채우면 저장돼요",
  },
  fieldNames: {
    title: "제목",
    description: "설명",
    category: "카테고리",
    slug: "주소",
  } satisfies Record<MetaField, string>,
  info: {
    heading: "글 정보",
    draft: "초안",
    published: "발행됨",
    slug: "주소",
    slugHint: "발행하면 주소는 바꿀 수 없어요.",
    slugLocked: "발행한 글이라 주소가 잠겨 있어요.",
    slugTaken: "이 주소를 쓰는 글이 이미 있어요. 다른 주소를 적어 주세요.",
    category: "카테고리",
    categoryHint: "워크스페이스에 정해 둔 카테고리 중 하나예요.",
    description: "설명",
    descriptionHint: "검색 결과와 글 목록에 보이는 두세 줄이에요.",
    keyword: "핵심 검색어",
    keywordHint: "독자가 검색창에 칠 말 하나예요. 발행 전 점검에만 쓰고 사이트에는 보이지 않아요.",
    date: "날짜",
    openDecorate: "꾸미기 열기",
    refineWithAi: "이 글을 AI와 다듬기",
    refineWithAiLater: "AI 연결 화면에서 이어져요.",
  },
  expired: {
    text: "로그인이 끝났어요. 쓰던 글은 이 브라우저에 남아 있어요.",
    action: "다시 로그인",
  },
  /** 열린 편집 화면에서 다른 곳(AI)의 고침을 알아챘다(openspec editor-live-reflect) */
  liveReflect: {
    text: "AI가 고쳤어요. 불러오면 지금 고친 내용은 사라져요.",
    action: "불러오기",
  },
  conflict: {
    title: "저장하지 못했어요. 이 글이 다른 곳에서 먼저 바뀌었어요.",
    body: "지금 저장하면 그 내용이 사라지기 때문에 멈췄습니다. 쓰던 내용은 이 브라우저에 그대로 남아 있어요.",
    copyAndOpenLatest: "내 글을 복사해 두고 최신 글 열기",
    keepWriting: "저장하지 않고 계속 쓰기",
    overwrite: "최신 글을 버리고 내 글로 덮어쓰기",
  },
  publish: {
    title: "이 글을 발행할까요?",
    body: "발행하면 주소는 바꿀 수 없어요.",
    updateTitle: "고친 내용을 공개 글에 반영할까요?",
    updateBody: "저장하면 1~2분 뒤 사이트에 보여요.",
    confirm: "발행",
    confirmUpdate: "반영",
    cancel: "취소",
    incomplete: "발행하려면 먼저 채워 주세요:",
  },
  /** 발행 확인의 검색 노출 점검(adr-030) — 알리기만 하고 발행은 막지 않는다 */
  seo: {
    heading: "검색 노출 점검",
    score: (value: number) => `검색 노출 점수 ${value}점`,
    mustNotice: "꼭 고칠 것이 있어요. 그래도 발행할 수는 있어요.",
    empty: "점검할 것이 없어요.",
    unavailable: "본문을 읽지 못해 점검할 수 없어요.",
    othersLoading: "다른 글과 겹치는지 확인하는 중이에요.",
    othersFailed: "다른 글 목록을 읽지 못해 제목 · 설명 중복을 점검할 수 없어요.",
    retry: "다시 시도",
    levels: { must: "꼭 고치기", should: "권장", info: "참고" } satisfies Record<SeoLevel, string>,
    /** 머리줄 칩 · 팝오버 · 본문 여백 점(#151 디자인 C) — 점검 제목(heading)이 팝오버 이름이다 */
    chip: SEO_CHIP,
    chipName: (score: number, mustCount: number) =>
      mustCount > 0 ? `${SEO_CHIP} ${score}점, 꼭 고치기 ${mustCount}개` : `${SEO_CHIP} ${score}점`,
    /** 점수 대신 까닭(확인 중 · 점검 못 함)을 보일 때의 칩 이름 */
    chipStatusName: (status: string) => `${SEO_CHIP} ${status}`,
    chipLoading: "확인 중",
    chipUnavailable: "점검 못 함",
    notBlocking: "발행은 막지 않아요.",
    /** 본문 블록 흐름이 바뀌어 다시 매기는 동안 팝오버 블록 항목에 붙는 안내 */
    blockPending: "본문이 바뀌어 다시 점검하는 중이에요.",
    dotName: (levelLabel: string, message: string) => `${levelLabel}: ${message}`,
    goTo: (place: string) => `→ ${place}`,
    places: {
      title: "제목",
      description: "설명",
      keyword: "핵심 검색어",
      body: "본문 전체",
      block: (block: number) => `블록 ${block}`,
    },
  },
  preview: {
    title: "미리보기",
    close: "닫기",
    loading: "그리는 중이에요.",
    failed: "미리보기를 그리지 못했어요.",
  },
  loadFailed: "글을 불러오지 못했어요.",
  notFound: "없는 글이에요.",
  backToList: "글 목록으로",
} as const;
