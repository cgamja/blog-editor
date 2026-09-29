import { LOGIN_RATE_LIMIT_PER_MINUTE, RELAY_SECRET_HEADER } from "./constants";
import { relay } from "./relay";
import type { RateLimiter, RelayEnv } from "./types";

const EDITOR = "https://editor.example.test";
const API_ORIGIN = "https://ref.supabase.co/functions/v1/editor";
const WORKER_SECRET = "worker-relay-secret";

/** Cloudflare 요청량 제한의 가짜 — 키마다 센다(분 경계는 보지 않는다: 테스트는 1분 안에 끝난다) */
function fakeRateLimiter(): RateLimiter {
  const counts = new Map<string, number>();
  return {
    limit: async ({ key }) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { success: count <= LOGIN_RATE_LIMIT_PER_MINUTE };
    },
  };
}

function relayEnv(): RelayEnv {
  return { API_ORIGIN, RELAY_SECRET: WORKER_SECRET, LOGIN_RATE_LIMIT: fakeRateLimiter() };
}

/** 함수(네트워크 경계)의 가짜 — 받은 요청을 남기고 정해 둔 응답을 준다 */
function fakeApi(respond: () => Response) {
  const received: Request[] = [];
  const fetchApi = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    received.push(
      input instanceof Request && init === undefined ? input : new Request(input, init),
    );
    return respond();
  });
  return { fetchApi: fetchApi as unknown as typeof fetch, calls: fetchApi, received };
}

function loginRequest(path: string): Request {
  return new Request(`${EDITOR}${path}`, {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.7", "content-type": "application/json" },
    body: "{}",
  });
}

describe("editor-relay — 에디터 주소 하나가 화면과 API를 같이 낸다", () => {
  it("WHEN PUT /api/posts/a?x=1을 본문 · If-Match와 함께 보내면 THEN 함수 주소로 같은 방법 · 본문 · If-Match가 가고 상태 · Set-Cookie · 본문이 그대로 돌아온다", async () => {
    const api = fakeApi(
      () =>
        new Response('{"saved":true}', {
          status: 201,
          headers: { "Set-Cookie": "__Host-session=abc; Path=/; Secure; HttpOnly" },
        }),
    );
    const request = new Request(`${EDITOR}/api/posts/a?x=1`, {
      method: "PUT",
      headers: { "If-Match": '"rev-1"', "content-type": "application/json" },
      body: '{"title":"a"}',
    });

    const response = await relay(request, relayEnv(), api.fetchApi);

    const sent = api.received[0];
    expect(sent?.url).toBe(`${API_ORIGIN}/api/posts/a?x=1`);
    expect(sent?.method).toBe("PUT");
    expect(sent?.headers.get("If-Match")).toBe('"rev-1"');
    expect(await sent?.text()).toBe('{"title":"a"}');
    expect(response?.status).toBe(201);
    expect(response?.headers.get("Set-Cookie")).toBe(
      "__Host-session=abc; Path=/; Secure; HttpOnly",
    );
    expect(await response?.text()).toBe('{"saved":true}');
  });

  it("WHEN 함수가 302와 Location을 주면 THEN 중계도 따라가지 않고 302와 같은 Location이다", async () => {
    const location = "https://claude.ai/api/mcp/auth_callback?code=c1&state=s1";
    const api = fakeApi(() => new Response(null, { status: 302, headers: { Location: location } }));

    const response = await relay(
      new Request(`${EDITOR}/authorize?client_id=c`, { method: "POST", body: "u=admin" }),
      relayEnv(),
      api.fetchApi,
    );

    expect(api.received[0]?.redirect).toBe("manual");
    expect(response?.status).toBe(302);
    expect(response?.headers.get("Location")).toBe(location);
  });

  it("WHEN 화면 경로 GET /posts/abc를 받으면 THEN 함수를 부르지 않고 null(정적 자산 몫)이다", async () => {
    const api = fakeApi(() => new Response("unexpected"));

    const response = await relay(new Request(`${EDITOR}/posts/abc`), relayEnv(), api.fetchApi);

    expect(response).toBeNull();
    expect(api.calls).not.toHaveBeenCalled();
  });
});

