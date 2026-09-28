import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { revertAiEdit } from "./ai-undo";
import { createApp } from "./app";
import { createMemoryAiUndoStore } from "./memory-ai-undo-store";
import { createMemoryPostStore } from "./memory-store";
import { hashConnectionToken } from "./mcp/connection-tokens";
import { createMemoryConnectionTokenStore } from "./mcp/memory-connection-token-store";
import type { PostStore } from "./store";
import { testAuthOptions, withSession } from "./test-app.test.helpers";

/**
 * AI 수정 되돌리기 안전 경로(openspec ai-undo · ADR-041) — 발행 글 · 조건 없는 요청 · 되돌릴 수 없는 까닭 ·
 * 공개 API 누출 · 손으로 고친 기록 · 주소 바꾸기 · 그사이 새 AI 저장. 기본 시나리오는 mcp.test.ts에 있다.
 */
const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const TOKEN = "test-connection-token-0123456789abcdef";
const PROTOCOL_VERSION = "2025-06-18";
const BEFORE_TITLE = "AI가 고치기 전 제목";
const BEFORE: PostFile = {
  ...fixtures.minimal,
  meta: { ...fixtures.minimal.meta, title: BEFORE_TITLE },
};

function setup(store: PostStore = createMemoryPostStore()) {
  const aiUndo = createMemoryAiUndoStore();
  const app = createApp({
    store,
    aiUndo,
    categories: CATEGORIES,
    imageBaseUrl: "https://simsimeestudio.com",
    ...testAuthOptions,
    mcp: {
      connectionTokens: createMemoryConnectionTokenStore([
        { name: "claude-code", tokenHash: hashConnectionToken(TOKEN) },
      ]),
      editorBaseUrl: "https://editor.example.test",
      formatGuide: "형식 가이드",
    },
  });
  return { store, aiUndo, app, client: withSession(app) };
}

type Env = ReturnType<typeof setup>;

