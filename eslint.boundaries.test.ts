import { ESLint } from "eslint";

/**
 * eslint.config.mjs의 import 경계가 실제로 막는지 — 설정이 회귀해도 verify가 빨강이 되게 한다.
 * 파일은 만들지 않고 lintText에 경로만 준다. 금지는 no-restricted-imports 에러가 나야 하고, 허용은 0건이어야 한다.
 */
const eslint = new ESLint({ cwd: import.meta.dirname });

async function restrictedImports(dir: string, specifiers: string[]) {
  const code = specifiers.map((s, i) => `import * as m${i} from "${s}";\nvoid m${i};`).join("\n");
  const [result] = await eslint.lintText(code, { filePath: `${dir}/src/__probe__.ts` });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === "no-restricted-imports")
    .map((m) => m.message);
}

const cases: { dir: string; forbidden: string[]; allowed: string[] }[] = [
  {
    dir: "packages/content-schema",
    forbidden: [
      "@tiptap/core",
      "@tiptap/core/deep/path",
      "@tiptap/pm",
      "@tiptap/pm/model",
      "prosemirror-model",
      "prosemirror-model/dist/index",
      "react",
      "react/jsx-runtime",
      "@blog-editor/content-render",
      "@blog-editor/content-render/src/index",
    ],
    allowed: ["zod", "node:crypto"],
  },
  {
    dir: "packages/content-render",
    forbidden: [
      "@tiptap/core",
      "prosemirror-model",
      "react-dom/server",
      "@blog-editor/editor-core",
    ],
    allowed: ["@blog-editor/content-schema"],
  },
  {
    dir: "packages/content-convert",
    forbidden: ["@tiptap/core", "react", "@blog-editor/content-render"],
    allowed: ["prosemirror-markdown", "@blog-editor/content-schema"],
  },
  {
    dir: "apps/editor/editor-core",
    forbidden: ["react", "@blog-editor/editor-react", "@blog-editor/api"],
    allowed: ["@tiptap/core", "@tiptap/pm/state", "@blog-editor/content-convert"],
  },
  {
    dir: "apps/editor/editor-react",
    forbidden: ["@blog-editor/api", "@blog-editor/web"],
    allowed: ["react", "@tiptap/react", "@blog-editor/editor-core", "@blog-editor/content-render"],
  },
  {
    dir: "apps/editor/api",
    forbidden: ["@tiptap/core", "prosemirror-model", "react", "@blog-editor/editor-core"],
    allowed: ["hono", "@blog-editor/content-schema", "@blog-editor/content-render"],
  },
  {
    dir: "apps/editor/web",
    forbidden: ["@tiptap/core", "@tiptap/pm", "@blog-editor/api", "@blog-editor/content-convert"],
    allowed: ["react", "@blog-editor/editor-react", "@blog-editor/content-schema"],
  },
];

describe.each(cases)("import 경계: $dir", ({ dir, forbidden, allowed }) => {
  it.each(forbidden)("막는다: %s", async (specifier) => {
    expect((await restrictedImports(dir, [specifier])).length).toBeGreaterThanOrEqual(1);
  });

  it("허용 import는 통과한다", async () => {
    expect(await restrictedImports(dir, allowed)).toEqual([]);
  });
});
