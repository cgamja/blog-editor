/// <reference types="node" />
import { readFileSync } from "node:fs";
import {
  ALIGNS,
  CALLOUT_TONES,
  FONTS,
  HIGHLIGHT_COLORS,
  MOTIONS,
  TEXT_COLORS,
  TEXT_SIZES,
  TEXT_WEIGHTS,
} from "@blog-editor/content-schema";

const css = readFileSync(new URL("./post.css", import.meta.url), "utf8");

/** `marker`로 시작하는 at-rule 블록의 안쪽 텍스트와, 그 블록을 뺀 나머지 텍스트. 없으면 null. */
function splitBlock(source: string, marker: string): { inside: string; outside: string } | null {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) {
      return {
        inside: source.slice(open + 1, i),
        outside: source.slice(0, start) + source.slice(i + 1),
      };
    }
  }
  return null;
}

const SITE_TOKENS = [
  "--ink",
  "--ink-soft",
  "--brand",
  "--brand-ink",
  "--brand-soft",
  "--surface-2",
  "--line",
  "--accent-soft",
  "--accent-ink",
  "--font-sans",
  "--font-display",
  "--font-hand",
];

const MOTION_PATTERNS = [/animation-timeline/, /@keyframes/, /data-motion/];

describe("render-css", () => {
  it("WHEN post.css를 읽으면 THEN 사이트 토큰을 정의하지 않고 var()로 참조만 한다", () => {
    expect(css).not.toMatch(/:root/);
    // `var(--ink` 접두어 일치는 `--ink-soft`로도 통과한다 — 닫는 괄호나 쉼표까지 본다
    for (const token of SITE_TOKENS) expect(css).toMatch(new RegExp(`var\\(${token}[,)]`));
  });

  it("WHEN 스키마 enum 값마다 선택자를 만들면 THEN 열한 개 전부 post.css에 있다", () => {
    const selectors = [
      ...FONTS.map((font) => `[data-font="${font}"]`),
      ...MOTIONS.map((motion) => `[data-motion="${motion}"]`),
      ...CALLOUT_TONES.map((tone) => `[data-tone="${tone}"]`),
    ];
    expect(selectors).toHaveLength(11);
    for (const selector of selectors) expect(css).toContain(selector);
  });

  it("WHEN 글자 스타일 · 정렬 값마다 선택자를 만들면 THEN 전부 post.css에 있다", () => {
    const selectors = [
      ...TEXT_WEIGHTS.map((weight) => `[data-weight="${weight}"]`),
      ...TEXT_SIZES.map((size) => `[data-size="${size}"]`),
      ...[...TEXT_COLORS, "custom"].map((color) => `[data-color="${color}"]`),
      ...[...HIGHLIGHT_COLORS, "custom"].map((color) => `[data-highlight="${color}"]`),
      ...ALIGNS.map((align) => `[data-align="${align}"]`),
    ];
    for (const selector of selectors) expect(css).toContain(selector);
  });

  it("WHEN 두께를 지정한 글자 스타일 규칙을 찾으면 THEN 브라우저가 가짜 굵기를 만들지 않게 막는다", () => {
    expect(css).toMatch(/\.post-ts\[data-weight\]\s*\{[^}]*font-synthesis-weight:\s*none/);
  });

  it("WHEN 움직임 규칙의 위치를 찾으면 THEN 전부 reduced-motion 과 @supports 두 조건 안에만 있다", () => {
    const media = splitBlock(css, "@media (prefers-reduced-motion: no-preference)");
    expect(media).not.toBeNull();
    const supports = splitBlock(media!.inside, "@supports (animation-timeline: view())");
    expect(supports).not.toBeNull();

    for (const pattern of MOTION_PATTERNS) {
      expect(media!.outside).not.toMatch(pattern);
      expect(supports!.outside).not.toMatch(pattern);
      expect(supports!.inside).toMatch(pattern);
    }
    // 움직임은 transform · opacity만 바꾼다 — 레이아웃 속성이 들어오면 스크롤 중 리플로가 생긴다(adr-008)
    const properties = [...supports!.inside.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]!);
    expect(properties.length).toBeGreaterThan(0);
    for (const property of properties) {
      expect(property, property).toMatch(/^(animation|opacity$|transform$)/);
    }
  });

  it("WHEN 표 규칙을 찾으면 THEN 틀은 가로로 스크롤하고 칸 정렬 규칙이 center · right 둘 다 있다", () => {
    expect(css).toMatch(/\.post-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
    for (const align of ["center", "right"]) {
      expect(css).toMatch(
        new RegExp(
          `\\.post-table-scroll[^{]*\\[data-align="${align}"\\][^{]*\\{[^}]*text-align:\\s*${align}`,
        ),
      );
    }
  });
});
