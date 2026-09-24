import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

/**
 * import 경계 — 문서에만 있으면 AI가 편한 길로 넘는다(plan 10장). 린트로 잡을 수 있는 것은 여기서 잡는다.
 * 표는 adr-009(= docs/adr/0001-domain-structure.md)와 1:1. 엣지를 더하면 ADR 표 · 여기 · eslint.boundaries.test.ts를 함께 고친다.
 *
 * 패키지 의존 방향 (plan 3-3):
 *   content-schema ← content-render · content-convert ← editor-core ← editor-react
 *   api → content-schema · content-convert · content-render
 *   web → editor-react · content-schema
 *
 * 라이브러리 경계:
 *   - content-schema는 ProseMirror를 모른다 (저장 형식의 주인은 에디터 라이브러리가 아니다)
 *   - TipTap은 editor-core · editor-react 밖으로 나가지 않는다
 *   - React는 editor-react · web에만
 */
/**
 * `group`은 gitignore 방식이라 `*`가 `/`를 넘지 않는다. 패키지 이름과 그 아래 모든 경로를 같이 막는다
 * — `@tiptap/core/deep` 같은 중첩 import로 우회하지 못하게. eslint.boundaries.test.ts가 이것을 검사한다.
 */
const withSubpaths = (...names) => names.flatMap((n) => [n, `${n}/**`]);

const TIPTAP = {
  group: withSubpaths("@tiptap/*"),
  message: "TipTap은 editor-core·editor-react 안에만 둔다.",
};
const PROSEMIRROR = {
  group: withSubpaths("prosemirror-*", "@tiptap/pm"),
  message: "ProseMirror는 content-schema 밖에서만 쓴다.",
};
const REACT = {
  group: withSubpaths("react", "react-dom"),
  message: "React는 editor-react·web에만 둔다.",
};

/** 각 패키지가 import하면 안 되는 워크스페이스 패키지 — 의존 방향의 역방향·건너뛰기 전부 */
function forbidWorkspace(...names) {
  return {
    group: withSubpaths(...names.map((n) => `@blog-editor/${n}`)),
    message: "패키지 의존 방향을 어긴다 (eslint.config.mjs 머리 주석 참고).",
  };
}

const ALL = [
  "content-schema",
  "content-convert",
  "content-render",
  "editor-core",
  "editor-react",
  "api",
  "web",
];
const except = (...allowed) => ALL.filter((n) => !allowed.includes(n));

/**
 * 상대경로로 패키지 경계를 넘는 import. `@blog-editor/*`만 막으면 `../../content-render/src/…`로 우회된다
 * (2026-09-22 세팅 프로브에서 실제로 통과됐다, adr-009). 패키지 사이는 워크스페이스 이름으로만 넘는다.
 * 패턴을 `../` `./`로 앵커해 `@blog-editor/content-schema` 같은 패키지 이름은 건드리지 않는다.
 * `api` · `web`은 흔한 디렉터리 이름이라(`../api/client`는 정상) `<name>/src` 모양만 막는다 — 막는 모양은 테스트가 열거한다.
 */
const RELATIVE_CROSS_PACKAGE = {
  group: [
    ...withSubpaths("../**/packages", "./**/packages", "../**/apps", "./**/apps"),
    ...withSubpaths(...except("api", "web").map((n) => `../**/${n}`)),
    ...withSubpaths("../**/api/src", "../**/web/src"),
  ],
  message:
    "다른 패키지는 @blog-editor/<name>으로 import한다 — 상대경로로 패키지 경계를 넘지 않는다 (adr-009).",
};

/**
 * 생성기(fast-check)는 런타임 번들(api · web)로 새지 않는다(adr-015). fast-check 직접 import · `*.arbitrary`
 * 생성기 파일 · 패키지 `testing` 진입점은 테스트(*.test.ts) · 생성기 파일(*.arbitrary.ts) ·
 * 테스트 지원 파일(*.test.helpers.ts)에서만 쓴다.
 */
const TEST_SUPPORT_FILES = ["**/*.test.{ts,tsx}", "**/*.arbitrary.ts", "**/*.test.helpers.ts"];
const GENERATORS = {
  group: [
    ...withSubpaths("fast-check", "@blog-editor/*/testing"),
    // 확장자를 붙인 명시자(`./x.arbitrary.js`)도 bundler 해석으로 같은 파일이 된다
    ...withSubpaths(
      "./**/*.arbitrary",
      "../**/*.arbitrary",
      "./**/*.arbitrary.*",
      "../**/*.arbitrary.*",
    ),
  ],
  message:
    "생성기(fast-check · *.arbitrary · testing 진입점)는 테스트와 *.arbitrary.ts에서만 import한다 (adr-015).",
};

