/** 로그인 · 로그아웃 화면의 문장 */
export const AUTH_MESSAGES = {
  session: {
    checking: "로그인 상태를 확인하는 중이에요.",
  },
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
  logout: {
    submit: "로그아웃",
    submitting: "로그아웃하는 중…",
    // 쿠키가 아직 유효하다 — 로그아웃된 줄 알고 자리를 뜨지 않게 분명히 말한다
    failed: "로그아웃하지 못했어요",
    retry: "다시 시도",
  },
} as const;
