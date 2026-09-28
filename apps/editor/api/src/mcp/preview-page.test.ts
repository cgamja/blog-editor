import { readFileSync } from "node:fs";
import { PREVIEW_WEB_FONTS_STYLESHEET, PREVIEW_SITE_TOKENS } from "./preview-page";

/**
 * api는 design-tokens · web을 import할 수 없어(adr-009 허용 엣지) 미리보기가 토큰 값 · 글꼴 주소를 옮겨 둔다.
 * 원본이 바뀌면 여기서 어긋남을 잡는다 — import가 아니라 파일 글자로 읽어 경계는 그대로다.
 */
const TOKENS_CSS = new URL("../../../../../packages/design-tokens/src/tokens.css", import.meta.url);
const WEB_FONTS_TS = new URL("../../../web/src/shared/web-fonts.ts", import.meta.url);

function declaredTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/^\s*--([a-z0-9-]+):\s*(.+);\s*$/gm)) {
    tokens.set(match[1]!, match[2]!);
  }
  return tokens;
}

describe("mcp-drafts — preview_post 문서", () => {
  it("WHEN 미리보기의 사이트 토큰을 design-tokens tokens.css와 대조하면 THEN 이름마다 값이 같다", () => {
    const source = declaredTokens(readFileSync(TOKENS_CSS, "utf8"));

    for (const [name, value] of Object.entries(PREVIEW_SITE_TOKENS)) {
      expect(source.get(name), `--${name}`).toBe(value);
    }
  });

  it("WHEN 미리보기의 글꼴 주소를 web 화면 글꼴 주소와 대조하면 THEN 같다", () => {
    const webFonts = readFileSync(WEB_FONTS_TS, "utf8");

    expect(webFonts).toContain(`"${PREVIEW_WEB_FONTS_STYLESHEET}"`);
  });
});
