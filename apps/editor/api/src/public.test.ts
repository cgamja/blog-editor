import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPublicPostsResponseSchema, fixtures } from "@blog-editor/content-schema";
import type { Fixtures, PostFile } from "@blog-editor/content-schema";
import { createApp } from "./app";
import { createMemoryPostStore } from "./memory-store";

// 사이트 BLOG_CATEGORIES와 같은 목록 — 계약 픽스처의 category가 사이트 enum 안에 있어야 한다
const SITE_CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const CONTRACT_SLUGS: Record<keyof Fixtures, string> = {
  minimal: "beta-open",
  allBlocks: "feature-tour",
  decorationMax: "decoration-max",
};
const CONTRACT_DIR = "../../../../contract/public-api/public";
const IMAGE_BASE_URL = "https://simsimeestudio.com";

function setup() {
  const store = createMemoryPostStore();
  const app = createApp({ store, categories: SITE_CATEGORIES, imageBaseUrl: IMAGE_BASE_URL });
  return { store, app };
}

function published(file: PostFile): PostFile {
  return { ...file, meta: { ...file.meta, draft: false } };
}

describe("public-posts-api — 초안 없음 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it("WHEN 발행 글 하나와 초안 하나를 저장하고 공개 조회하면 THEN 발행 글만 있고 응답이 공개 스키마를 통과한다", async () => {
    const { store, app } = setup();
    await store.put("feature-tour", published(fixtures.allBlocks), null);
    await store.put("draft-post", fixtures.minimal, null);

    const res = await app.request("/public/posts");

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    const body = await res.json();
    createPublicPostsResponseSchema({ categories: SITE_CATEGORIES }).parse(body);
    expect((body as { posts: Array<{ slug: string }> }).posts.map((p) => p.slug)).toEqual([
      "feature-tour",
    ]);
  });
});

describe("public-posts-api — 초안 없음: 저장소가 검증 없이 돌려준 파일 (리뷰 재현)", () => {
  it("WHEN 저장된 파일의 meta.draft가 빠져 있으면 THEN 발행 글로 보지 않고 공개 조회에 없다", async () => {
    const { store, app } = setup();
    const metaWithoutDraft: Record<string, unknown> = { ...fixtures.minimal.meta };
    delete metaWithoutDraft.draft;
    // 손으로 고친 파일처럼 저장소가 스키마 밖 모양을 돌려주는 경우 — 저장소는 읽을 때 검증하지 않는다
    await store.put(
      "no-draft-field",
      { ...fixtures.minimal, meta: metaWithoutDraft } as PostFile,
      null,
    );

    const res = await app.request("/public/posts");

    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ postCssUrl: "/public/post.css", posts: [] });
  });
});

describe("public-posts-contract — 핸들러 출력이 계약 픽스처다", () => {
  // 계약 픽스처를 다시 만드는 법은 contract/public-api/README.md — 손으로 고치지 않는다
  it("WHEN 대표 픽스처 3개를 계약 slug로 발행해 공개 조회하면 THEN 응답 · post.css가 계약 픽스처와 같다", async () => {
    const { store, app } = setup();
    for (const name of Object.keys(CONTRACT_SLUGS) as (keyof Fixtures)[]) {
      await store.put(CONTRACT_SLUGS[name], published(fixtures[name]), null);
    }

    const body = await (await app.request("/public/posts")).json();
    const css = await (await app.request("/public/post.css")).text();

    await expect(`${JSON.stringify(body, null, 2)}\n`).toMatchFileSnapshot(`${CONTRACT_DIR}/posts`);
    await expect(css).toMatchFileSnapshot(`${CONTRACT_DIR}/post.css`);
  });
});

describe("public-posts-api — 본문용 CSS", () => {
  it("WHEN 공개 응답의 postCssUrl을 GET하면 THEN text/css로 content-render의 post.css를 준다", async () => {
    const { app } = setup();
    const { postCssUrl } = (await (await app.request("/public/posts")).json()) as {
      postCssUrl: string;
    };

    const res = await app.request(postCssUrl);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/css/);
    const cssPath = fileURLToPath(import.meta.resolve("@blog-editor/content-render/post.css"));
    expect(await res.text()).toBe(readFileSync(cssPath, "utf8"));
  });
});
