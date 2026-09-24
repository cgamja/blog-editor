/**
 * 인가 코드가 갈 수 있는 곳(mcp-oauth design 2). 등록은 누구나 할 수 있어도 코드는 이 목록으로만 간다.
 * - claude.ai · Desktop · 모바일: 고정 콜백
 * - Claude Code: 루프백 `/callback`, 포트는 세션마다 바뀐다(RFC 8252 7.3 — 포트를 비교하지 않는다)
 */
export const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);
const LOOPBACK_PATH = "/callback";

/** 초안 출처 `token:<이름>`의 이름 — postSourceSchema의 `[a-z0-9-]{1,32}` 안에 든다 */
const CLAUDE_SOURCE_NAME = "oauth-claude-ai";
const LOOPBACK_SOURCE_NAME = "oauth-loopback";

function parse(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

/**
 * 표준 모양만 받는다 — URL 파서가 `127.1` · `0x7f000001` · 전각 숫자를 `127.0.0.1`로 고쳐 읽으므로
 * `href`가 입력과 글자 그대로 같을 때만 루프백이다(허용 목록을 우회하는 표기를 막는다).
 */
export function isLoopbackRedirect(uri: string): boolean {
  const url = parse(uri);
  return (
    url !== null &&
    url.href === uri &&
    url.protocol === "http:" &&
    LOOPBACK_HOSTS.has(url.hostname) &&
    url.pathname === LOOPBACK_PATH &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === ""
  );
}

export function isAllowedRedirectUri(uri: string): boolean {
  return uri === CLAUDE_CALLBACK || isLoopbackRedirect(uri);
}

/** 요청한 redirect_uri가 등록된 것과 같은가 — 루프백만 포트를 무시한다 */
export function matchesRegisteredRedirect(
  requested: string,
  registered: readonly string[],
): boolean {
  if (registered.includes(requested)) return true;
  if (!isLoopbackRedirect(requested)) return false;
  const host = new URL(requested).hostname;
  return registered.some((uri) => isLoopbackRedirect(uri) && new URL(uri).hostname === host);
}

export function sourceNameOf(redirectUri: string): string {
  return redirectUri === CLAUDE_CALLBACK ? CLAUDE_SOURCE_NAME : LOOPBACK_SOURCE_NAME;
}
