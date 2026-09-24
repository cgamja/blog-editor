import { convertMarkdown, serializeMarkdown } from "@blog-editor/content-convert";
import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { createApp } from "../app";
import { createMemoryPostStore } from "../memory-store";
import type { PostStore } from "../store";
import { TEST_ACCOUNT, cookieOf, loginRequest, testAuthOptions } from "../test-app";
import { hashConnectionToken } from "./connection-tokens";
import { createMemoryConnectionTokenStore } from "./memory-connection-token-store";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const TOKEN = "test-connection-token-0123456789abcdef";
const TOKEN_NAME = "claude-code";
const EDITOR_BASE_URL = "https://editor.example.test";
// 2025-era 무상태 요청 — SDK가 세션 없이 요청마다 새 서버로 답한다(adr-016)
const PROTOCOL_VERSION = "2025-06-18";

function setup(store: PostStore = createMemoryPostStore()) {
  const app = createApp({
    store,
    categories: CATEGORIES,
    imageBaseUrl: "https://simsimeestudio.com",
    ...testAuthOptions,
    mcp: {
      connectionTokens: createMemoryConnectionTokenStore([
        { name: TOKEN_NAME, tokenHash: hashConnectionToken(TOKEN) },
      ]),
      editorBaseUrl: EDITOR_BASE_URL,
      formatGuide: "형식 가이드",
    },
  });
  return { store, app };
}

type App = ReturnType<typeof setup>["app"];

function rpc(app: App, method: string, params: unknown, token: string | null = TOKEN) {
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

/** 응답은 JSON 본문이거나 SSE `data:` 한 줄이다 — 어느 쪽이든 JSON-RPC 결과를 꺼낸다 */
async function resultOf(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const payload = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice("data: ".length);
  const message = JSON.parse(payload) as { result?: Record<string, unknown> };
  if (message.result === undefined) throw new Error(`JSON-RPC 결과가 없다: ${text}`);
  return message.result;
}

async function callTool(app: App, name: string, args: Record<string, unknown>) {
  const result = await resultOf(await rpc(app, "tools/call", { name, arguments: args }));
  const content = result.content as Array<{ type: string; text: string }>;
  return { isError: result.isError === true, text: content.map((part) => part.text).join("\n") };
}

function published(file: PostFile): PostFile {
  return { ...file, meta: { ...file.meta, draft: false } };
}

const NEW_DRAFT = {
  slug: "ai-draft",
  title: "AI가 쓴 초안",
  description: "커넥터로 올린 초안",
  category: "studio",
  markdown: "안녕하세요. 커넥터로 쓴 첫 문단입니다.",
};

describe("mcp-auth — 연결용 토큰 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN Authorization 없이 tools/list를 보내면 THEN 401이고 WWW-Authenticate가 Bearer다", async () => {
    const { app } = setup();

    const res = await rpc(app, "tools/list", {}, null);

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
  });

  it("WHEN 저장소에 없는 토큰으로 tools/list를 보내면 THEN 401이다", async () => {
    const { app } = setup();

    const res = await rpc(app, "tools/list", {}, "not-a-registered-token-0123456789");

    expect(res.status).toBe(401);
  });

  it("WHEN 연결용 토큰 설정 없이 만든 앱에 /mcp를 부르면 THEN 404다", async () => {
    const app = createApp({
      store: createMemoryPostStore(),
      categories: CATEGORIES,
      imageBaseUrl: "https://simsimeestudio.com",
      ...testAuthOptions,
    });

    const res = await rpc(app, "tools/list", {});

    expect(res.status).toBe(404);
  });

  it("WHEN 세션 쿠키만으로 /mcp를 부르면 THEN 401이다", async () => {
    const { app } = setup();
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.username, TEST_ACCOUNT.password));

    const res = await app.request("/mcp", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": PROTOCOL_VERSION,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });

    expect(res.status).toBe(401);
  });

  it("WHEN 연결용 토큰만으로 /api/posts를 부르면 THEN 401이다", async () => {
    const { app } = setup();

    const res = await app.request("/api/posts", {
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(res.status).toBe(401);
  });
});

