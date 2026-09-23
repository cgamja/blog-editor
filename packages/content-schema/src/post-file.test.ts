import { createPostFileSchema, migrate, migrations, MigrationError } from "./post-file";
import { SCHEMA_VERSION } from "./meta";
import { BLOG_CATEGORIES } from "./test-helpers";

/** 입력 불변 검사용 — 픽스처는 JSON-safe라 이것으로 충분하다. */
const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function minimalDoc() {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "안녕" }] }],
  };
}

/**
 * post-file spec은 #### Scenario가 5개다(세 칸 통과 · 불일치/누락/여분 거부 · 현재 버전 그대로 ·
 * 미래/없음/문자열 → MigrationError · migrations.length 불변식) — tasks.md 2.1이 적은 "6개"와
 * 다르다. 1 Scenario = 1 it 규칙을 따라 spec.md를 기준으로 5개를 쓴다(notes에 기록).
 */

const schema = createPostFileSchema({ categories: BLOG_CATEGORIES });

const validMeta = {
  title: "첫 글",
  description: "육아비서를 만드는 이야기",
  date: "2026-09-22",
  category: "studio",
  draft: true,
  source: "editor",
};

const validPostFile = { schemaVersion: SCHEMA_VERSION, meta: validMeta, doc: minimalDoc() };

describe("post-file — PostFile은 schemaVersion · meta · doc 세 칸이다", () => {
  it("WHEN 세 칸이 모두 맞으면 THEN success는 true다", () => {
    expect(schema.safeParse(validPostFile).success).toBe(true);
  });

  it.each([
    ["schemaVersion 불일치", { ...validPostFile, schemaVersion: 2 }],
    ["doc 누락", { schemaVersion: SCHEMA_VERSION, meta: validMeta }],
    ["최상위에 slug 여분 키", { ...validPostFile, slug: "x" }],
  ])("WHEN %s THEN success는 false다", (_label, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe("post-file — migrate는 옛 버전 파일을 현재 버전으로 올린다", () => {
  it("WHEN schemaVersion이 현재 버전인 파일을 migrate하면 THEN 같은 내용이 돌아오고 입력은 변형되지 않는다", () => {
    const input = deepClone(validPostFile);
    const frozenCopy = deepClone(input);
    const result = migrate(input);
    expect(result).toEqual(validPostFile);
    expect(input).toEqual(frozenCopy);
  });

  it.each([
    [
      "미래 버전",
      { ...validPostFile, schemaVersion: SCHEMA_VERSION + 1 },
      String(SCHEMA_VERSION + 1),
    ],
    ["버전 없음", { meta: validMeta, doc: minimalDoc() }, "undefined"],
    ["버전이 문자열", { ...validPostFile, schemaVersion: "1" }, "1"],
  ])(
    "WHEN %s THEN MigrationError를 던지고 메시지에 받은 값이 들어 있다",
    (_label, input, expectedInMessage) => {
      let caught: unknown;
      try {
        migrate(input);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(MigrationError);
      expect((caught as Error).message).toContain(expectedInMessage);
    },
  );

  it("WHEN migrations.length를 읽으면 THEN SCHEMA_VERSION - 1과 같다", () => {
    expect(migrations.length).toBe(SCHEMA_VERSION - 1);
  });
});
