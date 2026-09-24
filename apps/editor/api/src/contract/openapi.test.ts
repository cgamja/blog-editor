import { readFile } from "node:fs/promises";
import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { createApp } from "../app";
import { createMemoryImageStore } from "../memory-image-store";
import { createMemoryPostStore } from "../memory-store";
import { SESSION_COOKIE_NAME } from "../session";
import { pngBytes, svgBytes } from "../images.test.helpers";
import { TEST_ACCOUNT, loginRequest, testAuthOptions, withSession } from "../test-app.test.helpers";
import { buildOpenApiDocument, contractOperations } from "./openapi";
import type { HttpMethod } from "./openapi";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const OPENAPI_FILE = new URL("../../../../../api/openapi.json", import.meta.url);
const MIB = 1024 * 1024;
// Hono가 app.use 미들웨어를 이 메서드로 적는다 — 라우트가 아니다
const MIDDLEWARE_METHOD = "ALL";

function setup() {
  const store = createMemoryPostStore();
  const app = createApp({
    store,
    categories: CATEGORIES,
    imageBaseUrl: "https://example.com",
    images: createMemoryImageStore(),
    ...testAuthOptions,
  });
  return { store, app, client: withSession(app) };
}

// 테스트마다 부른다 — 모듈 최상위에서 부르면 계약 표가 깨졌을 때 테스트가 하나도 모이지 않는다
const operationsOf = () => contractOperations({ categories: CATEGORIES });

/** 상태 코드가 계약에 선언돼 있고 본문이 그 상태의 스키마(또는 Content-Type)를 따르는지 */
async function expectConforms(method: HttpMethod, path: string, res: Response) {
  const operation = operationsOf().find((op) => op.method === method && op.path === path);
  if (operation === undefined) throw new Error(`계약에 없는 연산: ${method} ${path}`);
  const declared = operation.responses[res.status];
  if (declared === undefined) throw new Error(`계약에 없는 상태: ${method} ${path} ${res.status}`);
  for (const header of Object.keys(declared.headers ?? {})) {
    expect(res.headers.get(header), `${method} ${path} ${res.status} ${header}`).not.toBeNull();
  }
  if (declared.schema !== undefined) {
    expect(res.headers.get("content-type")).toContain("application/json");
    const parsed = declared.schema.safeParse(await res.json());
    expect(parsed.success, `${method} ${path} ${res.status} ${JSON.stringify(parsed.error)}`).toBe(
      true,
    );
  } else if (declared.contentTypePrefix !== undefined) {
    expect(res.headers.get("content-type")).toMatch(new RegExp(`^${declared.contentTypePrefix}`));
  } else if (declared.contentType !== undefined) {
    expect(res.headers.get("content-type")).toContain(declared.contentType);
  } else {
    expect(await res.text()).toBe("");
  }
}

function withTitle(file: PostFile, title: string): PostFile {
  return { ...file, meta: { ...file.meta, title } };
}

