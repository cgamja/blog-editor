import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { createApp } from "./app";
import { createMemoryPostStore } from "./memory-store";
import type { SiteRebuildState } from "./site-rebuild-store";
import type { SiteRebuild } from "./site-rebuild-types";
import { testAuthOptions, withSession } from "./test-app.test.helpers";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const FAILED: SiteRebuildState = {
  status: "failed",
  requestId: "request-1",
  updatedAt: "2026-09-29T01:00:30.000Z",
};
const SENT: SiteRebuildState = {
  status: "sent",
  requestId: "request-2",
  updatedAt: "2026-09-29T01:01:00.000Z",
};

/** 재빌드는 앱 밖의 경계(훅 · 묶음 대기)라 가짜로 끼우고 앱이 언제 부르는지만 본다 */
function setup() {
  const store = createMemoryPostStore();
  const siteRebuild = {
    request: vi.fn<SiteRebuild["request"]>(async () => {}),
    retry: vi.fn<SiteRebuild["retry"]>(async () => SENT),
    status: vi.fn<SiteRebuild["status"]>(async () => FAILED),
  };
  const app = createApp({
    store,
    categories: CATEGORIES,
    imageBaseUrl: "https://simsimeestudio.com",
    siteRebuild,
    ...testAuthOptions,
  });
  return { store, siteRebuild, bare: app, app: withSession(app) };
}

function published(file: PostFile): PostFile {
  return { ...file, meta: { ...file.meta, draft: false } };
}

function withTitle(file: PostFile, title: string): PostFile {
  return { ...file, meta: { ...file.meta, title } };
}

function putPost(app: ReturnType<typeof setup>["app"], file: PostFile, revision: string) {
  return app.request("/api/posts/beta-open", {
    method: "PUT",
    headers: { "content-type": "application/json", "If-Match": `"${revision}"` },
    body: JSON.stringify(file),
  });
}

describe("site-rebuild — 저장이 재빌드를 부르는 때", () => {
  it("WHEN 초안을 draft: false로 저장하면 THEN 저장은 200이고 재빌드가 요청된다", async () => {
    const { store, siteRebuild, app } = setup();
    const { revision } = await store.put("beta-open", fixtures.minimal, null);

    const res = await putPost(app, published(fixtures.minimal), revision);

    expect(res.status).toBe(200);
    expect(siteRebuild.request).toHaveBeenCalledTimes(1);
  });

  it("WHEN 재빌드 요청이 거부돼도 draft: false로 저장하면 THEN 저장은 200이다", async () => {
    const { store, siteRebuild, app } = setup();
    siteRebuild.request.mockRejectedValue(new Error("site_rebuilds 쓰기 실패"));
    const { revision } = await store.put("beta-open", fixtures.minimal, null);

    const res = await putPost(app, published(fixtures.minimal), revision);

    expect(res.status).toBe(200);
  });

  it("WHEN 초안을 draft: true로 다시 저장하면 THEN 재빌드 요청이 없다", async () => {
    const { store, siteRebuild, app } = setup();
    const { revision } = await store.put("beta-open", fixtures.minimal, null);

    const res = await putPost(app, withTitle(fixtures.minimal, "고친 초안 제목"), revision);

    expect(res.status).toBe(200);
    expect(siteRebuild.request).not.toHaveBeenCalled();
  });

  it("WHEN 발행 글을 draft: true로 저장하면 THEN 재빌드가 요청된다", async () => {
    const { store, siteRebuild, app } = setup();
    const { revision } = await store.put("beta-open", published(fixtures.minimal), null);

    const res = await putPost(app, fixtures.minimal, revision);

    expect(res.status).toBe(200);
    expect(siteRebuild.request).toHaveBeenCalledTimes(1);
  });
});

describe("site-rebuild — 상태 · 다시 시도 경로", () => {
  // 세션이 없으면 /api/* 전부가 401이라 401만으로는 경로가 없어도 통과한다 — 세션이 있을 때 상태가 나오는 것까지 본다
  it("WHEN 세션 없이 GET /api/site-rebuild를 부르면 THEN 401이고, 세션이 있으면 200과 상태다", async () => {
    const { bare, app } = setup();

    const anonymous = await bare.request("/api/site-rebuild");
    const signedIn = await app.request("/api/site-rebuild");

    expect(anonymous.status).toBe(401);
    expect(signedIn.status).toBe(200);
    expect(await signedIn.json()).toEqual({ status: "failed", updatedAt: FAILED.updatedAt });
  });

  // 화면의 "다시 시도"는 e2e에서 네트워크 경계로 가짜라 — 이 경로가 retry로 이어지는 것은 여기서만 잡힌다
  it("WHEN 세션으로 POST /api/site-rebuild를 부르면 THEN 다시 시도한 결과 상태를 준다", async () => {
    const { siteRebuild, app } = setup();

    const res = await app.request("/api/site-rebuild", { method: "POST" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "sent", updatedAt: SENT.updatedAt });
    expect(siteRebuild.retry).toHaveBeenCalledTimes(1);
  });
});