describe("editor-relay — 함수에 닿지 못하면", () => {
  it("WHEN 함수 호출이 네트워크 오류로 거부되면 THEN 502와 message 문자열이 든 JSON이다", async () => {
    const api = fakeApi(() => {
      throw new TypeError("fetch failed");
    });

    const response = await relay(new Request(`${EDITOR}/api/posts`), relayEnv(), api.fetchApi);

    expect(response?.status).toBe(502);
    expect(response?.headers.get("Content-Type")).toContain("application/json");
    expect(await response?.json()).toEqual({ message: expect.any(String) });
  });
});

describe("editor-relay — OAuth 로그인 화면은 HTML로 돌려준다", () => {
  it("WHEN 함수가 GET /authorize에 text/plain으로 답하면 THEN 중계 응답은 text/html; charset=utf-8이다", async () => {
    const api = fakeApi(
      () => new Response("<form></form>", { headers: { "Content-Type": "text/plain" } }),
    );

    const response = await relay(
      new Request(`${EDITOR}/authorize?client_id=c`),
      relayEnv(),
      api.fetchApi,
    );

    expect(response?.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });

  it("WHEN 함수가 GET /public/posts에 text/plain으로 답하면 THEN 중계 응답도 text/plain이다", async () => {
    const api = fakeApi(
      () => new Response('{"posts":[]}', { headers: { "Content-Type": "text/plain" } }),
    );

    const response = await relay(new Request(`${EDITOR}/public/posts`), relayEnv(), api.fetchApi);

    expect(response?.headers.get("Content-Type")).toBe("text/plain");
  });
});

describe("editor-relay — 함수는 중계를 거친 요청만 받는다 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN 브라우저가 X-Relay-Secret: guess를 붙여 중계에 요청하면 THEN 함수에는 Worker 시크릿 값이 간다", async () => {
    const api = fakeApi(() => new Response("ok"));

    await relay(
      new Request(`${EDITOR}/public/posts`, { headers: { [RELAY_SECRET_HEADER]: "guess" } }),
      relayEnv(),
      api.fetchApi,
    );

    expect(api.received[0]?.headers.get(RELAY_SECRET_HEADER)).toBe(WORKER_SECRET);
  });
});

describe("editor-relay — 로그인 경로는 IP당 요청량을 자른다 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN 한 IP가 1분 안에 POST /api/session을 11번 보내면 THEN 11번째는 429 · Retry-After 60이고 함수 호출은 10번이다", async () => {
    const env = relayEnv();
    const api = fakeApi(() => new Response(null, { status: 401 }));

    let last: Response | null = null;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      last = await relay(loginRequest("/api/session"), env, api.fetchApi);
    }

    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).toBe("60");
    expect(api.calls).toHaveBeenCalledTimes(10);
  });

  // 다른 실패: /api/session만 세고 OAuth 로그인 폼(POST /authorize)은 무제한으로 넘기는 구현을 잡는다
  it("WHEN 한 IP가 1분 안에 POST /authorize를 11번 보내면 THEN 11번째는 429이고 함수 호출은 10번이다", async () => {
    const env = relayEnv();
    const api = fakeApi(() => new Response(null, { status: 401 }));

    let last: Response | null = null;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      last = await relay(loginRequest("/authorize"), env, api.fetchApi);
    }

    expect(last?.status).toBe(429);
    expect(api.calls).toHaveBeenCalledTimes(10);
  });

  // 다른 실패: 함수(Hono)는 인코딩을 풀어 /api/session으로 라우팅한다 — 글자 그대로 비교하면 제한을 건너뛴다
  it("WHEN 한 IP가 POST /api/%73ession을 11번 보내면 THEN 11번째는 429이고 함수 호출은 10번이다", async () => {
    const env = relayEnv();
    const api = fakeApi(() => new Response(null, { status: 401 }));

    let last: Response | null = null;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      last = await relay(loginRequest("/api/%73ession"), env, api.fetchApi);
    }

    expect(last?.status).toBe(429);
    expect(api.calls).toHaveBeenCalledTimes(10);
  });
});
