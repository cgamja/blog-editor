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

  it("WHEN 지금 디자인 토큰으로 CSS를 만든다 THEN 저장된 tokens.css와 같다", () => {
    const tokens: unknown = JSON.parse(readRepoFile("../../../../../design/tokens.json"));
    expect(readRepoFile("./tokens.css")).toBe(tokensToCss(tokens));
  });
});