async function callTool(env: Env, name: string, args: Record<string, unknown>) {
  const res = await env.app.request("/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const text = await res.text();
  const payload = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice("data: ".length);
  const { result } = JSON.parse(payload) as {
    result: { isError?: boolean; content: Array<{ text: string }> };
  };
  return { isError: result.isError === true, text: result.content.map((p) => p.text).join("\n") };
}

/** BEFORE를 저장하고 MCP update_draft로 제목 · 본문을 고친다 — 남긴 판이 생긴다. AI 저장의 revision을 돌려준다 */
async function aiEdited(env: Env): Promise<string> {
  const { revision } = await env.store.put("beta-open", BEFORE, null);
  const updated = await callTool(env, "update_draft", {
    slug: "beta-open",
    revision,
    markdown: "AI가 고친 문단입니다.",
    title: "AI가 고친 제목",
  });
  expect(updated.isError).toBe(false);
  return (JSON.parse(updated.text) as { revision: string }).revision;
}

const postRevert = (env: Env, headers: Record<string, string> = {}) =>
  env.client.request("/api/posts/beta-open/ai-undo", { method: "POST", headers });

describe("ai-undo — 발행 글은 되돌리지 않는다", () => {
  it("WHEN AI가 고친 초안을 사람이 발행한 뒤 revert_draft · POST를 부르면 THEN 실패이고 글은 발행한 그대로이며 공개 목록에 남긴 판이 없다", async () => {
    const env = setup();
    const aiRevision = await aiEdited(env);
    const aiSaved = await env.store.get("beta-open");
    if (aiSaved === null) throw new Error("AI가 고친 글이 없다");
    const publishedFile: PostFile = {
      ...aiSaved.file,
      meta: { ...aiSaved.file.meta, draft: false },
    };
    const publish = await env.client.request("/api/posts/beta-open", {
      method: "PUT",
      headers: { "content-type": "application/json", "If-Match": `"${aiRevision}"` },
      body: JSON.stringify(publishedFile),
    });
    expect(publish.status).toBe(200);
    const published = await env.store.get("beta-open");

    const tool = await callTool(env, "revert_draft", { slug: "beta-open" });
    const rest = await postRevert(env, { "If-Match": `"${published?.revision}"` });
    const status = await env.client.request(
      `/api/posts/beta-open/ai-undo?revision=${published?.revision}`,
    );
    const publicPosts = await env.app.request("/public/posts");

    expect(tool.isError).toBe(true);
    expect(rest.status).toBe(422);
    expect(await rest.json()).toMatchObject({ reason: "published" });
    expect(await status.json()).toEqual({ available: false });
    expect(await env.store.get("beta-open")).toEqual(published);
    expect(published?.file.meta.draft).toBe(false);
    const publicText = await publicPosts.text();
    expect(publicPosts.status).toBe(200);
    expect(publicText).not.toContain(BEFORE_TITLE);
  });
});

describe("ai-undo — REST 조건과 거절 본문", () => {
  it("WHEN If-Match 없이 POST하면 THEN 428이고 글은 AI가 고친 그대로다", async () => {
    const env = setup();
    await aiEdited(env);
    const aiSaved = await env.store.get("beta-open");

    const res = await postRevert(env);

    expect(res.status).toBe(428);
    expect(await env.store.get("beta-open")).toEqual(aiSaved);
  });

  it("WHEN 새로 만든 글 · 이미 되돌린 글에 지금 revision으로 POST하면 THEN 422이고 본문 reason이 newPost · nothing이다", async () => {
    const env = setup();
    const created = await callTool(env, "create_draft", {
      slug: "ai-draft",
      title: "AI가 쓴 초안",
      description: "커넥터로 올린 초안",
      category: "studio",
      markdown: "첫 문단입니다.",
    });
    const createdRevision = (JSON.parse(created.text) as { revision: string }).revision;
    const aiRevision = await aiEdited(env);
    const reverted = await postRevert(env, { "If-Match": `"${aiRevision}"` });
    const revertedRevision = ((await reverted.json()) as { revision: string }).revision;

    const newPost = await env.client.request("/api/posts/ai-draft/ai-undo", {
      method: "POST",
      headers: { "If-Match": `"${createdRevision}"` },
    });
    const again = await postRevert(env, { "If-Match": `"${revertedRevision}"` });

    expect(newPost.status).toBe(422);
    expect(await newPost.json()).toEqual({ message: expect.any(String), reason: "newPost" });
    expect(again.status).toBe(422);
    expect(await again.json()).toEqual({ message: expect.any(String), reason: "nothing" });
    expect((await env.store.get("beta-open"))?.file).toEqual(BEFORE);
  });

  it("WHEN 편집 화면이 옛 revision · 지금 revision으로 GET하면 THEN 지금 판일 때만 available이다", async () => {
    const env = setup();
    const aiRevision = await aiEdited(env);

    const stale = await env.client.request("/api/posts/beta-open/ai-undo?revision=stale-revision");
    const current = await env.client.request(`/api/posts/beta-open/ai-undo?revision=${aiRevision}`);

    expect(await stale.json()).toEqual({ available: false });
    expect(await current.json()).toEqual({ available: true });
  });
});

describe("ai-undo — 손으로 고친 기록 · 주소 바꾸기 · 그사이 새 AI 저장", () => {
  it("WHEN 남긴 판의 저장 전 파일이 발행 글이면 THEN GET은 available false이고 POST는 422 published이며 글은 그대로다", async () => {
    const env = setup();
    const aiRevision = await aiEdited(env);
    await env.aiUndo.put("beta-open", {
      before: { ...BEFORE, meta: { ...BEFORE.meta, draft: false } },
      after: aiRevision,
    });
    const aiSaved = await env.store.get("beta-open");

    const status = await env.client.request("/api/posts/beta-open/ai-undo");
    const res = await postRevert(env, { "If-Match": `"${aiRevision}"` });

    expect(await status.json()).toEqual({ available: false });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ reason: "published" });
    expect(await env.store.get("beta-open")).toEqual(aiSaved);
  });

  it("WHEN AI가 고친 초안의 주소를 바꾸면 THEN 옛 주소의 남긴 판이 지워진다", async () => {
    const env = setup();
    const aiRevision = await aiEdited(env);

    const res = await env.client.request("/api/posts/beta-open/rename", {
      method: "POST",
      headers: { "content-type": "application/json", "If-Match": `"${aiRevision}"` },
      body: JSON.stringify({ to: "new-home" }),
    });

    expect(res.status).toBe(200);
    expect(await env.aiUndo.get("beta-open")).toBeNull();
  });

  it("WHEN 되돌리는 쓰기와 남긴 판 지우기 사이에 새 AI 저장이 판을 남기면 THEN 새 판은 지워지지 않는다", async () => {
    const inner = createMemoryPostStore();
    const env = setup(inner);
    const aiRevision = await aiEdited(env);
    const newer = { before: null, after: "newer-ai-revision" };
    const racing: PostStore = {
      ...inner,
      async put(slug, file, revision) {
        const saved = await inner.put(slug, file, revision);
        await env.aiUndo.put(slug, newer);
        return saved;
      },
    };

    const result = await revertAiEdit(racing, env.aiUndo, "beta-open", aiRevision);

    expect(result.ok).toBe(true);
    expect(await env.aiUndo.get("beta-open")).toEqual(newer);
  });
});