function jsonPut(body: unknown, headers: Record<string, string>): RequestInit {
  return {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

describe("api-contract — 계약 파일", () => {
  it("WHEN 계약 스키마 표로 문서를 다시 만들면 THEN 커밋된 api/openapi.json과 깊이 같다", async () => {
    const committed: unknown = JSON.parse(await readFile(OPENAPI_FILE, "utf8"));
    expect(buildOpenApiDocument()).toEqual(committed);
  });

  it("WHEN 이미지 저장소를 켠 앱의 라우트를 모으면 THEN {메서드, 경로} 집합이 계약의 것과 같다", () => {
    const { app } = setup();
    const routes = new Set(
      app.routes
        .filter((route) => route.method !== MIDDLEWARE_METHOD)
        .map((route) => `${route.method.toLowerCase()} ${route.path.replace(/:(\w+)/g, "{$1}")}`),
    );
    const declared = new Set(operationsOf().map((op) => `${op.method} ${op.path}`));
    expect([...routes].sort()).toEqual([...declared].sort());
  });
});

describe("api-contract — 응답 적합성", () => {
  it("WHEN 맞는 계정 · 틀린 비밀번호 · 빠진 필드 · JSON 아닌 본문으로 로그인하고 로그아웃하면 THEN 204 · 401 · 400 · 400 · 204이고 계약을 따른다", async () => {
    const { app } = setup();
    const path = "/api/session";

    const ok = await loginRequest(app, TEST_ACCOUNT.username, TEST_ACCOUNT.password);
    expect(ok.status).toBe(204);
    // 계약의 쿠키 이름이 핸들러가 실제로 심는 쿠키와 같다
    expect(ok.headers.get("Set-Cookie")).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=`));
    await expectConforms("post", path, ok);

    const wrong = await loginRequest(app, TEST_ACCOUNT.username, "wrong-password");
    expect(wrong.status).toBe(401);
    await expectConforms("post", path, wrong);

    const missing = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: TEST_ACCOUNT.username }),
    });
    expect(missing.status).toBe(400);
    await expectConforms("post", path, missing);

    const notJson = await app.request(path, { method: "POST", body: "{" });
    expect(notJson.status).toBe(400);
    await expectConforms("post", path, notJson);

    const logout = await app.request(path, { method: "DELETE" });
    expect(logout.status).toBe(204);
    await expectConforms("delete", path, logout);
  });

  it("WHEN 글을 세션 없이 · 새로 · 고쳐 · 낡게 · 조건 없이 · 스키마 위반으로 저장하고 읽으면 THEN 선언된 상태와 스키마를 따른다", async () => {
    const { app, client } = setup();
    const post = "/api/posts/{slug}";

    const anonymous = await app.request("/api/posts");
    expect(anonymous.status).toBe(401);
    await expectConforms("get", "/api/posts", anonymous);

    const created = await client.request(
      "/api/posts/hello",
      jsonPut(fixtures.minimal, { "If-None-Match": "*" }),
    );
    expect(created.status).toBe(201);
    const etag = created.headers.get("ETag") ?? "";
    await expectConforms("put", post, created);

    const updated = await client.request(
      "/api/posts/hello",
      jsonPut(withTitle(fixtures.minimal, "고친 제목"), { "If-Match": etag }),
    );
    expect(updated.status).toBe(200);
    await expectConforms("put", post, updated);

    const stale = await client.request(
      "/api/posts/hello",
      jsonPut(withTitle(fixtures.minimal, "낡은 저장"), { "If-Match": etag }),
    );
    expect(stale.status).toBe(409);
    await expectConforms("put", post, stale);

    const noPrecondition = await client.request("/api/posts/hello", jsonPut(fixtures.minimal, {}));
    expect(noPrecondition.status).toBe(428);
    await expectConforms("put", post, noPrecondition);

    const invalid = await client.request("/api/posts/other", jsonPut({}, { "If-None-Match": "*" }));
    expect(invalid.status).toBe(400);
    await expectConforms("put", post, invalid);

    const notJson = await client.request("/api/posts/other", {
      method: "PUT",
      headers: { "content-type": "application/json", "If-None-Match": "*" },
      body: "{",
    });
    expect(notJson.status).toBe(400);
    await expectConforms("put", post, notJson);

    const putBadSlug = await client.request(
      "/api/posts/Bad_Slug",
      jsonPut(fixtures.minimal, { "If-None-Match": "*" }),
    );
    expect(putBadSlug.status).toBe(400);
    await expectConforms("put", post, putBadSlug);

    const exists = await client.request(
      "/api/posts/hello",
      jsonPut(fixtures.minimal, { "If-None-Match": "*" }),
    );
    expect(exists.status).toBe(409);
    await expectConforms("put", post, exists);

    const editMissing = await client.request(
      "/api/posts/nothing-here",
      jsonPut(fixtures.minimal, { "If-Match": etag }),
    );
    expect(editMissing.status).toBe(409);
    await expectConforms("put", post, editMissing);

    const missing = await client.request("/api/posts/nothing-here");
    expect(missing.status).toBe(404);
    await expectConforms("get", post, missing);

    const badSlug = await client.request("/api/posts/Bad_Slug");
    expect(badSlug.status).toBe(400);
    await expectConforms("get", post, badSlug);

    const list = await client.request("/api/posts");
    expect(list.status).toBe(200);
    await expectConforms("get", "/api/posts", list);

    const read = await client.request("/api/posts/hello");
    expect(read.status).toBe(200);
    await expectConforms("get", post, read);
  });

  it("WHEN 이미지를 올리고 받고, 공개 목록과 본문 CSS를 받으면 THEN 선언된 상태와 스키마 · Content-Type을 따른다", async () => {
    const { store, app, client } = setup();
    const upload = (bytes: Uint8Array) =>
      client.request("/api/images", { method: "POST", body: bytes });

    const anonymous = await app.request("/api/images", {
      method: "POST",
      body: pngBytes(800, 600),
    });
    expect(anonymous.status).toBe(401);
    await expectConforms("post", "/api/images", anonymous);

    const first = await upload(pngBytes(800, 600));
    expect(first.status).toBe(201);
    const { path: imagePath } = (await first.clone().json()) as { path: string };
    await expectConforms("post", "/api/images", first);

    const again = await upload(pngBytes(800, 600));
    expect(again.status).toBe(200);
    await expectConforms("post", "/api/images", again);

    const svg = await upload(svgBytes());
    expect(svg.status).toBe(415);
    await expectConforms("post", "/api/images", svg);

    const large = await upload(pngBytes(800, 600, MIB + 1));
    expect(large.status).toBe(413);
    await expectConforms("post", "/api/images", large);

    const wide = await upload(pngBytes(1601, 10));
    expect(wide.status).toBe(422);
    await expectConforms("post", "/api/images", wide);

    const image = await app.request(imagePath);
    expect(image.status).toBe(200);
    await expectConforms("get", "/images/{name}", image);

    const noImage = await app.request(`/images/${"0".repeat(32)}.png`);
    expect(noImage.status).toBe(404);
    await expectConforms("get", "/images/{name}", noImage);

    await store.put(
      "open",
      { ...fixtures.minimal, meta: { ...fixtures.minimal.meta, draft: false } },
      null,
    );
    const publicPosts = await app.request("/public/posts");
    expect(publicPosts.status).toBe(200);
    await expectConforms("get", "/public/posts", publicPosts);

    const css = await app.request("/public/post.css");
    expect(css.status).toBe(200);
    await expectConforms("get", "/public/post.css", css);
  });
});
