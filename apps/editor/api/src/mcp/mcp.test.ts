import { convertMarkdown, serializeMarkdown } from "@blog-editor/content-convert";
import { fixtures, scoreSeo } from "@blog-editor/content-schema";
import type { PostFile, SeoFinding } from "@blog-editor/content-schema";
import { createApp } from "../app";
import { probeImage } from "../image-probe";
import { MAX_GUIDE_LENGTH } from "../input-limits";
import { createMemoryPostStore } from "../memory-store";
import { createMemorySettingsStore } from "../memory-settings-store";
import type { PostStore } from "../store";
import { TEST_ACCOUNT, cookieOf, loginRequest, testAuthOptions } from "../test-app.test.helpers";
import { hashConnectionToken } from "./connection-tokens";
import { createMemoryConnectionTokenStore } from "./memory-connection-token-store";
import { MCP_WORKSPACE_GUIDE_HEADING } from "./messages";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const TOKEN = "test-connection-token-0123456789abcdef";
const TOKEN_NAME = "claude-code";
const EDITOR_BASE_URL = "https://editor.example.test";
// 2025-era 무상태 요청 — SDK가 세션 없이 요청마다 새 서버로 답한다(adr-016)
const PROTOCOL_VERSION = "2025-06-18";

function setup(store: PostStore = createMemoryPostStore()) {
  const settings = createMemorySettingsStore();
  const app = createApp({
    store,
    settings,
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
  return { store, settings, app };
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
  // 도구를 더할 때는 이 허용 목록에 한 줄을 더한다(사람 승인 — 2026-09-28). 발행 도구가 없다는 단언은 목록과 따로 둔다
  it("WHEN 유효한 토큰으로 tools/list를 부르면 THEN 도구가 허용 목록과 정확히 같고 발행 도구가 없다", async () => {
    const { app } = setup();

    const result = await resultOf(await rpc(app, "tools/list", {}));
    const names = (result.tools as Array<{ name: string }>).map((tool) => tool.name).sort();

    expect(names.filter((name) => /publish/i.test(name))).toEqual([]);
    expect(names).toEqual([
      "check_draft",
      "create_draft",
      "get_post",
      "get_writing_guide",
      "list_posts",
      "preview_post",
      "revert_draft",
      "update_draft",
      "update_writing_guide",
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

describe("mcp-drafts — 워크스페이스 글쓰기 가이드", () => {
  it("WHEN 설정에 가이드를 저장한 뒤 get_writing_guide를 부르면 THEN 형식 가이드로 시작하고 저장한 가이드를 담는다", async () => {
    const { app } = setup();
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.username, TEST_ACCOUNT.password));
    const guide = "말투: 친근한 존댓말. 독자: 첫 아이를 키우는 부모.";
    const saved = await app.request("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ guide }),
    });
    expect(saved.status).toBe(200);

    const result = await callTool(app, "get_writing_guide", {});

    expect(result.isError).toBe(false);
    expect(result.text.startsWith("형식 가이드")).toBe(true);
    expect(result.text).toContain(guide);
  });

  it("WHEN update_writing_guide로 가이드를 바꾸면 THEN 응답 · 설정 저장소에 그 가이드가 있고 get_writing_guide가 형식 가이드 뒤에 준다", async () => {
    const { settings, app } = setup();
    const guide = "문단은 세 줄 이내로 쓴다.";

    const updated = await callTool(app, "update_writing_guide", { guide });

    expect(updated.isError).toBe(false);
    expect(updated.text).toContain(guide);
    expect((await settings.get()).guide).toBe(guide);
    const read = await callTool(app, "get_writing_guide", {});
    expect(read.text.startsWith("형식 가이드")).toBe(true);
    expect(read.text.indexOf(guide)).toBeGreaterThan(read.text.indexOf("형식 가이드"));
  });

  it("WHEN 설정 저장 상한보다 긴 가이드로 update_writing_guide를 부르면 THEN 도구 오류이고 저장된 가이드는 그대로다", async () => {
    const { settings, app } = setup();
    await settings.put({ guide: "원래 가이드" });

    const result = await callTool(app, "update_writing_guide", {
      guide: "가".repeat(MAX_GUIDE_LENGTH + 1),
    });

    expect(result.isError).toBe(true);
    expect((await settings.get()).guide).toBe("원래 가이드");
  });

  it("WHEN get_writing_guide 응답 전체(형식 가이드 · 워크스페이스 가이드 제목 포함)로 update_writing_guide를 부르면 THEN 도구 오류이고 저장된 가이드는 그대로다", async () => {
    const { settings, app } = setup();
    await settings.put({ guide: "원래 가이드" });
    const whole = (await callTool(app, "get_writing_guide", {})).text;
    const headingOnly = `${MCP_WORKSPACE_GUIDE_HEADING}\n\n문단은 짧게 쓴다.`;

    const withWhole = await callTool(app, "update_writing_guide", { guide: `${whole}\n새 줄` });
    const withHeading = await callTool(app, "update_writing_guide", { guide: headingOnly });

    expect(withWhole.isError).toBe(true);
    expect(withHeading.isError).toBe(true);
    expect(withHeading.text).toContain("워크스페이스 가이드 부분만");
    expect((await settings.get()).guide).toBe("원래 가이드");
  });
});

describe("mcp-drafts — SEO 검사", () => {
  it("WHEN alt가 빈 이미지가 든 markdown으로 create_draft를 부르면 THEN 저장되고 응답 seo에 image-alt가 있다", async () => {
    const { store, app } = setup();

    const created = await callTool(app, "create_draft", {
      ...NEW_DRAFT,
      markdown: "첫 문단입니다.\n\n![](/images/cherry-walk.webp)",
    });
    const body = JSON.parse(created.text) as { seo: Array<{ rule: string; level: string }> };

    expect(created.isError).toBe(false);
    expect(await store.get(NEW_DRAFT.slug)).not.toBeNull();
    expect(body.seo).toContainEqual(expect.objectContaining({ rule: "image-alt", level: "must" }));
  });

  it("WHEN alt가 빈 이미지가 든 markdown으로 check_draft · create_draft를 부르면 THEN 응답 seoScore가 그 seo의 점수이고 100보다 작다", async () => {
    const { app } = setup();
    const markdown = "첫 문단입니다.\n\n![](/images/cherry-walk.webp)";

    const checked = await callTool(app, "check_draft", { markdown });
    const created = await callTool(app, "create_draft", { ...NEW_DRAFT, markdown });

    for (const result of [checked, created]) {
      const body = JSON.parse(result.text) as { seo: SeoFinding[]; seoScore: number };
      expect(result.isError).toBe(false);
      expect(body.seoScore).toBe(scoreSeo(body.seo));
      expect(body.seoScore).toBeLessThan(100);
    }
  });

  it("WHEN update_draft로 제목만 · edit로 고치면 THEN 두 응답 모두 seoScore가 그 seo의 점수다", async () => {
    const { app } = setup();
    const created = await callTool(app, "create_draft", NEW_DRAFT);
    const first = JSON.parse(created.text) as { revision: string };

    const titled = await callTool(app, "update_draft", {
      slug: NEW_DRAFT.slug,
      revision: first.revision,
      title: "고친 제목",
    });
    const second = JSON.parse(titled.text) as { revision: string };
    const edited = await callTool(app, "update_draft", {
      slug: NEW_DRAFT.slug,
      revision: second.revision,
      edit: { command: "insert_after", selection: "첫 문단", markdown: "둘째 문단입니다." },
    });

    for (const result of [titled, edited]) {
      const body = JSON.parse(result.text) as { seo: SeoFinding[]; seoScore: number };
      expect(result.isError).toBe(false);
      expect(body.seoScore).toBe(scoreSeo(body.seo));
    }
  });

  it("WHEN 저장한 뒤 목록 읽기가 실패하면 THEN 저장 성공이고 seo · seoScore가 둘 다 null이다", async () => {
    const failing: PostStore = {
      ...createMemoryPostStore(),
      list: async () => {
        throw new Error("목록 실패");
      },
    };
    const { app } = setup(failing);

    const created = await callTool(app, "create_draft", NEW_DRAFT);

    expect(created.isError).toBe(false);
    expect(JSON.parse(created.text)).toMatchObject({ seo: null, seoScore: null });
  });

  it("WHEN keyword를 넣어 create_draft한 뒤 keyword 없이 update_draft하면 THEN 처음 keyword가 그대로다", async () => {
    const { store, app } = setup();
    const created = await callTool(app, "create_draft", { ...NEW_DRAFT, keyword: "봄 산책" });
    const { revision } = JSON.parse(created.text) as { revision: string };

    const updated = await callTool(app, "update_draft", {
      slug: NEW_DRAFT.slug,
      revision,
      markdown: "고친 첫 문단입니다.",
    });

    expect(updated.isError).toBe(false);
    expect((await store.get(NEW_DRAFT.slug))?.file.meta.keyword).toBe("봄 산책");
  });

  it("WHEN 목록에 제목이 문자열이 아닌 항목이 섞여 있어도 THEN create_draft는 저장되고 성공 응답이다", async () => {
    const base = createMemoryPostStore();
    const store: PostStore = {
      ...base,
      list: async () => [
        ...(await base.list()),
        { slug: "broken", meta: { title: 42 } } as unknown as Awaited<
          ReturnType<PostStore["list"]>
        >[number],
      ],
    };
    const { app } = setup(store);

    const created = await callTool(app, "create_draft", NEW_DRAFT);

    expect(created.isError).toBe(false);
    expect(await base.get(NEW_DRAFT.slug)).not.toBeNull();
  });

  it("WHEN 유효한 토큰으로 initialize를 부르면 THEN instructions에 get_writing_guide와 seo가 있다", async () => {
    const { app } = setup();

    const result = await resultOf(
      await rpc(app, "initialize", {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      }),
    );

    expect(result.instructions).toEqual(expect.stringContaining("get_writing_guide"));
    expect(result.instructions).toEqual(expect.stringContaining("seo"));
  });
});

describe("mcp-drafts — update_draft 부분 고치기", () => {
  const HEART = { id: "heart", x: 90, y: 10, size: 12, rotate: 15 } as const;
  const STICKERED: PostFile = {
    ...fixtures.minimal,
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { stickers: [HEART] },
          content: [{ type: "text", text: "벚꽃길은 주말에 붐빈다." }],
        },
        { type: "paragraph", content: [{ type: "text", text: "도시락은 전날 싼다." }] },
      ],
    },
  };

  it("WHEN 스티커가 있는 초안에 edit replace로 update_draft하면 THEN 그 글자만 바뀌고 스티커 · 다른 블록이 그대로이며 새 revision과 seo가 있다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("spring-walk", STICKERED, null);

    const result = await callTool(app, "update_draft", {
      slug: "spring-walk",
      revision,
      edit: { command: "replace", selection: "주말에 붐빈다", markdown: "평일 아침이 한가하다" },
    });

    expect(result.isError).toBe(false);
    const body = JSON.parse(result.text) as { revision: string; seo: unknown };
    expect(body.revision).not.toBe(revision);
    expect(Array.isArray(body.seo)).toBe(true);
    const saved = await store.get("spring-walk");
    expect(saved?.file.doc.content).toEqual([
      {
        type: "paragraph",
        attrs: { stickers: [HEART] },
        content: [{ type: "text", text: "벚꽃길은 평일 아침이 한가하다." }],
      },
      STICKERED.doc.content[1],
    ]);
    expect(saved?.file.meta.draft).toBe(true);
  });

  it("WHEN markdown · edit 없이 title만 주어 update_draft하면 THEN 제목만 바뀌고 문서는 그대로다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("spring-walk", STICKERED, null);

    const result = await callTool(app, "update_draft", {
      slug: "spring-walk",
      revision,
      title: "봄날 산책",
    });

    expect(result.isError).toBe(false);
    const saved = await store.get("spring-walk");
    expect(saved?.file.meta.title).toBe("봄날 산책");
    expect(saved?.file.doc).toEqual(STICKERED.doc);
  });

  it("WHEN markdown과 edit를 함께 주어 update_draft하면 THEN 도구 오류이고 글이 그대로다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("spring-walk", STICKERED, null);

    const result = await callTool(app, "update_draft", {
      slug: "spring-walk",
      revision,
      markdown: "통째로 바꾼 글",
      edit: { command: "replace", selection: "도시락", markdown: "김밥" },
    });

    expect(result.isError).toBe(true);
    expect((await store.get("spring-walk"))?.file).toEqual(STICKERED);
  });

  it("WHEN markdown · edit · 글 정보 없이 update_draft하면 THEN 도구 오류이고 글이 그대로다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("spring-walk", STICKERED, null);

    const result = await callTool(app, "update_draft", { slug: "spring-walk", revision });

    expect(result.isError).toBe(true);
    expect((await store.get("spring-walk"))?.revision).toBe(revision);
  });

  it("WHEN 발행 글에 edit로 update_draft하면 THEN 도구 오류이고 발행 글이 그대로다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("spring-walk", published(STICKERED), null);

    const result = await callTool(app, "update_draft", {
      slug: "spring-walk",
      revision,
      edit: { command: "replace", selection: "도시락", markdown: "김밥" },
    });

    expect(result.isError).toBe(true);
    expect((await store.get("spring-walk"))?.file).toEqual(published(STICKERED));
  });
});

