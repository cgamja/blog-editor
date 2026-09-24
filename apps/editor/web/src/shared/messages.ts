/** 화면에 보이는 문장 — 앱 공통만. 기능 화면의 문장은 각 기능의 messages.ts에 둔다. */
export const MESSAGES = {
  appTitle: "블로그 에디터",
  brand: "육아비서",
  nav: {
    label: "주 메뉴",
    posts: "글",
    connect: "AI 연결",
    settings: "설정",
  },
  pages: {
    newPost: "새 글",
    editPost: "글 편집",
    connect: "AI 연결",
    settings: "설정",
  },
  placeholder: "이 화면은 M3 이슈에서 채워요.",
  notFound: {
    title: "없는 화면이에요",
    home: "글 목록으로",
  },
  error: {
    title: "화면을 그리지 못했어요",
    retry: "다시 시도",
  },
} as const;
