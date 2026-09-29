/**
 * 에디터 주소의 중계(editor-relay · ADR-047) — API 경로를 Supabase 함수 주소로 넘기고 받은 응답을 그대로 돌려준다.
 * 화면 경로는 null을 돌려 정적 자산 몫으로 남긴다. Cloudflare 타입 패키지 없이 표준 Request/Response만 쓴다.
 */
import { RELAY_SECRET_HEADER } from "./constants";
import { API_UNREACHABLE_MESSAGE, RATE_LIMITED_MESSAGE } from "./messages";
import type { RelayEnv } from "./types";

const RELAY_PREFIXES = ["/api/", "/public/", "/images/", "/.well-known/"];
const RELAY_EXACT = new Set(["/mcp", "/authorize", "/register", "/token"]);
/** 비밀번호를 받는 경로 — IP마다 세어 무차별 대입을 함수 앞에서 자른다 */
const LOGIN_PATHS = new Set(["/api/session", "/authorize"]);
const RETRY_AFTER_SECONDS = "60";
const HTML = "text/html; charset=utf-8";

/**
 * 함수(Hono)는 퍼센트 인코딩을 풀어 라우팅한다 — `/api/%73ession`이 로그인 경로로 가므로 판정도 푼 경로로 한다.
 * 풀 수 없는 경로는 그대로 둔다(함수도 풀지 못해 같은 경로로 본다)
 */
function decodedPath(pathname: string): string {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

function isRelayPath(pathname: string): boolean {
  return RELAY_EXACT.has(pathname) || RELAY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isLogin(request: Request, pathname: string): boolean {
  return request.method === "POST" && LOGIN_PATHS.has(pathname);
}

function tooManyRequests(): Response {
  return new Response(JSON.stringify({ message: RATE_LIMITED_MESSAGE }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": RETRY_AFTER_SECONDS },
  });
}

/** 함수에 닿지 못했다(네트워크 오류) — 화면이 읽는 `{ message }` 모양으로 돌려준다 */
function badGateway(): Response {
  return new Response(JSON.stringify({ message: API_UNREACHABLE_MESSAGE }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}

function forwardRequest(request: Request, url: URL, env: RelayEnv): Request {
  const headers = new Headers(request.headers);
  // Host는 fetch가 대상 주소로 채운다 — 에디터 주소를 남기면 함수 쪽 라우팅이 어긋난다
  headers.delete("Host");
  headers.set(RELAY_SECRET_HEADER, env.RELAY_SECRET);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
    // 302(OAuth 콜백)는 브라우저가 따라가야 한다 — 중계가 따라가면 Location이 사라진다
    redirect: "manual",
  };
  // 스트림 본문은 Node(undici)에서 duplex가 있어야 한다 — Workers는 무시한다
  if (hasBody) init.duplex = "half";
  return new Request(`${env.API_ORIGIN}${url.pathname}${url.search}`, init);
}

/** 무료 Supabase는 GET의 HTML을 text/plain으로 바꾼다 — OAuth 로그인 화면만 되돌린다 */
function withHtmlLoginPage(request: Request, pathname: string, response: Response): Response {
  const isLoginPage = request.method === "GET" && pathname === "/authorize";
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!isLoginPage || !contentType.startsWith("text/plain")) return response;
  const headers = new Headers(response.headers);
  headers.set("Content-Type", HTML);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** API 경로면 함수의 응답, 화면 경로면 null */
export async function relay(
  request: Request,
  env: RelayEnv,
  fetchApi: typeof fetch = fetch,
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = decodedPath(url.pathname);
  if (!isRelayPath(pathname)) return null;
  if (isLogin(request, pathname)) {
    const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.LOGIN_RATE_LIMIT.limit({ key });
    if (!success) return tooManyRequests();
  }
  let response: Response;
  try {
    response = await fetchApi(forwardRequest(request, url, env));
  } catch {
    return badGateway();
  }
  return withHtmlLoginPage(request, pathname, response);
}
