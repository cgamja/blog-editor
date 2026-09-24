import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ESLint } from "eslint";
import { WEB_FEATURE_MAX_DEPTH } from "./eslint.config.mjs";

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

/** 테스트 · 생성기 파일도 패키지 경계는 그대로다 — testing 진입점만 풀린다. */
const PROBE_FILES = [
  "__probe__.ts",
  "__probe__.test.ts",
  "__probe__.arbitrary.ts",
  "__probe__.test.helpers.ts",
];

describe.each(cases)("import 경계: $dir", ({ dir, forbidden, allowed }) => {
  const filePath = `${dir}/src/__probe__.ts`;

  it.each(PROBE_FILES.flatMap((probe) => forbidden.map((specifier) => [probe, specifier])))(
    "%s에서 막는다: %s",
    async (probe, specifier) => {
      const messages = await restrictedImports(`${dir}/src/${probe}`, [specifier]);
      expect(messages.length).toBeGreaterThanOrEqual(1);
    },
  );

  it("허용 import는 통과한다", async () => {
    expect(await restrictedImports(filePath, allowed)).toEqual([]);
  });
});

describe("import 경계: content-schema/testing은 테스트 쪽에서만", () => {
  const TESTING = "@blog-editor/content-schema/testing";

  it("WHEN convert · api의 일반 파일에서 testing 진입점을 import하면 THEN 둘 다 막힌다", async () => {
    const results = await Promise.all([
      restrictedImports("packages/content-convert/src/__probe__.ts", [TESTING]),
      restrictedImports("apps/editor/api/src/__probe__.ts", [TESTING]),
    ]);
    expect(results.map((messages) => messages.length > 0)).toEqual([true, true]);
  });

  it("WHEN convert의 *.test.ts · *.arbitrary.ts에서 testing 진입점을 import하면 THEN 막히지 않는다", async () => {
    const results = await Promise.all([
      restrictedImports("packages/content-convert/src/__probe__.test.ts", [TESTING]),
      restrictedImports("packages/content-convert/src/__probe__.arbitrary.ts", [TESTING]),
    ]);
    expect(results).toEqual([[], []]);
  });
});

describe("import 경계: 생성기(fast-check)는 런타임 파일에 들어오지 않는다", () => {
  const GENERATORS = [
    "fast-check",
    "./doc.arbitrary",
    "./doc.arbitrary.js",
    "../x.arbitrary",
    "../../x.arbitrary",
    "@blog-editor/content-schema/testing",
  ];

  it.each([
    "packages/content-convert/src/__probe__.ts",
    "apps/editor/api/src/__probe__.ts",
    "scripts/__probe__.ts",
  ])("런타임 파일 %s에서 생성기 import를 모두 막는다", async (filePath) => {
    const results = await Promise.all(GENERATORS.map((s) => restrictedImports(filePath, [s])));
    expect(results.map((messages) => messages.length > 0)).toEqual(GENERATORS.map(() => true));
  });

  it.each([
    "packages/content-convert/src/__probe__.test.ts",
    "packages/content-render/src/__probe__.arbitrary.ts",
    "apps/editor/editor-core/src/__probe__.test.helpers.ts",
    "__probe__.test.ts",
  ])("테스트 · 생성기 파일 %s에서는 생성기 import가 통과한다", async (filePath) => {
    expect(await restrictedImports(filePath, GENERATORS)).toEqual([]);
  });
});

