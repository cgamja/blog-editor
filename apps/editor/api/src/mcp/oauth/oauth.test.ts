import { createHash } from "node:crypto";
import { createApp } from "../../app";
import { createMemoryPostStore } from "../../memory-store";
import { TEST_ACCOUNT, cookieOf, loginRequest, testAuthOptions } from "../../test-app";
import { hashConnectionToken } from "../connection-tokens";
import { createMemoryConnectionTokenStore } from "../memory-connection-token-store";
import { createMemoryOAuthStore } from "./memory-oauth-store";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const ISSUER = "https://editor.example.test";
const MCP_URL = `${ISSUER}/mcp`;
const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const PROTOCOL_VERSION = "2025-06-18";
const VERIFIER = "test-code-verifier-0123456789abcdefghijklmnopqrstuvwxyz";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const GRACE_MS = 10 * 60 * 1000;
const START = Date.parse("2026-09-24T00:00:00Z");

function setup(oauthStoreOptions: { maxClients?: number } = {}) {
  const clock = { now: START };
  const store = createMemoryPostStore();
  const app = createApp({
    store,
    categories: CATEGORIES,
    imageBaseUrl: "https://simsimeestudio.com",
    ...testAuthOptions,
    now: () => clock.now,
    mcp: {
      connectionTokens: createMemoryConnectionTokenStore([
        {
          name: "claude-code",
          tokenHash: hashConnectionToken("unused-connection-token-0123456789"),
        },
      ]),
      editorBaseUrl: ISSUER,
      formatGuide: "형식 가이드",
      oauth: { issuer: ISSUER, store: createMemoryOAuthStore(oauthStoreOptions) },
    },
  });
  return { app, store, clock };
}

type App = ReturnType<typeof setup>["app"];

async function register(app: App, redirectUris: string[] = [CLAUDE_CALLBACK]) {
  return app.request("/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Claude", redirect_uris: redirectUris }),
  });
}

async function registeredClientId(app: App): Promise<string> {
  const body = (await (await register(app)).json()) as { client_id: string };
  return body.client_id;
}

function authorizeParams(clientId: string, overrides: Record<string, string | null> = {}) {
  const params: Record<string, string | null> = {
    client_id: clientId,
    redirect_uri: CLAUDE_CALLBACK,
    response_type: "code",
    state: "state-xyz",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    resource: MCP_URL,
    scope: "drafts",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== null),
  );
}

function postAuthorize(
  app: App,
  form: Record<string, string>,
  headers: Record<string, string> = {},
) {
  return app.request("/authorize", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(form).toString(),
  });
}

function withLogin(form: Record<string, string>, decision = "allow") {
  return { ...form, username: TEST_ACCOUNT.username, password: TEST_ACCOUNT.password, decision };
}

function redirectOf(res: Response): URL {
  const location = res.headers.get("Location");
  if (location === null) throw new Error(`Location이 없다 — ${res.status}`);
  return new URL(location);
}

function postToken(app: App, form: Record<string, string>) {
  return app.request("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
}

async function codeFor(app: App, clientId: string): Promise<string> {
  const res = await postAuthorize(app, withLogin(authorizeParams(clientId)));
  const code = redirectOf(res).searchParams.get("code");
  if (code === null) throw new Error("code가 없다");
  return code;
}

function exchange(app: App, clientId: string, code: string, verifier = VERIFIER) {
  return postToken(app, {
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: CLAUDE_CALLBACK,
    code_verifier: verifier,
    resource: MCP_URL,
  });
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

async function tokensFor(app: App, clientId: string): Promise<TokenResponse> {
  const res = await exchange(app, clientId, await codeFor(app, clientId));
  return (await res.json()) as TokenResponse;
}

async function accessTokenFor(app: App): Promise<TokenResponse> {
  return tokensFor(app, await registeredClientId(app));
}

function rpc(app: App, method: string, params: unknown, token: string | null) {
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": PROTOCOL_VERSION,
  });
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return app.request("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

async function resultOf(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const payload = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice("data: ".length);
  const message = JSON.parse(payload) as { result?: Record<string, unknown> };
  if (message.result === undefined) throw new Error(`JSON-RPC 결과가 없다: ${text}`);
  return message.result;
}

describe("mcp-auth — OAuth 토큰 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN OAuth를 켠 앱에 토큰 없이 /mcp를 부르면 THEN 401이고 WWW-Authenticate가 메타데이터 위치를 알린다", async () => {
    const { app } = setup();

    const res = await rpc(app, "tools/list", {}, null);

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain(
      `resource_metadata="${ISSUER}/.well-known/oauth-protected-resource/mcp"`,
    );
  });

  it("WHEN claude.ai 콜백으로 받은 OAuth 토큰으로 tools/list · create_draft를 부르면 THEN 발행 도구가 없고 초안 · token:oauth-claude-ai로 저장된다", async () => {
    const { app, store } = setup();
    const { access_token: token } = await accessTokenFor(app);

    const tools = await resultOf(await rpc(app, "tools/list", {}, token));
    const created = await resultOf(
      await rpc(
        app,
        "tools/call",
        {
          name: "create_draft",
          arguments: {
            slug: "oauth-draft",
            title: "OAuth로 쓴 초안",
            description: "claude.ai에서 올린 초안",
            category: "studio",
            markdown: "claude.ai 커넥터로 쓴 문단입니다.",
          },
        },
        token,
      ),
    );

    expect((tools.tools as Array<{ name: string }>).map((tool) => tool.name)).not.toContain(
      "publish_post",
    );
    expect(created.isError).not.toBe(true);
    const saved = await store.get("oauth-draft");
    expect(saved?.file.meta.draft).toBe(true);
    expect(saved?.file.meta.source).toBe("token:oauth-claude-ai");
  });

  it("WHEN 액세스 토큰 수명이 지난 뒤 /mcp를 부르면 THEN 401이다", async () => {
    const { app, clock } = setup();
    const { access_token: token } = await accessTokenFor(app);

    clock.now += ACCESS_TOKEN_TTL_MS + 1000;
    const res = await rpc(app, "tools/list", {}, token);

    expect(res.status).toBe(401);
  });

  it("WHEN refresh로 회전한 뒤 옛 액세스 토큰으로 /mcp를 부르면 THEN 401이다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    const tokens = await tokensFor(app, clientId);

    await postToken(app, {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
    });
    const res = await rpc(app, "tools/list", {}, tokens.access_token);

    expect(res.status).toBe(401);
  });
});

