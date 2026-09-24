/** 화면에 보이는 문장 — 한 곳에 모은다. 각 화면 이슈가 채우기 전의 자리 표시 문장도 여기 둔다. */
export const MESSAGES = {
  appTitle: "블로그 에디터",
  checkingSession: "로그인 상태를 확인하는 중이에요.",
  login: {
    title: "로그인",
    username: "아이디",
    password: "비밀번호",
    submit: "로그인",
    submitting: "로그인하는 중…",
    failed: "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  },
  pages: {
    posts: "글 목록",
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
