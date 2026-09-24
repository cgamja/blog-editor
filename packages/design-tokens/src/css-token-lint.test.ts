import { describe, expect, it } from "vitest";
import { findTokenViolations } from "./css-token-lint.ts";

const locationsOf = (css: string) => findTokenViolations(css).map((v) => `${v.line}:${v.property}`);

describe("findTokenViolations", () => {
  it("WHEN 색 리터럴(16진 · rgb · hsl)을 쓰면 THEN 위반이다", () => {
    const css = [
      ".a {",
      "  color: #fff;",
      "  background: rgb(0 0 0 / 50%);",
      "  border-color: hsl(10 20% 30%);",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["2:color", "3:background", "4:border-color"]);
  });

  it("WHEN 색 속성에 이름 있는 색을 쓰면 THEN 위반이고 transparent · currentColor는 괜찮다", () => {
    const css = ".a { color: white; background: transparent; border-color: currentColor; }";
    expect(locationsOf(css)).toEqual(["1:color"]);
  });

  it("WHEN 순수 색 속성에 허용 목록(전역 키워드 · 시스템 색 · none) 밖의 식별자를 쓰면 THEN 위반이다", () => {
    const css = [
      ".a {",
      "  color: rebeccapurple;",
      "  background-color: Canvas;",
      "  border-left-color: inherit;",
      "  outline-color: revert;",
      "  fill: none;",
      "  caret-color: auto;",
      "  accent-color: papayawhip;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["2:color", "8:accent-color"]);
  });

  it("WHEN 줄임 속성(background · border · box-shadow)에 이름 있는 색을 쓰면 THEN 위반이고 다른 낱말은 괜찮다", () => {
    const css = [
      ".a {",
      "  background: rebeccapurple url(grain.png) no-repeat;",
      "  border: var(--border-width) solid navy;",
      "  box-shadow: inset 0 0 0 var(--border-width) var(--line);",
      "  outline: var(--focus-ring-width) dashed currentColor;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["2:background", "3:border"]);
  });

  it("WHEN 토큰을 참조하고 var() fallback에만 리터럴이 있으면 THEN 위반이 아니다", () => {
    const css = [
      ".a {",
      "  color: var(--ink);",
      "  padding: var(--space-8) var(--space-16);",
      "  border: var(--border-width, 1px) solid var(--line, #e4d9cf);",
      "  font-size: var(--font-size-ui);",
      "  box-shadow: 0 2px 6px color-mix(in srgb, var(--ink) 8%, transparent);",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual([]);
  });

  it("WHEN 중첩 var()의 fallback 안에 리터럴이 있으면 THEN 위반이 아니고 var() 밖 리터럴은 위반이다", () => {
    const css = [
      ".a {",
      "  padding: var(--a, var(--b, 3px));",
      "  color: var(--x, var(--y, #fff));",
      "  margin: var(--a, 1px) 3px;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["4:margin"]);
  });

  it("WHEN 간격 속성(margin · padding · gap · inset)에 px · rem 리터럴을 쓰면 THEN 위반이고 0 · auto · % · em은 괜찮다", () => {
    const css = [
      ".a {",
      "  margin: 0 auto;",
      "  padding: 0.5rem;",
      "  gap: 12px;",
      "  inset: 0 0 auto 10%;",
      "  margin-block-start: 1em;",
      "  padding-inline: calc(100% - 2rem);",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["3:padding", "4:gap", "7:padding-inline"]);
  });

  it("WHEN 선 두께(border · outline)에 길이 리터럴을 쓰면 THEN 위반이고 border-radius는 대상이 아니다", () => {
    const css = [
      ".a {",
      "  border: 1px solid var(--line);",
      "  border-top-width: 2px;",
      "  outline-offset: 2px;",
      "  border: 0;",
      "  border-radius: 0.5rem;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["2:border", "3:border-top-width", "4:outline-offset"]);
  });

  it("WHEN 글자 크기에 px · rem 리터럴을 쓰면 THEN 위반이고 em · inherit은 괜찮다", () => {
    const css =
      ".a { font-size: 0.875rem; }\n.b { font-size: 1em; }\n.c { font: 400 12px/1.5 var(--font-sans); }\n.d { font-size: inherit; }";
    expect(locationsOf(css)).toEqual(["1:font-size", "3:font"]);
  });

  it("WHEN 범위 변수(--x)를 리터럴 색이나 길이로 정의하면 THEN 위반이다", () => {
    const css =
      ".a { --local-color: #123456; --local-size: 4rem; --local-ref: var(--space-8); --ratio: 1.5; }";
    expect(locationsOf(css)).toEqual(["1:--local-color", "1:--local-size"]);
  });

  it("WHEN 단위 · 16진이 대문자이면 THEN 소문자와 똑같이 위반이다", () => {
    expect(locationsOf(".a { padding: 3PX; color: #FFF; }")).toEqual(["1:padding", "1:color"]);
  });

  it("WHEN !important가 붙어 있으면 THEN 값만 보고 판정한다", () => {
    const css = ".a { padding: 3px !important; color: var(--ink) !important; }";
    expect(locationsOf(css)).toEqual(["1:padding"]);
  });

  it("WHEN 선언이 여러 줄에 걸치면 THEN 선언이 시작한 줄로 알린다", () => {
    const css = [".a {", "  box-shadow:", "    0 2px 6px #000,", "    0 0 0 1px #fff;", "}"].join(
      "\n",
    );
    expect(locationsOf(css)).toEqual(["2:box-shadow"]);
  });

  it("WHEN url() 안에 ;가 있으면 THEN 선언을 거기서 자르지 않는다", () => {
    const css = ".a { background: url(data:image/png;base64,AAA) #fff; }";
    expect(locationsOf(css)).toEqual(["1:background"]);
  });

  it("WHEN 같은 줄이나 바로 윗줄에 이유가 있는 예외 주석이 있으면 THEN 위반이 아니다", () => {
    const css = [
      ".a {",
      "  /* token-lint-ignore: 시각적 숨김 1px 상자 — 선 두께가 아니다 */",
      "  margin: -1px;",
      "  padding: 3px; /* token-lint-ignore: 디자인 캔버스의 손잡이 여백, 척도 밖 */",
      "  gap: 5px;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["5:gap"]);
  });

  it("WHEN 같은 줄 뒤에 붙은 예외 주석이면 THEN 주석 바로 앞 선언 하나에만 붙는다", () => {
    const css = ".a { padding: 3px; gap: 5px; /* token-lint-ignore: 손잡이 틈, 척도 밖 */ }";
    expect(locationsOf(css)).toEqual(["1:padding"]);
  });

  it("WHEN 주석만 있는 윗줄의 예외 주석이면 THEN 다음 줄의 첫 선언 하나에만 붙는다", () => {
    const css = [
      ".a {",
      "  /* token-lint-ignore: 손잡이 여백, 척도 밖 */",
      "  padding: 3px; gap: 5px;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["3:gap"]);
  });

  it("WHEN 예외 주석 뒤 같은 줄에 선언이 있으면 THEN 그 선언에만 붙고 다음 줄 선언은 여전히 위반이다", () => {
    const css = [
      ".a {",
      "  /* token-lint-ignore: 손잡이 틈, 척도 밖 */ gap: 3px;",
      "  padding: 5px;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["3:padding"]);
  });

  it("WHEN 예외 주석에 이유가 없으면 THEN 여전히 위반이다", () => {
    const css = ".a {\n  /* token-lint-ignore */\n  margin: 3px;\n}";
    const [violation] = findTokenViolations(css);
    expect(violation).toMatchObject({ line: 3, property: "margin" });
    expect(violation?.reason).toContain("이유");
  });

  it("WHEN 표시가 주석 맨 앞이 아니거나 콜론 뒤 이유가 문장부호뿐이면 THEN 예외가 아니다", () => {
    const css = [
      ".a {",
      "  /* see token-lint-ignore docs */",
      "  margin: 3px;",
      "  /* token-lint-ignore: — */",
      "  padding: 3px;",
      "  /* token-lint-ignore 이유 없는 콜론 빠짐 */",
      "  gap: 3px;",
      "}",
    ].join("\n");
    expect(locationsOf(css)).toEqual(["3:margin", "5:padding", "7:gap"]);
  });

  it("WHEN 선택자 · 미디어 쿼리 · 주석 · 문자열에 리터럴이 있으면 THEN 위반이 아니다", () => {
    const css = [
      "/* color: #fff; padding: 4px; */",
      "@media (max-width: 40rem) {",
      '  .a:hover::after { content: "#1 12px"; padding: var(--space-4); }',
      "}",
      '.b { background-image: url("#grain"); }',
    ].join("\n");
    expect(locationsOf(css)).toEqual([]);
  });
});
