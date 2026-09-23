import { fixtures, normalize } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { createApp } from "./app";
import { createMemoryPostStore } from "./memory-store";
import { testAuthOptions, withSession } from "./test-app";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;

function setup() {
  const store = createMemoryPostStore();
  const app = createApp({
    store,
    categories: CATEGORIES,
    imageBaseUrl: "https://simsimeestudio.com",
    ...testAuthOptions,
  });
  // /api/*는 세션이 필요하다(api-session) — 모든 요청이 로그인한 쿠키를 싣는다
  return { store, app: withSession(app) };
}

function putPost(
  app: ReturnType<typeof setup>["app"],
  slug: string,
  body: unknown,
  headers: Record<string, string>,
) {
  return app.request(`/api/posts/${slug}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function published(file: PostFile): PostFile {
  return { ...file, meta: { ...file.meta, draft: false } };
}

function withTitle(file: PostFile, title: string): PostFile {
  return { ...file, meta: { ...file.meta, title } };
}

describe("posts-api — 목록 · 조회", () => {
  it("WHEN 초안 하나와 발행 글 둘을 저장하고 목록을 부르면 THEN 셋이 date 최신순이고 초안은 draft true다", async () => {
    const { store, app } = setup();
    await store.put("beta-open", fixtures.minimal, null); // 2026-01-15 초안
    await store.put("feature-tour", published(fixtures.allBlocks), null); // 2026-02-03
    await store.put("decoration-max", published(fixtures.decorationMax), null); // 2026-03-10

    const res = await app.request("/api/posts");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { posts: Array<Record<string, unknown>> };
    expect(body.posts.map((p) => p.slug)).toEqual(["decoration-max", "feature-tour", "beta-open"]);
    expect(body.posts[2]).toMatchObject({
      slug: "beta-open",
      title: fixtures.minimal.meta.title,
      date: "2026-01-15",
      category: "studio",
      draft: true,
      source: "editor",
    });
    expect(body.posts[2]).not.toHaveProperty("doc");
  });

  it("WHEN 저장된 글 · 없는 slug · 잘못된 slug를 조회하면 THEN 200+ETag · 404 · 400이다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("beta-open", fixtures.minimal, null);

    const found = await app.request("/api/posts/beta-open");
    const missing = await app.request("/api/posts/never-written");
    const invalid = await app.request("/api/posts/Bad..Slug");

    expect(found.status).toBe(200);
    expect(found.headers.get("ETag")).toBe(`"${revision}"`);
    expect(await found.json()).toEqual(fixtures.minimal);
    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });
});

describe("posts-api — 조건부 저장 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN If-None-Match:*로 만들고 받은 ETag로 고치면 THEN 201 · 200이고 ETag가 바뀌며 조회에 반영된다", async () => {
    const { app } = setup();

    const created = await putPost(app, "beta-open", fixtures.minimal, { "If-None-Match": "*" });
    const etag1 = created.headers.get("ETag");
    const updated = await putPost(app, "beta-open", withTitle(fixtures.minimal, "고친 제목"), {
      "If-Match": etag1 ?? "",
    });
    const etag2 = updated.headers.get("ETag");

    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(etag1).toMatch(/^".+"$/);
    expect(etag2).toMatch(/^".+"$/);
    expect(etag2).not.toBe(etag1);
    const fetched = (await (await app.request("/api/posts/beta-open")).json()) as PostFile;
    expect(fetched.meta.title).toBe("고친 제목");
  });

  it("WHEN 낡은 ETag · 있는 slug에 If-None-Match:* · 조건 없음으로 PUT하면 THEN 409 · 409 · 428이고 글은 그대로다", async () => {
    const { app } = setup();
    const created = await putPost(app, "beta-open", fixtures.minimal, { "If-None-Match": "*" });
    const staleEtag = created.headers.get("ETag") ?? "";
    await putPost(app, "beta-open", withTitle(fixtures.minimal, "다른 곳에서 고침"), {
      "If-Match": staleEtag,
    });
    const late = withTitle(fixtures.minimal, "늦은 저장");

    const stale = await putPost(app, "beta-open", late, { "If-Match": staleEtag });
    const recreate = await putPost(app, "beta-open", late, { "If-None-Match": "*" });
    const unconditional = await putPost(app, "beta-open", late, {});

    expect(stale.status).toBe(409);
    expect(recreate.status).toBe(409);
    expect(unconditional.status).toBe(428);
    const fetched = (await (await app.request("/api/posts/beta-open")).json()) as PostFile;
    expect(fetched.meta.title).toBe("다른 곳에서 고침");
  });
});

describe("posts-api — 검증 · 정규화", () => {
  it("WHEN javascript: 링크가 든 글을 PUT하면 THEN 400이고 이슈 경로에 href가 있으며 저장되지 않는다", async () => {
    const { app } = setup();
    const evil = {
      ...fixtures.minimal,
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "눌러 보세요",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        ],
      },
    };

    const res = await putPost(app, "evil-link", evil, { "If-None-Match": "*" });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: Array<{ path: Array<string | number> }> };
    expect(body.issues.some((issue) => issue.path.includes("href"))).toBe(true);
    expect((await app.request("/api/posts/evil-link")).status).toBe(404);
  });

  it("WHEN 인접 텍스트가 나뉜 문단을 PUT하고 조회하면 THEN normalize를 거친 문서다", async () => {
    const { app } = setup();
    const split: PostFile = {
      ...fixtures.minimal,
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "안녕" },
              { type: "text", text: "하세요" },
            ],
          },
        ],
      },
    };

    await putPost(app, "split-text", split, { "If-None-Match": "*" });
    const fetched = (await (await app.request("/api/posts/split-text")).json()) as PostFile;

    expect(fetched.doc).toEqual(normalize(split.doc));
    expect(fetched.doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "안녕하세요" }],
    });
  });
});
