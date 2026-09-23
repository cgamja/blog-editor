import { fixtures, STICKER_IDS } from "@blog-editor/content-schema";
import type { Block, Doc } from "@blog-editor/content-schema";
import { renderHtml } from "./render";

const BASE = "https://cdn.example.com";

function docOf(...blocks: Block[]): { doc: Doc } {
  return { doc: { type: "doc", content: blocks } };
}

function paragraph(text: string, attrs?: Extract<Block, { type: "paragraph" }>["attrs"]): Block {
  return { type: "paragraph", ...(attrs ? { attrs } : {}), content: [{ type: "text", text }] };
}

/**
 * 태그 안의 속성 이름을 전부 모은다(render-safety) — 따옴표 안의 값을 먼저 지워 값 속 글자
 * (이스케이프된 `onload=` 등)는 세지 않고, 남은 토큰은 따옴표 없는 값 · 값 없는 속성 · 대문자까지
 * 이름으로 센다. 텍스트 노드의 `=`는 태그 밖이라 세지 않는다.
 */
function attributeNames(html: string): Set<string> {
  const names = new Set<string>();
  // 구분자는 공백뿐 아니라 `/`도 된다(`<img/onload=1>`), 따옴표 값 바로 뒤에 붙은 속성도 센다
  for (const [, inside] of html.matchAll(/<[a-z0-9]+([\s/][^>]*)?>/gi)) {
    const withoutValues = (inside ?? "").replace(/"[^"]*"|'[^']*'/g, " ");
    for (const [, name] of withoutValues.matchAll(/[\s/]([^\s="'>/]+)/g)) {
      names.add(name!.toLowerCase());
    }
  }
  return names;
}

// ── html-render ─────────────────────────────────────────────────────────

describe("html-render", () => {
  it("WHEN 대표 픽스처 3개를 렌더하면 THEN 출력이 스냅샷과 같고 입력은 그대로다", () => {
    for (const [name, file] of Object.entries(fixtures)) {
      const before = JSON.stringify(file);
      expect(renderHtml(file, { imageBaseUrl: BASE })).toMatchSnapshot(name);
      expect(JSON.stringify(file)).toBe(before);
    }
  });

  it("WHEN 마크 4개가 한 텍스트에 겹치면 THEN a > strong > em > code 순으로 중첩된다", () => {
    const file = docOf({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "겹침",
          marks: [
            { type: "code" },
            { type: "bold" },
            { type: "link", attrs: { href: "/a" } },
            { type: "italic" },
          ],
        },
      ],
    });
    expect(renderHtml(file, { imageBaseUrl: BASE })).toContain(
      '<a href="/a"><strong><em><code>겹침</code></em></strong></a>',
    );
  });

  it("WHEN imageBaseUrl 끝에 슬래시가 있으면 THEN 경로가 한 번만 이어진다", () => {
    const file = docOf({ type: "image", attrs: { src: "/images/a.webp", alt: "a" } });
    const html = renderHtml(file, { imageBaseUrl: `${BASE}/` });
    expect(html).toContain(`src="${BASE}/images/a.webp"`);
    expect(html).not.toContain("//images");
  });

  it("WHEN 마크업처럼 생긴 텍스트와 alt를 주면 THEN 글자로만 나오고 새 태그가 생기지 않는다", () => {
    const file = docOf(paragraph(`<b onclick="x">&"'`), {
      type: "image",
      attrs: { src: "/images/a.webp", alt: `"><img src=x onerror=1>` },
    });
    const html = renderHtml(file, { imageBaseUrl: BASE });
    expect(html).toContain("<p>&lt;b onclick=&quot;x&quot;&gt;&amp;&quot;&#39;</p>");
    expect(html).toContain('alt="&quot;&gt;&lt;img src=x onerror=1&gt;"');
    expect(html).not.toMatch(/<b\b|<img src=x/);
  });

  it("WHEN 원본 크기가 있는 이미지를 렌더하면 THEN img에 width · height가 나오고 --w와 공존한다", () => {
    const file = docOf({
      type: "image",
      attrs: {
        src: "/images/a.webp",
        alt: "그림",
        naturalWidth: 1200,
        naturalHeight: 800,
        width: 60,
      },
    });
    expect(renderHtml(file, { imageBaseUrl: BASE })).toBe(
      `<div class="post-body"><div class="post-block" style="--w:60"><figure class="post-image"><img src="${BASE}/images/a.webp" alt="그림" width="1200" height="800" loading="lazy" decoding="async"></figure></div></div>`,
    );
  });
});

// ── render-safety (보호 대상 — 고쳐서 통과시키지 않는다) ─────────────────────

describe("render-safety", () => {
  const HOSTILE = ["<script>alert(1)</script>", '" onload="x', "javascript:alert(1)"];

  /** href · src 속성값만 모은다 — 스킴 검사는 속성값에 대한 것이고 본문 글자에 대한 것이 아니다. */
  function urlAttributeValues(html: string): string[] {
    return [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]!);
  }

  it("WHEN 픽스처 3개와 적대적 문서를 렌더하면 THEN script 태그 · on* 속성 · javascript: 스킴 속성이 없다", () => {
    // 내부 경로 href는 스키마가 `"`를 허용하므로 검증된 문서로도 도달하는 경로다 — 이스케이프가 지켜야 한다
    const hostileHref: Block = {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "링크",
          marks: [{ type: "link", attrs: { href: '/a"onmouseover="x' } }],
        },
      ],
    };
    const hostile = docOf(
      hostileHref,
      ...HOSTILE.map((text) => paragraph(text)),
      ...HOSTILE.map((alt): Block => ({ type: "image", attrs: { src: "/images/a.webp", alt } })),
      ...HOSTILE.map((caption): Block => ({
        type: "appScreenshot",
        attrs: { src: "/images/a.webp", caption },
      })),
      ...HOSTILE.map((text): Block => ({ type: "codeBlock", content: [{ type: "text", text }] })),
    );
    const outputs = [...Object.values(fixtures), hostile].map((file) =>
      renderHtml(file, { imageBaseUrl: BASE }),
    );
    for (const html of outputs) {
      expect(html).not.toMatch(/<script/i);
      for (const name of attributeNames(html)) expect(name).not.toMatch(/^on/i);
      for (const value of urlAttributeValues(html)) expect(value).not.toMatch(/^\s*javascript:/i);
    }
    // 적대적 문자열은 이스케이프된 글자로만 남는다 — 태그 · 속성 · 스킴이 되지 않는다
    const hostileHtml = outputs.at(-1)!;
    expect(hostileHtml).toContain("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(hostileHtml).toContain('alt="&quot; onload=&quot;x"');
    expect(hostileHtml).toContain("<p>javascript:alert(1)</p>");
    expect(hostileHtml).toContain('<a href="/a&quot;onmouseover=&quot;x">링크</a>');
  });

  it("WHEN 표에 없는 heading level · 스티커 id를 렌더하면 THEN RangeError를 던진다", () => {
    // 검증을 건너뛴 문서를 흉내 낸다 — 태그 이름 · 파일 이름은 이스케이프로 막을 수 없어 오류가 답이다
    const heading = (level: unknown): Block =>
      ({ type: "heading", attrs: { level }, content: [{ type: "text", text: "제목" }] }) as Block;
    const sticker = (id: string): Block =>
      paragraph("문단", { stickers: [{ id: id as "heart", x: 0, y: 0, size: 10, rotate: 0 }] });
    // "toString" · "constructor"는 일반 객체의 프로토타입 키라 표에 없어도 값이 나온다 — 자기 키만 인정해야 한다
    const cases = [
      docOf(heading(4)),
      docOf(heading("2 onload=x")),
      docOf(heading("toString")),
      docOf(sticker("moon")),
      docOf(sticker("constructor")),
    ];
    for (const file of cases) {
      expect(() => renderHtml(file, { imageBaseUrl: BASE })).toThrow(RangeError);
    }
  });

  it("WHEN decorationMax를 렌더하면 THEN 속성 이름이 닫힌 목록의 부분집합이다", () => {
    const ALLOWED = new Set([
      "class",
      "data-font",
      "data-motion",
      "data-tone",
      "data-language",
      "style",
      "href",
      "src",
      "alt",
      "width",
      "height",
      "loading",
      "decoding",
    ]);
    const names = attributeNames(renderHtml(fixtures.decorationMax, { imageBaseUrl: BASE }));
    expect(names.size).toBeGreaterThan(0);
    for (const name of names) expect(ALLOWED).toContain(name);
  });
});

