import { docSchema } from "@blog-editor/content-schema";
import { renderHtml } from "./render";

const PLACEHOLDER_BRIEF = "잠든 아기 옆 낮잠 방";
const IMAGE_BRIEF = "벚꽃 아래 유모차";

describe("photo-placeholder — 공개 HTML에는 사진 자리와 그림 설명이 없다", () => {
  it("WHEN 문단 · 사진 자리 · brief 그림을 렌더한다 THEN 두 설명 글이 없고 문단과 그림은 있다", () => {
    const doc = docSchema.parse({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "봄 산책" }] },
        { type: "photoPlaceholder", attrs: { brief: PLACEHOLDER_BRIEF, ratio: "4:3" } },
        {
          type: "image",
          attrs: { src: "/images/cherry-walk.webp", alt: "봄 산책", brief: IMAGE_BRIEF },
        },
      ],
    });

    const html = renderHtml({ doc }, { imageBaseUrl: "https://cdn.example.com" });

    expect(html).toContain("<p>봄 산책</p>");
    expect(html).toContain('src="https://cdn.example.com/images/cherry-walk.webp"');
    expect(html).not.toContain(PLACEHOLDER_BRIEF);
    expect(html).not.toContain(IMAGE_BRIEF);
  });
});
