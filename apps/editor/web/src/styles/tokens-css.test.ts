import { readFileSync } from "node:fs";
import { tokensToCss } from "./tokens-css";

const readRepoFile = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("tokensToCss — 코드 토큰 파일은 디자인 토큰과 어긋나지 않는다", () => {
  it("WHEN 색 토큰을 바꾼다 THEN 같은 이름의 CSS 변수다", () => {
    const css = tokensToCss({ color: { "brand-ink": "#b0552f" } });
    expect(css).toContain("--brand-ink: #b0552f;");
  });

  it("WHEN px 크기와 길이가 아닌 값을 바꾼다 THEN px는 rem으로, 길이가 아닌 값은 건너뛴다", () => {
    const css = tokensToCss({
      size: { "control-height": "44px", "focus-ring": "2px solid #b0552f, offset 2px" },
    });
    expect(css).toContain("--control-height: 2.75rem;");
    expect(css).not.toContain("--focus-ring");
  });

  it("WHEN 간격 토큰을 바꾼다 THEN --space-<n>이다", () => {
    const css = tokensToCss({ space: { "8": "8px" } });
    expect(css).toContain("--space-8: 0.5rem;");
  });

  it("WHEN 선 두께 · 포커스 고리 토큰을 바꾼다 THEN 글자 크기를 따라 커지지 않게 px 그대로다", () => {
    const css = tokensToCss({
      size: { "border-width": "1px", "focus-ring-width": "2px", "focus-ring-offset": "2px" },
    });
    expect(css).toContain("--border-width: 1px;");
    expect(css).toContain("--focus-ring-width: 2px;");
    expect(css).toContain("--focus-ring-offset: 2px;");
  });

  it("WHEN font에 ui: 15px, body: 글꼴 이름을 준다 THEN --font-size-ui: 0.9375rem이 있고 글꼴 이름은 크기가 되지 않는다", () => {
    const css = tokensToCss({ font: { body: "'IBM Plex Sans KR', sans-serif", ui: "15px" } });
    expect(css).toContain("--font-size-ui: 0.9375rem;");
    expect(css).not.toContain("--font-size-body");
  });

  it("WHEN shadow.card를 0 2px 4px ink 12%, 0 1px 2px ink 8%로 준다 THEN 색 토큰을 color-mix로 섞은 --shadow-card다", () => {
    const css = tokensToCss({
      color: { ink: "#3a2b26" },
      shadow: { card: "0 2px 4px ink 12%, 0 1px 2px ink 8%" },
    });
    expect(css).toContain(
      "--shadow-card: 0 2px 4px color-mix(in srgb, var(--ink) 12%, transparent), 0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent);",
    );
  });

  it.each([
    ["없는 색 이름", { color: { ink: "#3a2b26" }, shadow: { card: "0 2px 4px nope 12%" } }],
    ["불투명도가 빠졌다", { color: { ink: "#3a2b26" }, shadow: { card: "0 2px 4px ink" } }],
    [
      "0이 아닌 길이에 단위가 없다",
      { color: { ink: "#3a2b26" }, shadow: { card: "0 2 4 ink 12%" } },
    ],
  ])("WHEN 잘못된 그림자(%s) THEN 생성이 멈춘다", (_case, tokens) => {
    expect(() => tokensToCss(tokens)).toThrow();
  });

  it.each([
    ["이름에 허용 밖 글자", { color: { "Brand Ink": "#b0552f" } }],
    ["같은 CSS 변수 이름이 두 번", { size: { "space-8": "8px" }, space: { "8": "8px" } }],
    ["간격이 px가 아니다", { space: { "8": "0.5rem" } }],
    ["색이 hex · rgb가 아니다", { color: { ink: "red; background: url(x)" } }],
  ])("WHEN 잘못된 토큰(%s) THEN 생성이 멈춘다", (_case, tokens) => {
    expect(() => tokensToCss(tokens)).toThrow();
  });

  it("WHEN 지금 디자인 토큰으로 CSS를 만든다 THEN 저장된 tokens.css와 같다", () => {
    const tokens: unknown = JSON.parse(readRepoFile("../../../../../design/tokens.json"));
    expect(readRepoFile("./tokens.css")).toBe(tokensToCss(tokens));
  });
});
