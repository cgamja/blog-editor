import type { PostTab } from "./types";

/** 글 목록 화면의 문장 */
export const POSTS_MESSAGES = {
  title: "글",
  loading: "글 목록을 불러오는 중이에요.",
  actions: {
    writeWithAi: "AI로 쓰기",
    import: "가져오기",
    newPost: "새 글",
  },
  tabsLabel: "상태로 거르기",
  tabs: { all: "전체", draft: "초안", published: "발행됨" } satisfies Record<PostTab, string>,
  columns: { title: "제목", category: "카테고리", status: "상태", lastEdited: "고친 날" },
  status: { draft: "초안", published: "발행됨" },
  aiDraft: "AI가 올린 초안",
  emptyTab: { all: "", draft: "초안이 없어요.", published: "발행한 글이 없어요." } satisfies Record<
    PostTab,
    string
  >,
  empty: {
    note: "아직 글이 없어요",
    body: "새로 쓰거나, 쓰던 마크다운을 가져오거나, Claude · ChatGPT에서 초안을 올릴 수 있어요.",
  },
  footer:
    "초안은 블로그에 보이지 않아요. 발행을 누른 글만 나갑니다. Claude나 ChatGPT에서 쓴 글은 AI 연결을 해 두면 여기 초안으로 올라와요.",
  dialogNotReady: "아직 준비 중이에요",
} as const;
