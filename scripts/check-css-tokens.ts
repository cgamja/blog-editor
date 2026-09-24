/**
 * 레포의 손으로 쓴 CSS가 토큰 밖 값을 쓰는지 본다(#116, adr-025). `pnpm lint:css`로 돌고 `pnpm verify`에 들어간다.
 * 규칙(순수 함수)은 토큰의 주인 @blog-editor/design-tokens에 있고, 어느 파일을 볼지는 레포 도구인 이 스크립트가 정한다 —
 * 잎 패키지가 소비자 경로를 알지 않게. 새 CSS 파일은 따로 등록하지 않아도 검사된다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { findTokenViolations } from "@blog-editor/design-tokens/css-token-lint";

const root = fileURLToPath(new URL("../", import.meta.url));

/** 산출물 · 도구 폴더 — 손으로 쓴 CSS가 아니다 */
const SKIPPED_DIRS = new Set([
  "node_modules",
  ".git",
  ".claude",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
]);

/** 토큰을 정의하는 쪽이거나 사이트와의 계약이라 이 규칙 밖이다 */
const EXCLUDED_FILES = new Set([
  "packages/design-tokens/src/tokens.css", // 토큰 정본(생성 파일)
  "packages/content-render/src/post.css", // 공개 본문 CSS — 사이트 토큰과 따로 간다
]);
const EXCLUDED_PREFIXES = ["contract/"]; // 공개 API 계약 사본(post.css 포함)

function cssFilesUnder(dir: string): string[] {
  return readdirSync(`${root}${dir}`, { withFileTypes: true }).flatMap((entry) => {
    const path = dir === "" ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : cssFilesUnder(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

const files = cssFilesUnder("")
  .filter((file) => !EXCLUDED_FILES.has(file))
  .filter((file) => !EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix)))
  .sort();

let count = 0;
for (const file of files) {
  for (const violation of findTokenViolations(readFileSync(`${root}${file}`, "utf8"))) {
    count += 1;
    console.log(
      `${file}:${violation.line}  ${violation.property}: ${violation.value}  — ${violation.reason}`,
    );
  }
}

if (count > 0) {
  console.log(
    `\n✗ 토큰 밖 CSS 값 ${count}건 — 토큰(packages/design-tokens/src/tokens.css)을 쓰거나, 척도에 없는 값이면 같은 줄 · 윗줄에 /* token-lint-ignore: <이유> */`,
  );
  process.exit(1);
}
console.log(`css tokens OK (${files.length} files)`);