describe("mcp-drafts — 도구 표시(annotations)", () => {
  it("WHEN tools/list를 부르면 THEN 읽기 도구 5개는 readOnlyHint가 true이고 쓰기 도구 4개는 아니다", async () => {
    // 클라이언트(Codex writes 모드 등)는 readOnlyHint로 확인 없이 부를 도구를 고른다
    const { app } = setup();

    const result = await resultOf(await rpc(app, "tools/list", {}));
    const tools = result.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean } }>;
    const readOnlyOf = Object.fromEntries(
      tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint === true]),
    );

    expect(readOnlyOf).toEqual({
      check_draft: true,
      create_draft: false,
      get_post: true,
      get_writing_guide: true,
      list_posts: true,
      preview_post: true,
      revert_draft: false,
      update_draft: false,
      update_writing_guide: false,
    });
  });
});

describe("mcp-drafts — revert_draft(AI 수정 되돌리기)", () => {
  it("WHEN update_draft로 문단을 고친 뒤 revert_draft를 부르면 THEN 글이 고치기 전 내용이고 응답에 새 revision이 있으며 다시 부르면 되돌릴 판이 없다는 오류다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("beta-open", fixtures.minimal, null);
    await callTool(app, "update_draft", {
      slug: "beta-open",
      revision,
      markdown: "AI가 고친 문단입니다.",
    });

    const reverted = await callTool(app, "revert_draft", { slug: "beta-open" });
    const again = await callTool(app, "revert_draft", { slug: "beta-open" });

    expect(reverted.isError).toBe(false);
    const saved = await store.get("beta-open");
    expect(saved?.file).toEqual(fixtures.minimal);
    expect((JSON.parse(reverted.text) as { revision: string }).revision).toBe(saved?.revision);
    expect(again.isError).toBe(true);
    expect((await store.get("beta-open"))?.file).toEqual(fixtures.minimal);
  });

  it("WHEN update_draft 뒤 에디터(REST)에서 같은 글을 저장하고 revert_draft를 부르면 THEN 도구 오류이고 글은 사람이 저장한 내용 그대로다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("beta-open", fixtures.minimal, null);
    const updated = await callTool(app, "update_draft", {
      slug: "beta-open",
      revision,
      markdown: "AI가 고친 문단입니다.",
    });
    const aiRevision = (JSON.parse(updated.text) as { revision: string }).revision;
    const aiSaved = await store.get("beta-open");
    if (aiSaved === null) throw new Error("AI가 고친 글이 없다");
    const byHuman: PostFile = {
      ...aiSaved.file,
      meta: { ...aiSaved.file.meta, title: "사람이 고친 제목" },
    };
    const cookie = cookieOf(await loginRequest(app, TEST_ACCOUNT.username, TEST_ACCOUNT.password));
    const humanSave = await app.request("/api/posts/beta-open", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie, "If-Match": `"${aiRevision}"` },
      body: JSON.stringify(byHuman),
    });
    expect(humanSave.status).toBe(200);

    const result = await callTool(app, "revert_draft", { slug: "beta-open" });

    expect(result.isError).toBe(true);
    expect((await store.get("beta-open"))?.file).toEqual(byHuman);
  });

  it("WHEN create_draft로 새 글을 만든 뒤 revert_draft를 부르면 THEN 도구 오류이고 글은 그대로다", async () => {
    const { store, app } = setup();
    await callTool(app, "create_draft", NEW_DRAFT);
    const before = await store.get(NEW_DRAFT.slug);

    const result = await callTool(app, "revert_draft", { slug: NEW_DRAFT.slug });

    expect(result.isError).toBe(true);
    expect(await store.get(NEW_DRAFT.slug)).toEqual(before);
  });
});