describe("import 경계: web 안의 층(app → features → shared)", () => {
  const WEB = "apps/editor/web/src";

  it.each([
    [`${WEB}/shared/api/__probe__.ts`, "../../features/auth"],
    [`${WEB}/shared/api/__probe__.ts`, "../../features/auth/session-cache"],
    [`${WEB}/shared/__probe__.ts`, "../app/query-client"],
    [`${WEB}/shared/routes/__probe__.test.ts`, "../../app/router"],
  ])(
    "WHEN shared(%s)가 features · app을 import하면(%s) THEN 막힌다",
    async (filePath, specifier) => {
      expect((await restrictedImports(filePath, [specifier])).length).toBeGreaterThanOrEqual(1);
    },
  );

  it.each([
    [`${WEB}/app/__probe__.ts`, "../features/auth/session-cache"],
    [`${WEB}/app/__probe__.test.ts`, "../features/auth/components/RequireSession"],
    [`${WEB}/app/pages/__probe__.tsx`, "../../features/auth/pages/LoginPage"],
  ])(
    "WHEN 기능 밖(%s)에서 기능 안쪽 경로를 import하면(%s) THEN 막힌다",
    async (filePath, specifier) => {
      expect((await restrictedImports(filePath, [specifier])).length).toBeGreaterThanOrEqual(1);
    },
  );

  it("WHEN 기능 밖에서 기능의 index · shared를 import하고 기능 안에서 자기 파일을 import하면 THEN 통과한다", async () => {
    const results = await Promise.all([
      restrictedImports(`${WEB}/app/__probe__.ts`, ["../features/auth", "../shared/messages"]),
      restrictedImports(`${WEB}/app/pages/__probe__.tsx`, ["../../shared/routes/constants"]),
      restrictedImports(`${WEB}/features/auth/pages/__probe__.tsx`, [
        "../session-cache",
        "../../../shared/api/errors",
      ]),
    ]);
    expect(results).toEqual([[], [], []]);
  });

  it.each([
    [`${WEB}/features/posts/__probe__.ts`, "../../app/router"],
    [`${WEB}/features/posts/pages/__probe__.tsx`, "../../../app/query-client"],
    [`${WEB}/features/posts/__probe__.ts`, "../auth"],
    [`${WEB}/features/posts/components/__probe__.tsx`, "../../auth/session-cache"],
    [`${WEB}/features/posts/hooks/__probe__.test.ts`, "../../auth"],
    // src까지 올라갔다가 features · app으로 다시 내려오는 우회
    [`${WEB}/features/posts/__probe__.ts`, "../../features/auth"],
    [`${WEB}/features/posts/__probe__.ts`, "../../features/auth/session-cache"],
    [`${WEB}/features/posts/pages/__probe__.tsx`, "../../../features/auth"],
    [`${WEB}/features/posts/__probe__.ts`, "../../../src/app/router"],
    // 앞에 ./를 붙인 모양 · 자기 폴더로 내려갔다 다시 올라오는 모양
    [`${WEB}/features/posts/__probe__.ts`, "./../auth"],
    [`${WEB}/features/posts/pages/__probe__.tsx`, "./../../auth"],
    [`${WEB}/features/posts/pages/__probe__.tsx`, "../components/../../auth"],
  ])(
    "WHEN 기능(%s)이 app이나 다른 기능을 import하면(%s) THEN 막힌다",
    async (filePath, specifier) => {
      expect((await restrictedImports(filePath, [specifier])).length).toBeGreaterThanOrEqual(1);
    },
  );

  it("WHEN 기능이 shared와 자기 파일을 import하면 THEN 통과한다", async () => {
    expect(
      await restrictedImports(`${WEB}/features/posts/pages/__probe__.tsx`, [
        "../../../shared/routes/constants",
        "../components/PostTable",
        "../constants",
      ]),
    ).toEqual([]);
  });

  // 화면 자리를 층 밖에 따로 두지 않는다 — 기능의 화면은 features/<이름>/pages, 기능에 속하지 않는
  // 화면(404 · 오류 · 앱 틀)은 app 아래. 최상위 pages/는 어느 층인지 모호해 import 방향 규칙이 걸리지 않는다
  // 기능 층 규칙은 파일 깊이마다 블록을 둔다 — 그보다 깊은 파일은 규칙 밖이라 아예 만들지 않는다
  it("WHEN web 기능 폴더의 파일 깊이를 잰다 THEN 모두 WEB_FEATURE_MAX_DEPTH 이하다", () => {
    const featuresDir = join(import.meta.dirname, WEB, "features");
    const depths = readdirSync(featuresDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map(
        (entry) => relative(featuresDir, join(entry.parentPath, entry.name)).split(sep).length - 2,
      );
    expect(Math.max(...depths)).toBeLessThanOrEqual(WEB_FEATURE_MAX_DEPTH);
  });

  it("WHEN web src 최상위 폴더를 읽으면 THEN app · features · shared · styles뿐이다", () => {
    const top = readdirSync(join(import.meta.dirname, WEB), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(top).toEqual(["app", "features", "shared", "styles"]);
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