describe("mcp-drafts — 초안만 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN 유효한 토큰으로 tools/list를 부르면 THEN 도구가 정확히 6개이고 발행 도구가 없다", async () => {
    const { app } = setup();

    const result = await resultOf(await rpc(app, "tools/list", {}));
    const names = (result.tools as Array<{ name: string }>).map((tool) => tool.name).sort();

    expect(names).toEqual([
      "check_draft",
      "create_draft",
      "get_post",
      "get_writing_guide",
      "list_posts",
      "update_draft",
    ]);
  });

  it("WHEN 발행된 글에 update_draft · create_draft에 draft:false를 부르면 THEN 둘 다 오류이고 저장 · 공개 조회가 그대로다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("beta-open", published(fixtures.minimal), null);
    const publicBefore = await (await app.request("/public/posts")).json();

    const update = await callTool(app, "update_draft", {
      slug: "beta-open",
      revision,
      markdown: "AI가 발행 글을 고치려 한다.",
    });
    const create = await callTool(app, "create_draft", { ...NEW_DRAFT, draft: false });

    expect(update.isError).toBe(true);
    expect(create.isError).toBe(true);
    expect((await store.get("beta-open"))?.file).toEqual(published(fixtures.minimal));
    expect(await store.get(NEW_DRAFT.slug)).toBeNull();
    expect(await (await app.request("/public/posts")).json()).toEqual(publicBefore);
  });

  it("WHEN 발행된 글의 slug로 create_draft를 부르면 THEN 충돌 오류이고 발행 글은 그대로다", async () => {
    const { store, app } = setup();
    await store.put(NEW_DRAFT.slug, published(fixtures.minimal), null);

    const result = await callTool(app, "create_draft", NEW_DRAFT);

    expect(result.isError).toBe(true);
    expect((await store.get(NEW_DRAFT.slug))?.file).toEqual(published(fixtures.minimal));
  });

  it("WHEN 초안을 읽은 뒤 그 글이 발행되고 발행된 판의 revision으로 update_draft가 오면 THEN 충돌이고 발행 글은 그대로다", async () => {
    // 확인한 판(초안)과 쓰는 판(발행)이 다르면 초안 검사를 건너뛴 채 발행 글을 덮을 수 있다
    const inner = createMemoryPostStore();
    await inner.put("beta-open", fixtures.minimal, null);
    const draftSnapshot = await inner.get("beta-open");
    if (draftSnapshot === null) throw new Error("준비한 초안이 없다");
    const { revision: publishedRevision } = await inner.put(
      "beta-open",
      published(fixtures.minimal),
      draftSnapshot.revision,
    );
    // 읽기와 쓰기 사이에 발행이 끼어든 상황 — 읽기는 발행 전 초안을 본다
    const racing: PostStore = { ...inner, get: async () => draftSnapshot };
    const { app } = setup(racing);

    const result = await callTool(app, "update_draft", {
      slug: "beta-open",
      revision: publishedRevision,
      markdown: "AI가 발행 글을 덮으려 한다.",
    });

    expect(result.isError).toBe(true);
    expect((await inner.get("beta-open"))?.file).toEqual(published(fixtures.minimal));
  });
});

describe("mcp-drafts — 크기 제한", () => {
  it("WHEN 본문이 1 MiB를 넘거나 markdown이 20만 자를 넘으면 THEN 413 · 도구 오류이고 아무것도 저장되지 않는다", async () => {
    const { store, app } = setup();

    const oversizedBody = await rpc(app, "tools/call", {
      name: "create_draft",
      arguments: { ...NEW_DRAFT, markdown: "가".repeat(400_000) },
    });
    const tooLong = await callTool(app, "create_draft", {
      ...NEW_DRAFT,
      markdown: "a".repeat(200_001),
    });

    expect(oversizedBody.status).toBe(413);
    expect(tooLong.isError).toBe(true);
    expect(await store.list()).toEqual([]);
  });

  it("WHEN 토큰 없이 1 MiB를 넘는 본문을 보내면 THEN 크기보다 인증이 먼저라 401이다", async () => {
    const { app } = setup();

    const res = await rpc(
      app,
      "tools/call",
      { name: "create_draft", arguments: { ...NEW_DRAFT, markdown: "가".repeat(400_000) } },
      null,
    );

    expect(res.status).toBe(401);
  });
});