describe("posts-api — AI 수정 되돌리기", () => {
  /** MCP update_draft로 초안 하나를 고쳐 둔다 — 남긴 판이 생긴다 */
  async function aiEdited() {
    const env = setup();
    const { revision } = await env.store.put("beta-open", fixtures.minimal, null);
    const updated = await callTool(env.app, "update_draft", {
      slug: "beta-open",
      revision,
      markdown: "AI가 고친 문단입니다.",
    });
    const aiRevision = (JSON.parse(updated.text) as { revision: string }).revision;
    const cookie = cookieOf(
      await loginRequest(env.app, TEST_ACCOUNT.username, TEST_ACCOUNT.password),
    );
    return { ...env, aiRevision, cookie };
  }

  it("WHEN MCP update_draft 뒤 로그인 세션으로 GET · POST(If-Match 지금 revision)를 부르면 THEN GET은 available true이고 POST 뒤 글은 고치기 전 내용이며 GET은 available false다", async () => {
    const { store, app, aiRevision, cookie } = await aiEdited();

    const before = await app.request("/api/posts/beta-open/ai-undo", { headers: { cookie } });
    const reverted = await app.request("/api/posts/beta-open/ai-undo", {
      method: "POST",
      headers: { cookie, "If-Match": `"${aiRevision}"` },
    });
    const after = await app.request("/api/posts/beta-open/ai-undo", { headers: { cookie } });

    expect(before.status).toBe(200);
    expect(await before.json()).toEqual({ available: true });
    expect(reverted.status).toBe(200);
    expect((await store.get("beta-open"))?.file).toEqual(fixtures.minimal);
    expect(await after.json()).toEqual({ available: false });
  });

  it("WHEN If-Match가 지금 revision과 다른 채 POST하면 THEN 409이고 글은 AI가 고친 그대로다", async () => {
    const { store, app, cookie } = await aiEdited();
    const aiSaved = await store.get("beta-open");

    const res = await app.request("/api/posts/beta-open/ai-undo", {
      method: "POST",
      headers: { cookie, "If-Match": '"stale-revision"' },
    });

    expect(res.status).toBe(409);
    expect(await store.get("beta-open")).toEqual(aiSaved);
  });
});