/**
 * web 안의 층(ARCHITECTURE: app → features → shared). gitignore 방식이라 아래 기능 안쪽 패턴은
 * `features/auth` 자신(index)은 통과시키고 그 안쪽 경로만 막는다. eslint.boundaries.test.ts가 모양을 열거한다.
 */
const WEB_SRC = "apps/editor/web/src";
const WEB_PACKAGE = [
  TIPTAP,
  PROSEMIRROR,
  forbidWorkspace(...except("editor-react", "content-schema")),
];
const WEB_SHARED_UPWARD = {
  group: withSubpaths("../**/features", "../**/app"),
  message: "web shared는 features · app을 import하지 않는다 — 아래 층이 위 층을 모른다.",
};
const WEB_FEATURE_INTERNALS = {
  group: ["./features/*/**", "../**/features/*/**"],
  message:
    "기능 밖에서는 features/<이름>(index.ts)만 import한다 — 기능 안쪽 경로는 그 기능의 것이다.",
};

const restrictedImports = (patterns) => ({
  "no-restricted-imports": ["error", { patterns: [RELATIVE_CROSS_PACKAGE, ...patterns] }],
});

/**
 * 경계 한 벌을 런타임 파일과 테스트 쪽 파일 두 블록으로 건다. 같은 규칙을 뒤 블록이 통째로 덮어쓰므로
 * 테스트 파일만 푸는 블록을 따로 두면 패키지 경계까지 풀린다 — 그래서 `files`의 AND 배열로 좁힌다.
 */
const boundary = (files, patterns) => [
  { files, ignores: TEST_SUPPORT_FILES, rules: restrictedImports([...patterns, GENERATORS]) },
  {
    files: files.flatMap((dir) => TEST_SUPPORT_FILES.map((test) => [dir, test])),
    rules: restrictedImports(patterns),
  },
];

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 접근성 1층(cgamja a11y-frontend §1) — 대체 텍스트 없는 이미지 · 클릭만 있는 비대화형 요소 · 라벨 없는 input을 편집 직후 잡는다.
  // 디자인(캔버스)이 실제 button/label · aria-label · 44px 타깃을 이미 정했으므로 구현이 그것을 깎지 못하게 한다. 2층(axe)은 브라우저 층이 생길 때.
  { ...jsxA11y.flatConfigs.strict, files: ["**/*.tsx", "**/*.jsx"] },
  // 패키지 밖(루트 도구 · 스크립트)에서도 상대경로로 패키지에 들어가지 않고, 런타임 파일은 생성기를 쓰지 않는다.
  // 아래 패키지별 블록이 이 규칙을 덮어쓰므로 boundary()가 같은 패턴을 다시 넣는다.
  boundary(["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"], []),
  boundary(
    ["packages/content-schema/**"],
    [TIPTAP, PROSEMIRROR, REACT, forbidWorkspace(...except())],
  ),
  boundary(
    ["packages/content-render/**"],
    [TIPTAP, PROSEMIRROR, REACT, forbidWorkspace(...except("content-schema"))],
  ),
  boundary(
    ["packages/content-convert/**"],
    [TIPTAP, REACT, forbidWorkspace(...except("content-schema"))],
  ),
  boundary(
    ["apps/editor/editor-core/**"],
    [REACT, forbidWorkspace(...except("content-schema", "content-convert"))],
  ),
  boundary(
    ["apps/editor/editor-react/**"],
    [forbidWorkspace(...except("editor-core", "content-render", "content-schema"))],
  ),
  boundary(
    ["apps/editor/api/**"],
    [
      TIPTAP,
      PROSEMIRROR,
      REACT,
      forbidWorkspace(...except("content-schema", "content-convert", "content-render")),
    ],
  ),
  boundary(["apps/editor/web/**"], WEB_PACKAGE),
  // 뒤 블록이 규칙을 통째로 덮어쓰므로 패키지 경계(WEB_PACKAGE)를 층마다 다시 넣는다
  boundary([`${WEB_SRC}/app/**`, `${WEB_SRC}/pages/**`], [...WEB_PACKAGE, WEB_FEATURE_INTERNALS]),
  boundary([`${WEB_SRC}/shared/**`], [...WEB_PACKAGE, WEB_SHARED_UPWARD, WEB_FEATURE_INTERNALS]),
  globalIgnores(["**/node_modules/**", "**/dist/**", "**/coverage/**", ".claude/**"]),
]);
