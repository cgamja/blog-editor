import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  createPostFileSchema,
  createPublicPostsResponseSchema,
  normalize,
  slugSchema,
} from "@blog-editor/content-schema";
import type { PostFile, PublicPostsResponse } from "@blog-editor/content-schema";
import { renderHtml } from "@blog-editor/content-render";
import { ConflictError } from "./store";
import type { PostStore } from "./store";

export interface AppOptions {
  store: PostStore;
  /** 워크스페이스 설정의 카테고리 목록 — 저장 검증과 공개 응답이 같은 것을 쓴다 */
  categories: readonly [string, ...string[]];
  /** 저장된 이미지 경로 앞에 붙는 주소(plan 3-8) */
  imageBaseUrl: string;
}

/** 사이트 빌드가 부르는 공개 조회의 짧은 캐시(plan 3-6) */
const PUBLIC_CACHE_CONTROL = "public, max-age=60";
const POST_CSS_PATH = "/public/post.css";

function readPostCss(): string {
  const path = fileURLToPath(import.meta.resolve("@blog-editor/content-render/post.css"));
  return readFileSync(path, "utf8");
}

const etagOf = (revision: string) => `"${revision}"`;

/** `If-Match: "<revision>"`에서 revision을 꺼낸다. 모양이 다르면 어떤 revision과도 맞지 않는 값이 된다. */
function revisionFromEtag(etag: string): string {
  const match = /^"([^"]*)"$/.exec(etag.trim());
  return match?.[1] ?? etag;
}

function byDate(a: { date: string; slug: string }, b: { date: string; slug: string }): number {
  return a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug);
}

function summaryOf(slug: string, meta: PostFile["meta"]) {
  const { title, date, updated, category, draft, source } = meta;
  return {
    slug,
    title,
    date,
    ...(updated === undefined ? {} : { updated }),
    category,
    draft,
    source,
  };
}

function invalidSlug(c: Context) {
  return c.json({ message: "slug는 소문자·숫자·하이픈만" }, 400);
}

export function createApp(options: AppOptions): Hono {
  const { store, categories, imageBaseUrl } = options;
  const postFileSchema = createPostFileSchema({ categories });
  const publicResponseSchema = createPublicPostsResponseSchema({ categories });
  const postCss = readPostCss();
  const app = new Hono();

  app.get("/api/posts", async (c) => {
    const summaries = (await store.list()).map(({ slug, meta }) => summaryOf(slug, meta));
    return c.json({ posts: summaries.sort((a, b) => byDate(b, a)) });
  });

  app.get("/api/posts/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!slugSchema.safeParse(slug).success) return invalidSlug(c);
    const found = await store.get(slug);
    if (found === null) return c.json({ message: "글이 없다" }, 404);
    c.header("ETag", etagOf(found.revision));
    return c.json(found.file);
  });

  app.put("/api/posts/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!slugSchema.safeParse(slug).success) return invalidSlug(c);

    const ifNoneMatch = c.req.header("If-None-Match");
    const ifMatch = c.req.header("If-Match");
    let expected: string | null;
    if (ifNoneMatch === "*") expected = null;
    else if (ifMatch !== undefined) expected = revisionFromEtag(ifMatch);
    else {
      return c.json(
        { message: "새 글은 If-None-Match: *, 고치기는 If-Match: <ETag>가 필요하다" },
        428,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "본문이 JSON이 아니다", issues: [] }, 400);
    }
    const parsed = postFileSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(({ path, message }) => ({
        path: path.map((key) => (typeof key === "symbol" ? String(key) : key)),
        message,
      }));
      return c.json({ message: "문서가 스키마에 맞지 않는다", issues }, 400);
    }

    const file: PostFile = { ...parsed.data, doc: normalize(parsed.data.doc) };
    try {
      const { revision } = await store.put(slug, file, expected);
      c.header("ETag", etagOf(revision));
      return c.json({ revision }, expected === null ? 201 : 200);
    } catch (error) {
      if (error instanceof ConflictError) {
        return c.json({ message: "다른 곳에서 수정됐다 — 다시 불러온 뒤 저장한다" }, 409);
      }
      throw error;
    }
  });

  app.get("/public/posts", async (c) => {
    const publishedSlugs = (await store.list())
      .filter(({ meta }) => !meta.draft)
      .map(({ slug }) => slug);
    const posts: PublicPostsResponse["posts"] = [];
    for (const slug of publishedSlugs) {
      const found = await store.get(slug);
      // 목록과 읽기 사이에 초안으로 돌아간 글도 거른다
      if (found === null || found.file.meta.draft) continue;
      const { title, description, date, updated, category, image } = found.file.meta;
      posts.push({
        slug,
        title,
        description,
        date,
        ...(updated === undefined ? {} : { updated }),
        category,
        draft: false,
        ...(image === undefined ? {} : { image: new URL(image, imageBaseUrl).href }),
        html: renderHtml(found.file, { imageBaseUrl }),
      });
    }
    // 보호 대상 — 나가기 전에 계약으로 한 번 더 검사한다. 초안이 섞이면 응답 대신 500이다
    const response = publicResponseSchema.parse({
      postCssUrl: POST_CSS_PATH,
      posts: posts.sort(byDate),
    });
    c.header("Cache-Control", PUBLIC_CACHE_CONTROL);
    return c.json(response);
  });

  app.get(POST_CSS_PATH, (c) => {
    c.header("Cache-Control", PUBLIC_CACHE_CONTROL);
    return c.body(postCss, 200, { "Content-Type": "text/css; charset=utf-8" });
  });

  return app;
}