describe("mcp-oauth-server — 메타데이터 · 등록", () => {
  it("WHEN 두 well-known 문서를 부르면 THEN 보호 자원이 인가 서버를 가리키고 인가 서버는 S256 · none을 광고한다", async () => {
    const { app } = setup();

    const resource = (await (
      await app.request("/.well-known/oauth-protected-resource/mcp")
    ).json()) as { resource: string; authorization_servers: string[] };
    const server = (await (
      await app.request("/.well-known/oauth-authorization-server")
    ).json()) as {
      issuer: string;
      code_challenge_methods_supported: string[];
      token_endpoint_auth_methods_supported: string[];
    };

    expect(resource.resource).toBe(MCP_URL);
    expect(resource.authorization_servers[0]).toBe(server.issuer);
    expect(server.code_challenge_methods_supported).toContain("S256");
    expect(server.token_endpoint_auth_methods_supported).toContain("none");
  });
});

describe("mcp-oauth-server — 등록 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN claude.ai 콜백으로 /register를 부르면 THEN 201이고 공개 클라이언트 client_id가 나온다", async () => {
    const { app } = setup();

    const res = await register(app);
    const body = (await res.json()) as { client_id?: string; token_endpoint_auth_method?: string };

    expect(res.status).toBe(201);
    expect(body.client_id).toBeTruthy();
    expect(body.token_endpoint_auth_method).toBe("none");
  });

  it("WHEN 목록 밖 redirect_uri로 /register를 부르면 THEN 400 invalid_redirect_uri다", async () => {
    const { app } = setup();

    const res = await register(app, ["https://evil.example/callback"]);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_redirect_uri");
  });

  it("WHEN 상한 2에서 A가 토큰을 받고 B를 등록한 뒤 10분이 지나 C를 등록하면 THEN C는 201, B는 사라지고 A의 토큰은 그대로 열린다", async () => {
    const { app, clock } = setup({ maxClients: 2 });
    const clientA = await registeredClientId(app);
    const { access_token: tokenA } = await tokensFor(app, clientA);
    const clientB = await registeredClientId(app);

    clock.now += GRACE_MS;
    const registerC = await register(app);
    const authorizeB = await postAuthorize(app, withLogin(authorizeParams(clientB)));
    const toolsA = await rpc(app, "tools/list", {}, tokenA);

    expect(registerC.status).toBe(201);
    expect(authorizeB.status).toBe(400);
    expect(toolsA.status).toBe(200);
  });

  it("WHEN 상한 2에서 A가 토큰을 받고 B를 등록한 직후 C를 등록하면 THEN C는 503이고 B는 그대로 인가된다", async () => {
    const { app } = setup({ maxClients: 2 });
    await tokensFor(app, await registeredClientId(app));
    const clientB = await registeredClientId(app);

    const registerC = await register(app);
    const authorizeB = await postAuthorize(app, withLogin(authorizeParams(clientB)));

    expect(registerC.status).toBe(503);
    expect(authorizeB.status).toBe(302);
  });

  it("WHEN 상한 1에서 A가 토큰을 받은 뒤 B를 등록하면 THEN 503 temporarily_unavailable이다", async () => {
    const { app } = setup({ maxClients: 1 });
    await tokensFor(app, await registeredClientId(app));

    const res = await register(app);

    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe("temporarily_unavailable");
  });
});

