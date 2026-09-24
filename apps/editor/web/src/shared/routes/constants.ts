/** 화면 경로 — 라우터와 링크가 같은 값을 쓴다. */
export const ROUTES = {
  home: "/",
  login: "/login",
  newPost: "/posts/new",
  editPost: "/posts/:slug/edit",
  connect: "/connect",
  settings: "/settings",
} as const;

/** 로그인 뒤 돌아갈 경로를 싣는 쿼리 이름 */
export const NEXT_PARAM = "next";
