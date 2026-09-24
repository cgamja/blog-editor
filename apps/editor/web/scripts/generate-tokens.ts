/**
 * design/tokens.json → src/styles/tokens.css. `pnpm --filter @blog-editor/web tokens`로 돌린다.
 * Node의 TypeScript 타입 제거로 바로 실행한다(https://nodejs.org/api/typescript.html) — 빌드 도구가 필요 없다.
 * 어긋나면 tokens-css.test.ts가 verify를 빨갛게 만든다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tokensToCss } from "../src/styles/tokens-css.ts";

const source = new URL("../../../../design/tokens.json", import.meta.url);
const target = new URL("../src/styles/tokens.css", import.meta.url);

writeFileSync(target, tokensToCss(JSON.parse(readFileSync(source, "utf8"))));
