import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * import 경계 — 문서에만 있으면 AI가 편한 길로 넘는다(plan 10장). 린트로 잡을 수 있는 것은 여기서 잡는다.
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
const TIPTAP = { group: ["@tiptap/*"], message: "TipTap은 editor-core·editor-react 안에만 둔다." };
const PROSEMIRROR = {
  group: ["prosemirror-*", "@tiptap/pm", "@tiptap/pm/*"],
  message: "ProseMirror는 content-schema 밖에서만 쓴다.",
};
const REACT = {
  group: ["react", "react-dom", "react/*", "react-dom/*"],
  message: "React는 editor-react·web에만 둔다.",
};

/** 각 패키지가 import하면 안 되는 워크스페이스 패키지 — 의존 방향의 역방향·건너뛰기 전부 */
function forbidWorkspace(...names) {
  return {
    group: names.map((n) => `@blog-editor/${n}`),
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

const boundary = (files, patterns) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
  boundary(
    ["apps/editor/web/**"],
    [TIPTAP, PROSEMIRROR, forbidWorkspace(...except("editor-react", "content-schema"))],
  ),
  globalIgnores(["**/node_modules/**", "**/dist/**", "**/coverage/**"]),
]);
