import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { createApp } from "./app";
import { createMemoryPostStore } from "./memory-store";
import { testAuthOptions, withSession } from "./test-app.test.helpers";

function setup() {
  const store = createMemoryPostStore();
  const app = createApp({
    store,
    categories: ["studio", "parenting", "parenting-assistant"],
    imageBaseUrl: "https://simsimeestudio.com",
    ...testAuthOptions,
  });
  return { store, app: withSession(app) };
}

function rename(
  app: ReturnType<typeof setup>["app"],
  slug: string,
  to: string,
  headers: Record<string, string>,
) {
  return app.request(`/api/posts/${slug}/rename`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ to }),
  });
}

function published(file: PostFile): PostFile {
  return { ...file, meta: { ...file.meta, draft: false } };
}

describe("post-rename-api — 초안 주소 바꾸기", () => {
  it("WHEN 초안을 받은 ETag로 new-home으로 옮기면 THEN 200이고 새 주소에 같은 글, 옛 주소는 404다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("beta-open", fixtures.minimal, null);

    const res = await rename(app, "beta-open", "new-home", { "If-Match": `"${revision}"` });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string; revision: string };
    expect(body.slug).toBe("new-home");
    expect(res.headers.get("ETag")).toBe(`"${body.revision}"`);
    expect(await store.get("new-home")).toEqual({
      file: fixtures.minimal,
      revision: body.revision,
    });
    expect((await app.request("/api/posts/beta-open")).status).toBe(404);
  });

  it("WHEN 발행 글의 주소를 바꾸려 하면 THEN 409이고 두 주소 모두 그대로다", async () => {
    const { store, app } = setup();
    const file = published(fixtures.minimal);
    const { revision } = await store.put("beta-open", file, null);

    const res = await rename(app, "beta-open", "new-home", { "If-Match": `"${revision}"` });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: "published" });
    expect(await store.get("beta-open")).toEqual({ file, revision });
    expect(await store.get("new-home")).toBeNull();
  });

  it("WHEN 낡은 ETag로, 다른 글이 있는 주소로 옮기면 THEN 둘 다 409이고 두 글 모두 그대로다", async () => {
    const { store, app } = setup();
    const { revision: stale } = await store.put("beta-open", fixtures.minimal, null);
    const updated = { ...fixtures.minimal, meta: { ...fixtures.minimal.meta, title: "고친 제목" } };
    const { revision } = await store.put("beta-open", updated, stale);
    const other = await store.put("taken", fixtures.allBlocks, null);

    const staleRes = await rename(app, "beta-open", "new-home", { "If-Match": `"${stale}"` });
    const takenRes = await rename(app, "beta-open", "taken", { "If-Match": `"${revision}"` });

    expect(staleRes.status).toBe(409);
    expect(takenRes.status).toBe(409);
    expect(await staleRes.json()).toMatchObject({ reason: "stale" });
    expect(await takenRes.json()).toMatchObject({ reason: "taken" });
    expect(await store.get("beta-open")).toEqual({ file: updated, revision });
    expect(await store.get("taken")).toEqual({
      file: fixtures.allBlocks,
      revision: other.revision,
    });
    expect(await store.get("new-home")).toBeNull();
  });

  it("WHEN If-Match 없이 · 없는 글에 · 잘못된 주소로 보내면 THEN 428 · 404 · 400이다", async () => {
    const { store, app } = setup();
    const { revision } = await store.put("beta-open", fixtures.minimal, null);

    const noCondition = await rename(app, "beta-open", "new-home", {});
    const missing = await rename(app, "never-written", "new-home", { "If-Match": `"${revision}"` });
    const badTarget = await rename(app, "beta-open", "Bad_Slug", { "If-Match": `"${revision}"` });

    expect(noCondition.status).toBe(428);
    expect(missing.status).toBe(404);
    expect(badTarget.status).toBe(400);
    expect(await store.get("beta-open")).toEqual({ file: fixtures.minimal, revision });
  });
});