// ── render-decoration ───────────────────────────────────────────────────

describe("render-decoration", () => {
  it("WHEN 글씨체 · 움직임 · 폭이 있으면 THEN 래퍼의 data-* 와 --w 로 나온다", () => {
    const file = docOf(
      {
        type: "heading",
        attrs: { level: 2, font: "jua", motion: "fade-up" },
        content: [{ type: "text", text: "제목" }],
      },
      { type: "image", attrs: { src: "/images/a.webp", alt: "a", width: 60 } },
    );
    const html = renderHtml(file, { imageBaseUrl: BASE });
    expect(html).toContain(
      '<div class="post-block" data-font="jua" data-motion="fade-up"><h2>제목</h2></div>',
    );
    expect(html).toContain(
      `<div class="post-block" style="--w:60"><figure class="post-image"><img src="${BASE}/images/a.webp" alt="a" loading="lazy" decoding="async"></figure></div>`,
    );
  });

  it("WHEN 꾸미기가 없으면 THEN 래퍼가 없다", () => {
    const file = docOf(paragraph("문단"), {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "제목" }],
    });
    expect(renderHtml(file, { imageBaseUrl: BASE })).not.toContain("post-block");
  });

  it("WHEN 스티커 두 개를 붙이면 THEN 블록 뒤에 순서대로 img 가 나온다", () => {
    const file = docOf(
      paragraph("문단", {
        stickers: [
          { id: "star-coral", x: -25, y: 0, size: 5, rotate: -180 },
          { id: "heart", x: 50, y: 30, size: 20, rotate: 0 },
        ],
      }),
    );
    expect(renderHtml(file, { imageBaseUrl: BASE })).toContain(
      "<p>문단</p>" +
        `<img class="post-sticker" src="${BASE}/stickers/star-coral.png" alt="" width="151" height="160" loading="lazy" decoding="async" style="--x:-25;--y:0;--s:5;--r:-180">` +
        `<img class="post-sticker" src="${BASE}/stickers/heart.png" alt="" width="160" height="128" loading="lazy" decoding="async" style="--x:50;--y:30;--s:20;--r:0">`,
    );
  });

  it("WHEN 스티커 9종을 각각 붙이면 THEN 전부 양의 정수 width · height 가 있다", () => {
    for (const id of STICKER_IDS) {
      const file = docOf(
        paragraph("문단", { stickers: [{ id, x: 0, y: 0, size: 10, rotate: 0 }] }),
      );
      const html = renderHtml(file, { imageBaseUrl: BASE });
      const size = /width="(\d+)" height="(\d+)"/.exec(html);
      expect(size, id).not.toBeNull();
      expect(Number(size![1])).toBeGreaterThan(0);
      expect(Number(size![2])).toBeGreaterThan(0);
    }
  });
});