describe("mcp-drafts — 서버 오류", () => {
  it("WHEN 저장소가 내부 경로가 담긴 예외를 던지면 THEN 도구 오류에 그 경로가 없다", async () => {
    const secretPath = "/srv/secret/workspaces/default/posts";
    const failing: PostStore = {
      ...createMemoryPostStore(),
      list: async () => {
        throw new Error(`ENOENT: ${secretPath}`);
      },
    };
    const { app } = setup(failing);

    const result = await callTool(app, "list_posts", {});

    expect(result.isError).toBe(true);
    expect(result.text).not.toContain(secretPath);
  });
});

describe("mcp-drafts — 쓰기 · 읽기", () => {
  it("WHEN 올바른 markdown으로 create_draft를 부르면 THEN 초안으로 저장되고 출처 · revision · 에디터 링크가 있다", async () => {
    const { store, app } = setup();

    const created = await callTool(app, "create_draft", NEW_DRAFT);
    const body = JSON.parse(created.text) as { slug: string; revision: string; editorUrl: string };
    const saved = await store.get(NEW_DRAFT.slug);

    expect(created.isError).toBe(false);
    expect(saved?.file.meta.draft).toBe(true);
    expect(saved?.file.meta.source).toBe(`token:${TOKEN_NAME}`);
    expect(body.revision).toBe(saved?.revision);
    expect(body.editorUrl).toBe(`${EDITOR_BASE_URL}/posts/${NEW_DRAFT.slug}/edit`);
  });

  it.each(["create_draft", "check_draft"])(
    "WHEN 지시어 값이 틀린 markdown으로 %s를 부르면 THEN 오류에 convertMarkdown 메시지가 그대로 있고 아무것도 저장되지 않는다",
    async (tool) => {
      const { store, app } = setup();
      const markdown = "{font=nope}\n문단";
      const converted = convertMarkdown(markdown);
      if (converted.ok) throw new Error("테스트 입력이 변환에 성공했다 — 틀린 입력이어야 한다");

      const result = await callTool(app, tool, { ...NEW_DRAFT, markdown });

      expect(result.isError).toBe(true);
      for (const message of converted.messages) expect(result.text).toContain(message);
      expect(await store.list()).toEqual([]);
    },
  );

  it("WHEN 저장된 글에 get_post를 부르면 THEN serializeMarkdown 결과 · losses · revision을 준다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("deco", fixtures.decorationMax, null);
    const expected = serializeMarkdown(fixtures.decorationMax.doc);

    const result = await callTool(app, "get_post", { slug: "deco" });
    const body = JSON.parse(result.text) as {
      markdown: string;
      losses: unknown;
      revision: string;
    };

    expect(result.isError).toBe(false);
    expect(body.markdown).toBe(expected.markdown);
    expect(body.losses).toEqual(expected.losses);
    expect(body.revision).toBe(revision);
  });

  it("WHEN 에디터가 먼저 고친 뒤 옛 revision으로 update_draft를 부르면 THEN 충돌 오류이고 글은 에디터가 쓴 그대로다", async () => {
    const { store, app } = setup();
    const { revision: stale } = await store.put("beta-open", fixtures.minimal, null);
    const byEditor: PostFile = {
      ...fixtures.minimal,
      meta: { ...fixtures.minimal.meta, title: "에디터가 고침" },
    };
    await store.put("beta-open", byEditor, stale);

    const result = await callTool(app, "update_draft", {
      slug: "beta-open",
      revision: stale,
      markdown: "AI가 옛 판으로 덮으려 한다.",
    });

    expect(result.isError).toBe(true);
    expect((await store.get("beta-open"))?.file).toEqual(byEditor);
  });
});
