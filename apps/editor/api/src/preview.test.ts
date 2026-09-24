import { fixtures, normalize } from "@blog-editor/content-schema";
import { renderHtml } from "@blog-editor/content-render";
import { createApp } from "./app";
import { createMemoryPostStore } from "./memory-store";
import { MAX_PREVIEW_BODY_BYTES } from "./input-limits";
import { testAuthOptions, withSession } from "./test-app.test.helpers";

const IMAGE_BASE_URL = "https://simsimeestudio.com";

function setup() {
  const store = createMemoryPostStore();
  const app = createApp({
    store,
    categories: ["studio"],
    imageBaseUrl: IMAGE_BASE_URL,
    ...testAuthOptions,
  });
  return { store, raw: app, app: withSession(app) };
}

function previewInit(doc: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ doc }),
  };
}

describe("post-preview-api — 공개 렌더러 그대로의 미리보기", () => {
  it("WHEN 로그인한 채 꾸미기가 든 문서로 미리보기를 부르면 THEN 200이고 renderHtml과 같은 HTML이다", async () => {
    const { store, app } = setup();
    const { doc } = fixtures.decorationMax;

    const res = await app.request("/api/preview", previewInit(doc));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      html: renderHtml({ doc: normalize(doc) }, { imageBaseUrl: IMAGE_BASE_URL }),
    });
    expect(await store.list()).toEqual([]);
  });

  it("WHEN 상한을 넘는 본문으로 부르면 THEN 413이다", async () => {
    const { app } = setup();
    const huge = "가".repeat(MAX_PREVIEW_BODY_BYTES);

    const res = await app.request("/api/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: huge }] }],
        },
      }),
    });

    expect(res.status).toBe(413);
  });

  it("WHEN javascript: 링크 문서로 · 세션 없이 부르면 THEN 400(이슈 경로에 href) · 401이다", async () => {
    const { raw, app } = setup();
    const unsafe = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "눌러",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };

    const rejected = await app.request("/api/preview", previewInit(unsafe));
    const anonymous = await raw.request("/api/preview", previewInit(fixtures.minimal.doc));

    expect(rejected.status).toBe(400);
    const body = (await rejected.json()) as { issues: Array<{ path: unknown[] }> };
    expect(body.issues.some((issue) => issue.path.includes("href"))).toBe(true);
    expect(anonymous.status).toBe(401);
  });
});
