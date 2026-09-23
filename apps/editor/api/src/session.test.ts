import { createApp } from "./app";
import { createMemoryPostStore } from "./memory-store";
import { TEST_ACCOUNT, cookieOf, loginRequest, testAuthOptions } from "./test-app";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const SESSION_TTL_SECONDS = 60 * 60;
const T0 = Date.UTC(2026, 8, 23);

function setup() {
  let now = T0;
  const app = createApp({
    store: createMemoryPostStore(),
    categories: CATEGORIES,
    imageBaseUrl: "https://simsimeestudio.com",
    ...testAuthOptions,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
    now: () => now,
  });
  const advance = (ms: number) => {
    now += ms;
  };
  return { app, advance };
}

function listPosts(app: ReturnType<typeof setup>["app"], cookie?: string) {
  return app.request("/api/posts", cookie === undefined ? {} : { headers: { Cookie: cookie } });
}

describe("api-session — 로그인", () => {
  it("WHEN 시드 계정으로 로그인하면 THEN 204이고 쿠키가 HttpOnly · Secure · SameSite=Strict · Path=/ · Max-Age를 갖는다", async () => {
    const { app } = setup();

    const res = await loginRequest(app, TEST_ACCOUNT.email, TEST_ACCOUNT.password);

    expect(res.status).toBe(204);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^__Host-session=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(new RegExp(`Max-Age=${SESSION_TTL_SECONDS}`));
  });

  it("WHEN 틀린 비밀번호로 로그인하면 THEN 401이고 쿠키가 없다", async () => {
    const { app } = setup();

    const res = await loginRequest(app, TEST_ACCOUNT.email, "wrong-password");

    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("WHEN 없는 계정과 틀린 비밀번호로 로그인하면 THEN 두 응답의 상태와 본문이 같다", async () => {
    const { app } = setup();

    const unknown = await loginRequest(app, "nobody@example.com", TEST_ACCOUNT.password);
    const wrong = await loginRequest(app, TEST_ACCOUNT.email, "wrong-password");

    expect(unknown.status).toBe(wrong.status);
    expect(await unknown.text()).toBe(await wrong.text());
  });
});

describe("api-session — /api/*는 세션 필수 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN 쿠키 없이 글 목록을 부르면 THEN 401이고 message가 있다", async () => {
    const { app } = setup();

    const res = await listPosts(app);

    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty("message");
  });

  it("WHEN 쿠키의 서명 부분을 바꿔 부르면 THEN 401이다", async () => {
    const { app } = setup();
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.email, TEST_ACCOUNT.password));
    const [name, encoded] = cookie.split("=", 2) as [string, string];
    const value = decodeURIComponent(encoded);
    const dot = value.lastIndexOf(".");
    const signature = value.slice(dot + 1);
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    const forged = `${name}=${encodeURIComponent(`${value.slice(0, dot)}.${flipped}`)}`;

    expect((await listPosts(app, cookie)).status).toBe(200);
    expect((await listPosts(app, forged)).status).toBe(401);
  });

  it("WHEN 세션 수명보다 시계가 더 흐른 뒤 그 쿠키로 부르면 THEN 401이다", async () => {
    const { app, advance } = setup();
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.email, TEST_ACCOUNT.password));

    advance(SESSION_TTL_SECONDS * 1000 + 1);

    expect((await listPosts(app, cookie)).status).toBe(401);
  });

  it("WHEN 세션 쿠키 없이 공개 조회를 부르면 THEN 200이다", async () => {
    const { app } = setup();

    expect((await app.request("/public/posts")).status).toBe(200);
  });
});

describe("api-session — 로그아웃", () => {
  it("WHEN 로그인 → 로그아웃 → 응답 쿠키를 적용해 목록을 부르면 THEN 로그아웃 204 · Max-Age=0이고 목록은 401이다", async () => {
    const { app } = setup();
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.email, TEST_ACCOUNT.password));

    const logout = await app.request("/api/session", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });

    expect(logout.status).toBe(204);
    expect(logout.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
    expect(logout.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);
    // Max-Age=0을 적용한 브라우저는 쿠키를 버린다 — 남는 것은 지워진 값뿐이다
    expect((await listPosts(app, cookieOf(logout))).status).toBe(401);
  });

  it("WHEN 쿠키 없이 로그아웃하면 THEN 204이고 Set-Cookie에 Max-Age=0이 있다", async () => {
    const { app } = setup();

    const logout = await app.request("/api/session", { method: "DELETE" });

    expect(logout.status).toBe(204);
    expect(logout.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);
  });
});
