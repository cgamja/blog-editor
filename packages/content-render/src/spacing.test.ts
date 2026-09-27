/// <reference types="node" />
import { readFileSync } from "node:fs";
import { SPACES } from "@blog-editor/content-schema";
import type { Block } from "@blog-editor/content-schema";
import { renderHtml } from "./render";

const BASE = "https://cdn.example.com";
const css = readFileSync(new URL("./post.css", import.meta.url), "utf8");

describe("render-decoration: 간격", () => {
  it("WHEN 간격 lg 문단 · 간격 xl 이미지 · 글꼴과 간격이 있는 제목을 렌더하면 THEN 래퍼의 data-space로 나오고 속성 순서가 고정이다", () => {
    const blocks: Block[] = [
      { type: "paragraph", attrs: { space: "lg" }, content: [{ type: "text", text: "가" }] },
      { type: "image", attrs: { src: "/images/a.webp", alt: "a", width: 60, space: "xl" } },
      {
        type: "heading",
        attrs: { level: 2, font: "jua", align: "center", space: "sm" },
        content: [{ type: "text", text: "제목" }],
      },
    ];

    const html = renderHtml({ doc: { type: "doc", content: blocks } }, { imageBaseUrl: BASE });

    expect(html).toContain('<div class="post-block" data-space="lg"><p>가</p></div>');
    expect(html).toContain(
      `<div class="post-block" data-space="xl" style="--w:60"><figure class="post-image"><img src="${BASE}/images/a.webp" alt="a" loading="lazy" decoding="async"></figure></div>`,
    );
    expect(html).toContain(
      '<div class="post-block" data-font="jua" data-align="center" data-space="sm"><h2>제목</h2></div>',
    );
  });
});

describe("render-css: 간격", () => {
  it("WHEN 간격 값마다 선택자를 찾으면 THEN 전부 post.css에 있고 여백은 앞 블록이 있을 때만 준다", () => {
    for (const space of SPACES) expect(css).toContain(`[data-space="${space}"]`);
    expect(css).toMatch(/\.post-body > \* \+ \[data-space\]\s*\{[^}]*margin-top:/);
  });

  it("WHEN 간격 블록 바로 앞 블록이 래퍼(움직임 · 스티커로 감싼 구분선)면 THEN 래퍼 안 마지막 요소의 아래 여백도 지운다", () => {
    expect(css).toMatch(
      /\.post-body > :has\(\+ \[data-space\]\) > :last-child\s*\{[^}]*margin-bottom:\s*0/,
    );
  });
});
