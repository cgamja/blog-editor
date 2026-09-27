import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { createApp } from "./app";
import { createMemoryPostStore } from "./memory-store";
import { testAuthOptions } from "./test-app.test.helpers";

const PLACEHOLDER_BRIEF = "잠든 아기 옆 낮잠 방";
const IMAGE_BRIEF = "벚꽃 아래 유모차";

describe("photo-placeholder — 공개 조회에 설명이 나가지 않는다", () => {
  it("WHEN 사진 자리와 brief 그림이 든 발행 글을 GET /public/posts로 읽는다 THEN 그 글의 html에 두 설명 글이 없다", async () => {
    const store = createMemoryPostStore();
    const app = createApp({
      store,
      categories: ["studio", "parenting", "parenting-assistant"],
      imageBaseUrl: "https://simsimeestudio.com",
      ...testAuthOptions,
    });
    const file: PostFile = {
      ...fixtures.minimal,
      meta: { ...fixtures.minimal.meta, draft: false },
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "봄 산책" }] },
          { type: "photoPlaceholder", attrs: { brief: PLACEHOLDER_BRIEF } },
          {
            type: "image",
            attrs: { src: "/images/cherry-walk.webp", alt: "봄 산책", brief: IMAGE_BRIEF },
          },
        ],
      },
    };
    await store.put("spring-walk", file, null);

    const res = await app.request("/public/posts");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { posts: Array<{ slug: string; html: string }> };
    const html = body.posts.find((post) => post.slug === "spring-walk")?.html ?? "";
    expect(html).toContain("봄 산책");
    expect(html).not.toContain(PLACEHOLDER_BRIEF);
    expect(html).not.toContain(IMAGE_BRIEF);
  });
});
