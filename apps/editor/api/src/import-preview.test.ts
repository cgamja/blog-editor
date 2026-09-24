import { docSchema } from "@blog-editor/content-schema";
import { createApp } from "./app";
import { MAX_MARKDOWN_LENGTH } from "./input-limits";
import { createMemoryPostStore } from "./memory-store";
import { testAuthOptions, withSession } from "./test-app.test.helpers";

const PATH = "/api/import/preview";

function setup() {
  const store = createMemoryPostStore();
  const app = createApp({
    store,
    categories: ["studio"],
    imageBaseUrl: "https://example.com",
    ...testAuthOptions,
  });
  return { store, client: withSession(app) };
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("import-preview-api — 변환 결과만 돌려주고 저장하지 않는다", () => {
  it("WHEN 제목 블록과 문단이 있는 markdown이면 THEN ok · 정규형 doc · 렌더 HTML · 첫 제목 · 첫 문단 제안이고 저장소는 비어 있다", async () => {
    const { store, client } = setup();
    const markdown = "## 수면 기록\n\n밤잠이 길어지고 있어요.\n\n두 번째 문단.";

    const res = await client.request(PATH, postJson({ markdown }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(docSchema.safeParse(body.doc).success).toBe(true);
    expect(body.html).toContain("밤잠이 길어지고 있어요.");
    expect(body.suggested).toEqual({ title: "수면 기록", description: "밤잠이 길어지고 있어요." });
    expect(await store.list()).toEqual([]);
  });

  it("WHEN 표가 든 markdown이면 THEN ok가 false이고 메시지에 그 줄 번호가 있으며 저장소는 비어 있다", async () => {
    const { store, client } = setup();
    const markdown = "첫 문단\n\n| 표 | 빠짐 |\n| --- | --- |\n| a | b |";

    const res = await client.request(PATH, postJson({ markdown }));
    const body = (await res.json()) as { ok: boolean; messages: string[] };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.messages.join("\n")).toContain("3줄");
    expect(await store.list()).toEqual([]);
  });

  it("WHEN JSON 아닌 본문 · markdown 없는 본문 · 상한보다 긴 markdown이면 THEN 모두 400이다", async () => {
    const { client } = setup();

    const notJson = await client.request(PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const missing = await client.request(PATH, postJson({}));
    const tooLong = await client.request(
      PATH,
      postJson({ markdown: "가".repeat(MAX_MARKDOWN_LENGTH + 1) }),
    );

    expect([notJson.status, missing.status, tooLong.status]).toEqual([400, 400, 400]);
  });
});