describe("mcp-drafts — preview_post(미리보기 이미지)", () => {
  // 실제 Chromium(playwright-core, e2e와 같은 설치본)으로 찍는다 — 띄우는 시간을 넉넉히 둔다
  const BROWSER_TIMEOUT_MS = 60_000;
  const MAX_EDGE = 1568;
  const STICKERED: PostFile = {
    ...fixtures.minimal,
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { stickers: [{ id: "heart", x: 90, y: 10, size: 12, rotate: 15 }] },
          content: [{ type: "text", text: "벚꽃길은 주말에 붐빈다." }],
        },
        { type: "paragraph", content: [{ type: "text", text: "도시락은 전날 싼다." }] },
      ],
    },
  };

  type Content = Array<{ type: string; text?: string; data?: string; mimeType?: string }>;

  async function preview(app: App, args: Record<string, unknown>) {
    const result = await resultOf(
      await rpc(app, "tools/call", { name: "preview_post", arguments: args }),
    );
    const content = result.content as Content;
    const images = content
      .filter((part) => part.type === "image")
      .map((part) => ({
        mimeType: part.mimeType,
        size: probeImage(new Uint8Array(Buffer.from(part.data ?? "", "base64"))),
      }));
    const text = content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    return { isError: result.isError === true, text, images };
  }

  it("WHEN 저장소에 없는 slug로 preview_post를 부르면 THEN 도구 오류이고 이미지가 없다", async () => {
    const { app } = setup();

    const result = await preview(app, { slug: "no-such-post" });

    expect(result.isError).toBe(true);
    expect(result.images).toEqual([]);
  });

  it(
    "WHEN 문단 · 스티커가 있는 초안으로 preview_post를 부르면 THEN 데스크톱 · 모바일 순 JPEG 두 장이 폭 1280 · 390 이하 · 긴 변 1568 이하이고 글은 그대로다",
    async () => {
      const { store, app } = setup();
      const { revision } = await store.put("spring-walk", STICKERED, null);

      const result = await preview(app, { slug: "spring-walk" });

      expect(result.isError).toBe(false);
      expect(result.images.map((image) => image.mimeType)).toEqual(["image/jpeg", "image/jpeg"]);
      const [desktop, mobile] = result.images.map((image) => image.size);
      expect(desktop?.format).toBe("jpeg");
      expect(mobile?.format).toBe("jpeg");
      expect(desktop?.width).toBeLessThanOrEqual(1280);
      expect(mobile?.width).toBeLessThanOrEqual(390);
      for (const size of [desktop, mobile]) {
        expect(Math.max(size?.width ?? Infinity, size?.height ?? Infinity)).toBeLessThanOrEqual(
          MAX_EDGE,
        );
      }
      const saved = await store.get("spring-walk");
      expect(saved?.revision).toBe(revision);
      expect(saved?.file).toEqual(STICKERED);
    },
    BROWSER_TIMEOUT_MS,
  );

  it(
    "WHEN 한 구간보다 긴 초안을 part 없이 · part 2로 부르면 THEN 응답 글에 폭마다 전체 구간 수(2 이상)가 있고 part 2도 두 장이며 전체보다 큰 part는 도구 오류다",
    async () => {
      const { store, app } = setup();
      const paragraphs = Array.from({ length: 120 }, (_, index) => ({
        type: "paragraph" as const,
        content: [
          { type: "text" as const, text: `${index + 1}번째 문단 — 긴 글을 구간으로 나눠 찍는다.` },
        ],
      }));
      await store.put(
        "long-walk",
        { ...fixtures.minimal, doc: { type: "doc", content: paragraphs } },
        null,
      );

      const first = await preview(app, { slug: "long-walk" });
      const { parts } = JSON.parse(first.text) as { parts: { desktop: number; mobile: number } };
      const second = await preview(app, { slug: "long-walk", part: 2 });
      const beyond = await preview(app, {
        slug: "long-walk",
        part: Math.max(parts.desktop, parts.mobile) + 1,
      });

      expect(first.isError).toBe(false);
      expect(parts.desktop).toBeGreaterThanOrEqual(2);
      expect(parts.mobile).toBeGreaterThanOrEqual(2);
      expect(second.isError).toBe(false);
      expect(second.images.map((image) => image.mimeType)).toEqual(["image/jpeg", "image/jpeg"]);
      expect(beyond.isError).toBe(true);
      expect(beyond.images).toEqual([]);
    },
    BROWSER_TIMEOUT_MS,
  );
});
