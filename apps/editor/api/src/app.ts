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
import type { PostFile } from "@blog-editor/content-schema";
import { renderHtml } from "@blog-editor/content-render";
import {
  BODY_NOT_JSON_MESSAGE,
  CONFLICT_MESSAGE,
  INVALID_SLUG_MESSAGE,
  POST_NOT_FOUND_MESSAGE,
  PRECONDITION_REQUIRED_MESSAGE,
  SCHEMA_MISMATCH_MESSAGE,
} from "./messages";
import { registerSessionRoutes, requireSession, resolveSessionConfig } from "./session";
import type { SessionOptions } from "./session";
import { registerMcpRoute } from "./mcp/route";
import type { McpOptions } from "./mcp/route";
import { ConflictError } from "./store";
import type { PostStore } from "./store";
import type { ImageStore } from "./image-store";
import { registerImageRoutes } from "./images";

export interface AppOptions extends SessionOptions {
  store: PostStore;
  /** 워크스페이스 설정의 카테고리 목록 — 저장 검증과 공개 응답이 같은 것을 쓴다 */
  categories: readonly [string, ...string[]];
  /** 저장된 이미지 경로 앞에 붙는 주소(plan 3-8) */
  imageBaseUrl: string;
  /** 연결용 토큰이 있을 때만 `/mcp`를 연다(mcp-auth) — 없으면 그 경로가 없다 */
  mcp?: McpOptions;
  /** 있을 때만 이미지 올리기 · 받기를 연다(ADR-021) — 없으면 두 경로가 없다 */
  images?: ImageStore;
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
  return c.json({ message: INVALID_SLUG_MESSAGE }, 400);
}

export function createApp(options: AppOptions): Hono {
  const { store, categories, imageBaseUrl } = options;
  const postFileSchema = createPostFileSchema({ categories });
  const publicResponseSchema = createPublicPostsResponseSchema({ categories });
  const postCss = readPostCss();
  const session = resolveSessionConfig(options);
  const app = new Hono();
  app.use("/api/*", requireSession(session));
  registerSessionRoutes(app, session);

  app.get("/api/posts", async (c) => {
    const summaries = (await store.list()).map(({ slug, meta }) => summaryOf(slug, meta));
    return c.json({ posts: summaries.sort((a, b) => byDate(b, a)) });
  });

  app.get("/api/posts/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!slugSchema.safeParse(slug).success) return invalidSlug(c);
    const found = await store.get(slug);
    if (found === null) return c.json({ message: POST_NOT_FOUND_MESSAGE }, 404);
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
      return c.json({ message: PRECONDITION_REQUIRED_MESSAGE }, 428);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: BODY_NOT_JSON_MESSAGE, issues: [] }, 400);
    }
    const parsed = postFileSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(({ path, message }) => ({
        path: path.map((key) => (typeof key === "symbol" ? String(key) : key)),
        message,
      }));
      return c.json({ message: SCHEMA_MISMATCH_MESSAGE, issues }, 400);
    }

    const file: PostFile = { ...parsed.data, doc: normalize(parsed.data.doc) };
    try {
      const { revision } = await store.put(slug, file, expected);
      c.header("ETag", etagOf(revision));
      return c.json({ revision }, expected === null ? 201 : 200);
    } catch (error) {
      if (error instanceof ConflictError) {
        return c.json({ message: CONFLICT_MESSAGE }, 409);
      }
      throw error;
    }
  });

  app.get("/public/posts", async (c) => {
    // 저장소는 읽을 때 검증하지 않는다 — `false`로 적힌 글만 발행 글이다(빠진 값 · null은 초안 취급)
    const publishedSlugs = (await store.list())
      .filter(({ meta }) => meta.draft === false)
      .map(({ slug }) => slug);
    // 모양은 아래 계약 재검사가 확정한다 — 여기서 공개 응답 타입으로 좁히면 draft를 false로 단정하게 된다
    const posts: Array<{ slug: string; date: string; [field: string]: unknown }> = [];
    for (const slug of publishedSlugs) {
      const found = await store.get(slug);
      // 목록과 읽기 사이에 초안으로 돌아간 글도 거른다
      if (found === null || found.file.meta.draft !== false) continue;
      const { title, description, date, updated, category, draft, image } = found.file.meta;
      posts.push({
        slug,
        title,
        description,
        date,
        ...(updated === undefined ? {} : { updated }),
        category,
        // 실제 값을 넘긴다 — 아래 계약 재검사(`draft: z.literal(false)`)가 이 값을 본다
        draft,
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

  if (options.images !== undefined) registerImageRoutes(app, options.images);

  if (options.mcp !== undefined) {
    registerMcpRoute(app, { ...options.mcp, store, categories, session });
  }

  return app;
}