describe("mcp-oauth-grant — 인가 · 토큰 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN 로그인하고 허용하면 THEN 등록한 redirect_uri로 code · state · iss가 간다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);

    const res = await postAuthorize(app, withLogin(authorizeParams(clientId)));
    const location = redirectOf(res);

    expect(res.status).toBe(302);
    expect(`${location.origin}${location.pathname}`).toBe(CLAUDE_CALLBACK);
    expect(location.searchParams.get("code")).toBeTruthy();
    expect(location.searchParams.get("state")).toBe("state-xyz");
    expect(location.searchParams.get("iss")).toBe(ISSUER);
  });

  it("WHEN 세션 없이 틀린 비밀번호로 허용하면 THEN 401이고 Location이 없다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);

    const res = await postAuthorize(app, {
      ...authorizeParams(clientId),
      username: TEST_ACCOUNT.username,
      password: "wrong-password",
      decision: "allow",
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("WHEN code_challenge 없이 로그인 · 허용하면 THEN redirect_uri로 invalid_request가 가고 code는 없다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);

    const res = await postAuthorize(
      app,
      withLogin(authorizeParams(clientId, { code_challenge: null, code_challenge_method: null })),
    );
    const location = redirectOf(res);

    expect(location.searchParams.get("error")).toBe("invalid_request");
    expect(location.searchParams.get("code")).toBeNull();
  });

  it("WHEN 로그인하고 거부하면 THEN access_denied가 가고 code는 없다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);

    const res = await postAuthorize(app, withLogin(authorizeParams(clientId), "deny"));
    const location = redirectOf(res);

    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("code")).toBeNull();
  });

  it("WHEN 다른 Origin에서 세션 쿠키로 허용을 보내면 THEN 403이고 Location이 없다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.username, TEST_ACCOUNT.password));

    const res = await postAuthorize(
      app,
      { ...authorizeParams(clientId), decision: "allow" },
      { cookie, origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("WHEN 받은 code를 다른 code_verifier로 내면 THEN 400 invalid_grant다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    const code = await codeFor(app, clientId);

    const res = await exchange(
      app,
      clientId,
      code,
      "a-different-verifier-0123456789abcdefghijklmnop",
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_grant");
  });

  it("WHEN 한 번 교환한 code를 다시 내면 THEN 두 번째는 400 invalid_grant다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    const code = await codeFor(app, clientId);

    const first = await exchange(app, clientId, code);
    const second = await exchange(app, clientId, code);

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(((await second.json()) as { error: string }).error).toBe("invalid_grant");
  });

  it("WHEN refresh로 토큰을 받고 같은 옛 refresh로 한 번 더 부르면 THEN 첫 번째는 새 토큰, 두 번째는 invalid_grant다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    const tokens = (await (
      await exchange(app, clientId, await codeFor(app, clientId))
    ).json()) as TokenResponse;
    const refresh = {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
    };

    const first = await postToken(app, refresh);
    const rotated = (await first.json()) as TokenResponse;
    const second = await postToken(app, refresh);

    expect(first.status).toBe(200);
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);
    expect(rotated.access_token).toBeTruthy();
    expect(second.status).toBe(400);
    expect(((await second.json()) as { error: string }).error).toBe("invalid_grant");
  });

  it("WHEN 세션 쿠키로 아이디 · 비밀번호 없이 허용하면 THEN 302이고 Location에 code가 있다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.username, TEST_ACCOUNT.password));

    const res = await postAuthorize(
      app,
      { ...authorizeParams(clientId), decision: "allow" },
      { cookie },
    );

    expect(res.status).toBe(302);
    expect(redirectOf(res).searchParams.get("code")).toBeTruthy();
  });

  it("WHEN claude.ai 콜백 클라이언트에 루프백 redirect_uri를 붙여 허용하면 THEN 400이고 Location이 없다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    await register(app, ["http://127.0.0.1:5555/callback"]);

    const res = await postAuthorize(
      app,
      withLogin(authorizeParams(clientId, { redirect_uri: "http://127.0.0.1:5555/callback" })),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("WHEN 루프백 5555로 등록하고 6666으로 허용하면 THEN 6666 콜백으로 code가 간다", async () => {
    const { app } = setup();
    const body = (await (await register(app, ["http://127.0.0.1:5555/callback"])).json()) as {
      client_id: string;
    };

    const res = await postAuthorize(
      app,
      withLogin(
        authorizeParams(body.client_id, { redirect_uri: "http://127.0.0.1:6666/callback" }),
      ),
    );
    const location = redirectOf(res);

    expect(res.status).toBe(302);
    expect(`${location.origin}${location.pathname}`).toBe("http://127.0.0.1:6666/callback");
    expect(location.searchParams.get("code")).toBeTruthy();
  });

  it("WHEN A가 받은 코드를 B의 client_id로 내면 THEN 400 invalid_grant다", async () => {
    const { app } = setup();
    const clientA = await registeredClientId(app);
    const clientB = await registeredClientId(app);
    const code = await codeFor(app, clientA);

    const res = await exchange(app, clientB, code);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_grant");
  });

  it("WHEN 받은 코드를 redirect_uri 끝에 /를 붙여 내면 THEN 400 invalid_grant다", async () => {
    const { app } = setup();
    const clientId = await registeredClientId(app);
    const code = await codeFor(app, clientId);

    const res = await postToken(app, {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: `${CLAUDE_CALLBACK}/`,
      code_verifier: VERIFIER,
      resource: MCP_URL,
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_grant");
  });
});
