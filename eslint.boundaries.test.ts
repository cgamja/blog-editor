import { ESLint } from "eslint";

/**
 * eslint.config.mjs의 import 경계가 실제로 막는지 — 설정이 회귀해도 verify가 빨강이 되게 한다.
 * 파일은 만들지 않고 lintText에 경로만 준다. 금지는 no-restricted-imports 에러가 나야 하고, 허용은 0건이어야 한다.
 * 상대경로 항목(adr-009): 패키지 사이를 `../`로 넘는 모양은 막고, 패키지 안의 `../api/client` 같은 정상 상대경로는 통과한다.
 */
const eslint = new ESLint({ cwd: import.meta.dirname });

async function restrictedImports(filePath: string, specifiers: string[]) {
  const code = specifiers.map((s, i) => `import * as m${i} from "${s}";\nvoid m${i};`).join("\n");
  const [result] = await eslint.lintText(code, { filePath });
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
      "../../content-render/src/index",
      "../../../apps/editor/api/src/app",
    ],
    allowed: ["zod", "node:crypto", "./meta", "../package.json"],
  },
  {
    dir: "packages/content-render",
    forbidden: [
      "@tiptap/core",
      "prosemirror-model",
      "react-dom/server",
      "@blog-editor/editor-core",
      "../../content-schema/src/index",
    ],
    allowed: ["@blog-editor/content-schema"],
  },
  {
    dir: "packages/content-convert",
    forbidden: ["@tiptap/core", "react", "@blog-editor/content-render", "../../content-schema"],
    allowed: ["prosemirror-markdown", "@blog-editor/content-schema"],
  },
  {
    dir: "apps/editor/editor-core",
    forbidden: [
      "react",
      "@blog-editor/editor-react",
      "@blog-editor/api",
      "../../editor-react/src/index",
      "../../../../packages/content-schema/src/index",
    ],
    allowed: ["@tiptap/core", "@tiptap/pm/state", "@blog-editor/content-convert"],
  },
  {
    dir: "apps/editor/editor-react",
    forbidden: ["@blog-editor/api", "@blog-editor/web", "../../editor-core/src/commands"],
    allowed: ["react", "@tiptap/react", "@blog-editor/editor-core", "@blog-editor/content-render"],
  },
  {
    dir: "apps/editor/api",
    forbidden: [
      "@tiptap/core",
      "prosemirror-model",
      "react",
      "@blog-editor/editor-core",
      "../../web/src/main",
      "../../../../packages/content-render/src/index",
    ],
    allowed: [
      "hono",
      "@blog-editor/content-schema",
      "@blog-editor/content-render",
      "./store/memory",
    ],
  },
  {
    dir: "apps/editor/web",
    forbidden: [
      "@tiptap/core",
      "@tiptap/pm",
      "@blog-editor/api",
      "@blog-editor/content-convert",
      "../../api/src/app",
      "../../editor-react/src/index",
    ],
    allowed: [
      "react",
      "@blog-editor/editor-react",
      "@blog-editor/content-schema",
      "../api/client",
      "../../api/handlers",
    ],
  },
];

describe.each(cases)("import 경계: $dir", ({ dir, forbidden, allowed }) => {
  const filePath = `${dir}/src/__probe__.ts`;

  it.each(forbidden)("막는다: %s", async (specifier) => {
    expect((await restrictedImports(filePath, [specifier])).length).toBeGreaterThanOrEqual(1);
  });

  it("허용 import는 통과한다", async () => {
    expect(await restrictedImports(filePath, allowed)).toEqual([]);
  });
});

describe("import 경계: 패키지 밖(루트 도구)", () => {
  it.each(["./packages/content-schema", "./apps/editor/api/src/app"])(
    "상대경로로 패키지에 들어가는 것을 막는다: %s",
    async (specifier) => {
      expect((await restrictedImports("__probe__.ts", [specifier])).length).toBeGreaterThanOrEqual(
        1,
      );
    },
  );

  it("패키지 이름과 루트 도구 import는 통과한다", async () => {
    expect(await restrictedImports("__probe__.ts", ["eslint", "vitest/config"])).toEqual([]);
  });
});
