/** 화면에 보이는 문장 — 앱 공통과 로그인. 기능 화면의 문장은 각 기능의 messages.ts에 둔다. */
export const MESSAGES = {
  appTitle: "블로그 에디터",
  brand: "육아비서",
  checkingSession: "로그인 상태를 확인하는 중이에요.",
  login: {
    title: "로그인",
    username: "아이디",
    password: "비밀번호",
    submit: "로그인",
    submitting: "로그인하는 중…",
    failed: "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
    // 서버는 잠김 여부를 응답으로 드러내지 않는다(api-session) — 남은 횟수 대신 고정 안내
    lockNotice: "여러 번 틀리면 잠시 로그인이 잠겨요.",
  },
  nav: {
    label: "주 메뉴",
    posts: "글",
    connect: "AI 연결",
    settings: "설정",
    logout: "로그아웃",
    loggingOut: "로그아웃하는 중…",
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
