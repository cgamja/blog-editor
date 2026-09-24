/** 화면 경로 — 라우터와 링크가 같은 값을 쓴다. */
export const ROUTES = {
  home: "/",
  login: "/login",
  newPost: "/posts/new",
  editPost: "/posts/:slug/edit",
  connect: "/connect",
  settings: "/settings",
} as const;

export const NEXT_PARAM = "next";

const HOME = ROUTES.home;
// 제어 문자(U+0000–U+001F, U+007F) — 줄바꿈 등이 든 주소는 헤더 · 로그를 흐린다
const LAST_C0_CONTROL = 0x1f;
const DELETE = 0x7f;

/**
 * 로그인 뒤 돌아갈 경로(design.md 2). 주소창에서 누구나 바꿀 수 있는 값이라 이 앱 안의 경로만 받는다 —
 * `//host` · `/\host`는 브라우저가 다른 출처로 해석한다(프로토콜 상대 주소).
 */
export function safeNextPath(raw: string | null): string {
  if (raw === null || !raw.startsWith("/")) return HOME;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return HOME;
  if (hasControlCharacter(raw)) return HOME;
  if (isLoginPath(raw)) return HOME;
  return raw;
}

/** 로그인이 필요한 화면에서 로그인 화면으로 — 지금 경로를 `next`로 기억한다. 첫 화면이면 붙이지 않는다. */
export function loginPathFor(current: string): string {
  if (current === HOME) return ROUTES.login;
  return `${ROUTES.login}?${NEXT_PARAM}=${encodeURIComponent(current)}`;
}

function hasControlCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (code <= LAST_C0_CONTROL || code === DELETE) return true;
  }
  return false;
}

function isLoginPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname === ROUTES.login || pathname === `${ROUTES.login}/`;
}
